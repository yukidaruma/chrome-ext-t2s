import 'webextension-polyfill';
import { logger } from '@extension/shared/lib/utils';
import type { TTSRequest, TTSSpeakRequest, TTSCancelRequest, TTSResponse } from '@extension/shared/lib/utils';

type SendResponseFunction = (response: TTSResponse) => void;

// TTS functionality using chrome.tts.speak()
const handleTTSSpeak = async (request: TTSSpeakRequest, sendResponse: SendResponseFunction) => {
  const { text, voiceURI, volume, requestId } = request.data;

  try {
    // Prepare TTS options
    const ttsOptions: chrome.tts.TtsOptions = {
      voiceName: voiceURI ?? undefined,
      volume,
      onEvent: (event: chrome.tts.TtsEvent) => {
        logger.debug(`TTS Event for ${requestId}:`, event.type);

        if (
          event.type === 'end' ||
          event.type === 'cancelled' ||
          event.type === 'error' ||
          event.type === 'interrupted'
        ) {
          // Send response back to content script
          sendResponse({
            type: 'TTS_RESPONSE',
            data: {
              requestId,
              type: event.type,
              success: event.type === 'end',
              error: event.type === 'error' ? 'TTS error occurred' : undefined,
            },
          });
        }
      },
    };

    // Start TTS
    chrome.tts.speak(text, ttsOptions);

    logger.debug(`Started TTS for request ${requestId}: "${text}"`);
  } catch (error) {
    logger.error(`TTS error for request ${requestId}:`, error);
    sendResponse({
      type: 'TTS_RESPONSE',
      data: {
        requestId,
        type: 'error',
        success: false,
        error: error instanceof Error ? error.message : `${error}`,
      },
    });
  }
};

const handleTTSCancel = (_request: TTSCancelRequest, sendResponse: SendResponseFunction) => {
  chrome.tts.stop();
  logger.debug('Cancelled all TTS requests');

  sendResponse({
    type: 'TTS_CANCEL_RESPONSE',
    data: {
      success: true,
    },
  });
};

// Message listener for TTS commands
chrome.runtime.onMessage.addListener((message: TTSRequest, _sender, sendResponse: SendResponseFunction) => {
  // See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#sending_an_asynchronous_response_using_sendresponse

  logger.debug('Background received message:', message.type, message.data);

  switch (message.type) {
    case 'TTS_SPEAK':
      handleTTSSpeak(message, sendResponse);
      return true;

    case 'TTS_CANCEL':
      handleTTSCancel(message, sendResponse);
      return true;

    default:
      return false;
  }
});

console.log('Background script loaded.');
