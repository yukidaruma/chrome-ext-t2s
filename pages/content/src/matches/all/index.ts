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
  containerSelector?: string;
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
    containerSelector: '#items',
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

const speakText = async (text: string, voiceURI: string | null): Promise<void> =>
  new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    const utterance = new SpeechSynthesisUtterance(text);

    if (voiceURI) {
      const voice = voices.find(v => v.voiceURI === voiceURI);
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onend = () => {
      resolve();
    };

    speechSynthesis.speak(utterance);
  });

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

const createMonitor = (config: SiteConfig) => () => {
  logger.debug(`${config.name} monitoring started.`);

  let lastMessageId: string | null = null;
  switch (config.detectUpdateBy?.type) {
    case 'attribute': {
      const lastElement = document.querySelector(`${config.messageSelector}:last-of-type`);
      lastMessageId = lastElement?.getAttribute(config.detectUpdateBy.attribute) ?? null;
    }
  }
  logger.debug(`Initial lastMessageId: ${lastMessageId}`);

  const extractMessageData = (element: Element): { id: string | null; text: string } | null => {
    let elementId: string | null = null;
    switch (config.detectUpdateBy?.type) {
      case 'attribute':
        elementId = element.getAttribute(config.detectUpdateBy.attribute);
        if (!elementId) return null;
        break;
      default:
        break;
    }

    const fieldValues = extractFieldValues(element, config.fields);
    const hasContent = Object.values(fieldValues).some(value => value !== '');
    if (!hasContent) return null;

    const formattedText = formatText(config.textFormat, fieldValues);
    return {
      id: elementId,
      text: formattedText,
    };
  };

  const scanExistingMessages = (): void => {
    document.querySelectorAll(config.messageSelector).forEach(element => {
      const messageData = extractMessageData(element);
      if (messageData?.id) {
        lastMessageId = messageData.id;
      }
    });
  };

  const findNewMessages = (): Array<{ id: string | null; text: string }> => {
    let foundPreviousLastMessage = !lastMessageId;
    const newMessages: Array<{ id: string | null; text: string }> = [];

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

      const messageData = extractMessageData(element);
      if (messageData) {
        newMessages.push(messageData);
        if (messageData.id) {
          lastMessageId = messageData.id;
        }
      }
    });

    return newMessages;
  };

  const queueMessages = async (messages: Array<{ id: string | null; text: string }>) => {
    for (const message of messages) {
      logger.log('Speaking new message', message);

      const resolvedVoiceURI = config.voiceURI ?? GLOBAL_VOICE_URI;
      await speakText(message.text, resolvedVoiceURI);
    }
  };

  // Initial scan for existing messages to set lastMessageId (does not speak them)
  scanExistingMessages();

  // Set up MutationObserver to watch for new messages
  const observer = new MutationObserver(mutations => {
    checkMutations: for (const mutation of mutations) {
      if (mutation.type !== 'childList') {
        continue;
      }

      // Check if any added nodes match message selector or contain matching elements
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes.item(i)!;
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          if (element.matches(config.messageSelector) ?? element.querySelector(config.messageSelector)) {
            logger.debug('DOM changes detected, processing new messages');

            const newMessages = findNewMessages();
            queueMessages(newMessages);
            break checkMutations;
          }
        }
      }
    }
  });

  // Start observing updates
  let targetNode!: Element | null;
  if (config.containerSelector) {
    targetNode = document.querySelector(config.containerSelector);
  }
  targetNode ??= document.body;

  observer.observe(targetNode, {
    childList: true,
    subtree: !config.containerSelector, // Only observe subtree if no specific container
  });
  logger.debug('MutationObserver started', { targetNode });
};

const main = () => {
  const url = location.href;
  logger.debug(`Running content script on URL: ${url}`);

  const siteConfig = siteConfigs.find(config => config.urlPattern.test(url));
  if (!siteConfig) {
    logger.debug('No matching site configuration found, skipping execution.');
    return;
  }

  logger.debug(`Site configuration found: ${siteConfig.name}`);

  const monitor = createMonitor(siteConfig);
  monitor();
};

main();
