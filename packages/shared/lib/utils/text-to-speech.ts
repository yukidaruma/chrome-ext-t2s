import { logger } from './logger.js';
import { ttsVolumeStorage } from '@extension/storage';

export const formatText = (format: string, fields: Record<string, string>): string =>
  format.replace(/%\((\w+)\)/g, (_match, fieldName) => fields[fieldName]);

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
    if (resolvedValue === undefined) {
      logger.debug(`Field: '${field.name}' was not found`);
    }
    result[field.name] = (resolvedValue ?? '').trim();
  }

  return result;
};

export const speakText = async (text: string, voiceURI: string | null): Promise<void> => {
  const voices = speechSynthesis.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);

  // Apply volume setting
  const { volume } = await ttsVolumeStorage.get();
  utterance.volume = volume;

  if (voiceURI) {
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      utterance.voice = voice;
    } else {
      logger.warn(`voice: ${voiceURI} not found`);
    }
  }

  return new Promise(resolve => {
    utterance.onend = () => {
      logger.debug(`speech end: ${text}`);
      resolve();
    };

    speechSynthesis.speak(utterance);
  });
};
