import { sleep } from '@extension/shared';

const logger = {
  log(...message: unknown[]) {
    console.log('[CEB]', ...message);
  },
  debug(...message: unknown[]) {
    console.debug('[CEB]', ...message);
  },
};

logger.log('All content script loaded');

// TODO: Replace with values from user preferences
const GLOBAL_VOICE_URI: string | null = 'Google 日本語';
const DEFAULT_POLLING_INTERVAL = 1000;

type FieldExtractor = {
  name: string;
  selector: string;
  attribute?: string;
  defaultValue?: string;
};

type DetectUpdateByAttribute = {
  type: 'attribute';
  attribute: string;
};

type SiteConfig = {
  name: string;
  urlPattern: RegExp;
  messageSelector: string;
  detectUpdateBy?: DetectUpdateByAttribute;
  fields: FieldExtractor[];
  textFormat: string;
  voiceURI?: string;
  pollingInterval?: number;
};

const siteConfigs: SiteConfig[] = [
  {
    name: 'YouTube Live Chat',
    urlPattern: /^https:\/\/studio\.youtube\.com\/live_chat\?/,
    messageSelector: 'yt-live-chat-text-message-renderer:not([author-type="owner"])',
    detectUpdateBy: {
      type: 'attribute',
      attribute: 'id',
    },
    fields: [
      { name: 'author', selector: '#author-name' },
      { name: 'message', selector: '#message' },
    ],
    textFormat: '%(author) %(message)',
  },
];

const speakText = (text: string, voiceURI: string | null) => {
  const voices = speechSynthesis.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  if (voiceURI) {
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      utterance.voice = voice;
    }
  }

  speechSynthesis.speak(utterance);
};

const formatText = (format: string, fields: Record<string, string>): string =>
  format.replace(/%\((\w+)\)/g, (_match, fieldName) => fields[fieldName]);

const extractFieldValues = (element: Element, fields: FieldExtractor[]): Record<string, string> => {
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

const createMonitor = (config: SiteConfig) => async () => {
  logger.debug(`${config.name} monitoring started.`);

  let lastMessageId: string | null = null;
  switch (config.detectUpdateBy?.type) {
    case 'attribute': {
      const lastElement = document.querySelector(`${config.messageSelector}:last-of-type`);
      lastMessageId = lastElement?.getAttribute(config.detectUpdateBy.attribute) ?? null;
    }
  }
  logger.debug(`Initial lastMessageId: ${lastMessageId}`);

  const speechQueue: Array<{ id?: string; text: string }> = [];

  while (true) {
    let foundPreviousLastMessage = !lastMessageId;

    document.querySelectorAll(config.messageSelector).forEach(element => {
      let elementId: string | null = null;
      switch (config.detectUpdateBy?.type) {
        case 'attribute':
          elementId = element.getAttribute(config.detectUpdateBy.attribute);
          if (!elementId) return;

          if (elementId === lastMessageId) {
            foundPreviousLastMessage = true;
            return;
          }
          if (!foundPreviousLastMessage) {
            return;
          }
          break;

        default:
          break;
      }

      const fieldValues = extractFieldValues(element, config.fields);

      const hasContent = Object.values(fieldValues).some(value => value !== '');
      if (!hasContent) return;

      if (elementId) {
        lastMessageId = elementId;
      }

      const formattedText = formatText(config.textFormat, fieldValues);
      if (!speechQueue.find(item => item.id === elementId && item.text === formattedText)) {
        logger.log('Adding message to the speech queue', { elementId, fieldValues, formattedText });
        speechQueue.push({
          id: elementId || undefined,
          text: formattedText,
        });
      }
    });

    for (const item of speechQueue) {
      // Use site-specific voice if available, otherwise fall back to global voice
      const resolvedVoiceURI = config.voiceURI ?? GLOBAL_VOICE_URI;
      speakText(item.text, resolvedVoiceURI);
    }
    speechQueue.splice(0);

    await sleep(config.pollingInterval ?? DEFAULT_POLLING_INTERVAL);
  }
};

const main = async () => {
  const url = location.href;
  logger.debug(`Running content script on URL: ${url}`);

  const siteConfig = siteConfigs.find(config => config.urlPattern.test(url));
  if (!siteConfig) {
    logger.debug('No matching site configuration found, skipping execution.');
    return;
  }

  logger.debug(`Site configuration found: ${siteConfig.name}`);

  const monitor = createMonitor(siteConfig);
  await monitor();
};

main();
