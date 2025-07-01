import { ttsVolumeStorage } from '@extension/storage';
import type { logger as loggerType } from './logger.js';

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

export type CancellableSpeech = {
  promise: Promise<boolean>; // Resolves to true if speech completed successfully, false if cancelled
  cancel: () => void;
};

export const speakText = (
  text: string,
  voiceURI: string | null,
  { logger }: { logger?: typeof loggerType } = {},
): CancellableSpeech => {
  const utterance = new SpeechSynthesisUtterance(text);
  let resolved = false;
  let resolvePromise: (value: boolean) => void;

  const promise = new Promise<boolean>((resolve, reject) => {
    resolvePromise = resolve;

    const { volume } = ttsVolumeStorage.getSnapshot() ?? {};
    if (volume) {
      utterance.volume = volume;
    }

    if (voiceURI) {
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.voiceURI === voiceURI);
      if (voice) {
        utterance.voice = voice;
      } else {
        logger?.warn(`voice: ${voiceURI} not found`);
      }
    }

    utterance.onend = () => {
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    };

    utterance.onerror = event => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Speech synthesis error: ${event.error}`));
      }
    };

    speechSynthesis.speak(utterance);
  });

  const cancel = () => {
    if (!resolved) {
      resolved = true;
      speechSynthesis.cancel();
      resolvePromise(false);
    }
  };

  return { promise, cancel };
};
