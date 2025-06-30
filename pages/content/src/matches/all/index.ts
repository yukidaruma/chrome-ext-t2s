import { logger, formatText, extractFieldValues, speakText, normalizeWhitespaces } from '@extension/shared/lib/utils';
import { applyTextFilters } from '@extension/shared/lib/utils/text-filter';
import { extensionEnabledStorage, textFilterStorage } from '@extension/storage';
import type { FieldExtractor } from '@extension/shared/lib/utils/text-to-speech';

logger.log('All content script loaded');

// TODO: Replace with values from user preferences
const GLOBAL_VOICE_URI: string | null = 'Google 日本語';

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
      { name: 'name', selector: '#author-name' },
      { name: 'body', selector: '#message' },
    ],
    textFormat: '%(name) %(body)',
  },
];

const createMonitor = (config: SiteConfig) => () => {
  logger.debug(`${config.name} monitoring started.`);

  // Subscribe to filter changes
  let cachedFilters = textFilterStorage.getSnapshot()?.filters ?? [];

  const _unsubscribeFilterUpdate = textFilterStorage.subscribe(() => {
    const newFilters = textFilterStorage.getSnapshot()?.filters ?? [];
    cachedFilters = newFilters;
    logger.debug(`Text filters updated: ${newFilters.length} filters`);
  });

  // Start observing updates
  let containerNode!: Element | null;
  if (config.containerSelector) {
    containerNode = document.querySelector(config.containerSelector);
  }
  containerNode ??= document.body;

  let lastMessageId: string | null = null;
  switch (config.detectUpdateBy?.type) {
    case 'attribute': {
      const lastElement = containerNode.querySelector(`${config.messageSelector}:last-of-type`);
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

    // Apply field-level filters
    const filteredFieldValues = { ...fieldValues };

    for (const [fieldName, fieldValue] of Object.entries(filteredFieldValues)) {
      const fieldFilters = cachedFilters.filter(f => f.enabled && f.target === 'field' && f.fieldName === fieldName);
      filteredFieldValues[fieldName] = applyTextFilters(fieldValue, fieldFilters, { fieldName, logger });
    }

    let formattedText = formatText(config.textFormat, filteredFieldValues);

    // Apply output-level filters
    const outputFilters = cachedFilters.filter(f => f.enabled && f.target === 'output');
    formattedText = applyTextFilters(formattedText, outputFilters, { logger });

    return {
      id: elementId,
      // Re-normalize whitespace. formattedText may contain extra spacing from:
      // - formatText: user-supplied format string with multiple spaces
      // - applyTextFilters: text replacements
      text: normalizeWhitespaces(formattedText),
    };
  };

  const scanExistingMessages = (container: Element): void => {
    container.querySelectorAll(config.messageSelector).forEach(element => {
      const messageData = extractMessageData(element);
      if (messageData?.id) {
        lastMessageId = messageData.id;
      }
    });
  };

  const findNewMessages = (container: Element): Array<{ id: string | null; text: string }> => {
    let foundPreviousLastMessage = !lastMessageId;
    const newMessages: Array<{ id: string | null; text: string }> = [];

    container.querySelectorAll(config.messageSelector).forEach(element => {
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
    const { enabled } = await extensionEnabledStorage.get();
    if (!enabled) {
      logger.debug('Extension is disabled, skipping speech');
      return;
    }

    for (const message of messages) {
      logger.debug(`Added new message to speech queue: ${message.text}`);

      const resolvedVoiceURI = config.voiceURI ?? GLOBAL_VOICE_URI;
      await speakText(message.text, resolvedVoiceURI, logger);
    }
  };

  // Initial scan for existing messages to set lastMessageId (does not speak them)
  scanExistingMessages(containerNode);

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
          if (element.matches(config.messageSelector)) {
            const newMessages = findNewMessages(containerNode);
            queueMessages(newMessages);
            break checkMutations;
          }
        }
      }
    }
  });

  observer.observe(containerNode, {
    childList: true,
    subtree: !config.containerSelector, // Only observe subtree if no specific container
  });
  logger.debug('MutationObserver started', { containerNode });
};

const main = () => {
  const url = location.href;

  let siteConfig = siteConfigs.find(config => config.urlPattern.test(url));

  // Use YouTube config for test screen
  if (location.protocol === 'chrome-extension:' && location.href.includes('/chat-test.html')) {
    siteConfig = siteConfigs[0];
  }

  logger.debug(`Running content script on URL: ${url}`, { enabled: Boolean(siteConfig) });
  if (!siteConfig) {
    return;
  }

  logger.debug(`Site configuration found: ${siteConfig.name}`);

  const monitor = createMonitor(siteConfig);
  monitor();
};

main();
