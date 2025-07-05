/* eslint-disable import-x/exports-last */

import { ttsVolumeStorage } from '@extension/storage';
import type { logger as loggerType } from './logger.js';
import type { TTSRequest, TTSSpeakRequest, InferTTSResponse } from './message-types.js';

export type FieldExtractor = {
  name: string;
  selector: string;
  attribute?: string;
  defaultValue?: string;
};
export const extractFieldValues = (element: Element, fields: FieldExtractor[]): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const field of fields) {
    let value: string | null = null;

    if (field.selector) {
      const targetElement = element.querySelector(field.selector);
      if (targetElement) {
        if (field.attribute) {
          value = targetElement.getAttribute(field.attribute);
        } else if (targetElement.textContent) {
          value = targetElement.textContent.trim();
        }
      }
    }

    const resolvedValue = value ?? field.defaultValue;
    result[field.name] = normalizeWhitespaces(resolvedValue ?? '');
  }

  return result;
};

export const formatText = (format: string, fields: Record<string, string>): string =>
  format.replace(/%\((\w+)\)/g, (_match, fieldName) => fields[fieldName]);

export const normalizeWhitespaces = (text: string): string => text.replace(/\s+/g, ' ').trim();

// Helper function to generate unique request ID (non-cryptographically secure)
const generateRequestId = (): string => `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

// Helper function to send TTS messages to background script via chrome.runtime.sendMessage
const sendTTSMessage = <T extends TTSRequest>(message: T): Promise<InferTTSResponse<T>> =>
  chrome.runtime.sendMessage<T, InferTTSResponse<T>>(message);

export type CancellableSpeech = {
  promise: Promise<boolean>; // Resolves to true if speech completed successfully, false if cancelled
  cancel: () => Promise<void>;
};

export const speakText = (
  text: string,
  voiceURI: string | null,
  { logger }: { logger?: typeof loggerType } = {},
): CancellableSpeech => {
  const requestId = generateRequestId();
  let resolved = false;

  // Build the TTS request data

  const speakRequestData: TTSSpeakRequest['data'] = {
    text,
    voiceURI,
    requestId,
  };

  const { volume } = ttsVolumeStorage.getSnapshot() ?? {};
  if (volume) {
    speakRequestData.volume = volume;
  }

  // Create the cancellable promise for TTS operation

  // Store resolve function to allow external cancellation of the promise
  let resolvePromise: (value: boolean) => void;

  const promise = new Promise<boolean>((resolve, reject) => {
    resolvePromise = resolve;

    // Send TTS request to background script
    sendTTSMessage({
      type: 'TTS_SPEAK',
      data: speakRequestData,
    })
      .then(response => {
        if (!resolved) {
          resolved = true;
          if (response?.data?.success) {
            logger?.debug(`Background TTS completed for request ${requestId}`);
            resolve(true);
          } else {
            const error = response?.data?.error ?? 'Unknown TTS error';
            reject(new Error(error));
          }
        }
      })
      .catch(error => {
        if (!resolved) {
          resolved = true;
          if (error instanceof Error) {
            logger?.error(`Background TTS error for request ${requestId}: ${error.message}`);
          }
          reject(error);
        }
      });
  });

  const cancel = async () => {
    if (!resolved) {
      resolved = true;
      logger?.debug(`Cancelling TTS request ${requestId}`);

      try {
        // Send cancel message to background script
        // Note: Since we don't queue multiple messages at once, cancelling all TTS requests effectively cancels this single request
        await sendTTSMessage({
          type: 'TTS_CANCEL',
        });
      } catch (error) {
        logger?.error(`Error cancelling TTS request ${requestId}:`, error);
      }

      resolvePromise(false);
    }
  };

  return { promise, cancel };
};
