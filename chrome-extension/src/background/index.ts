import 'webextension-polyfill';
import { logger } from '@extension/shared/lib/utils';
import type {
  BackgroundRequest,
  TTSSpeakRequest,
  TTSCancelRequest,
  InferBackgroundResponse,
} from '@extension/shared/lib/utils';

type SendResponseFunction<T extends BackgroundRequest> = (response: InferBackgroundResponse<T>) => void;
type BackgroundRequestHandler<T extends BackgroundRequest> = (
  request: T,
  sendResponse: SendResponseFunction<T>,
) => void | Promise<void>;

// TTS functionality using chrome.tts.speak()
const handleTTSSpeak: BackgroundRequestHandler<TTSSpeakRequest> = async (request, sendResponse) => {
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
            type: 'TTS_SPEAK_RESPONSE',
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
      type: 'TTS_SPEAK_RESPONSE',
      data: {
        requestId,
        type: 'error',
        success: false,
        error: error instanceof Error ? error.message : `${error}`,
      },
    });
  }
};

const handleTTSCancel: BackgroundRequestHandler<TTSCancelRequest> = (_request, sendResponse) => {
  chrome.tts.stop();
  logger.debug('Cancelled all TTS requests');

  sendResponse({
    type: 'TTS_CANCEL_RESPONSE',
    data: {
      success: true,
    },
  });
};

const setWebDriverShim = () => {
  chrome.tts.speak = function (_utterance: string, options?: chrome.tts.TtsOptions) {
    // It is necessary to resolve the promise returned. The extension's
    // message queuing logic relies on the promise resolution.
    // This spy allows us to monitor the calls without breaking the sequence.
    options?.onEvent?.({ type: 'end' } satisfies chrome.tts.TtsEvent);
    return Promise.resolve();
  } as typeof chrome.tts.speak;

  console.log('[SPEAKTEXT_MONITOR] chrome.tts.speak shim set up successfully');
};

// Message listener for TTS commands
chrome.runtime.onMessage.addListener(
  (message: BackgroundRequest, _sender, sendResponse: SendResponseFunction<BackgroundRequest>) => {
    // See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#sending_an_asynchronous_response_using_sendresponse

    logger.debug('Background received message:', message.type, message.data);

    switch (message.type) {
      case 'TTS_SPEAK_REQUEST':
        handleTTSSpeak(message, sendResponse);
        return true;

      case 'TTS_CANCEL_REQUEST':
        handleTTSCancel(message, sendResponse);
        return true;

      case 'SET_WEBDRIVER_SHIM_REQUEST':
        setWebDriverShim();
        return false;

      default:
        return false;
    }
  },
);

console.log('Background script loaded.');
