import {
  logger,
  formatText,
  extractFieldValues,
  speakText,
  normalizeWhitespaces,
  findSiteConfigByUrl,
} from '@extension/shared/lib/utils';
import { applyTextFilters } from '@extension/shared/lib/utils/text-filter';
import { extensionEnabledStorage, textFilterStorage, ttsVoiceEngineStorage } from '@extension/storage';
import type { SiteConfig } from '@extension/shared/lib/utils/site-config';

logger.log('All content script loaded');

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
  let containerNode: Element = document.body;
  if (config.containerSelector) {
    const foundContainer = document.querySelector(config.containerSelector);
    if (foundContainer) {
      containerNode = foundContainer;
    }
  }

  const extractMessageData = (element: Element): string | null => {
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

    // Re-normalize whitespace. formattedText may contain extra spacing from:
    // - formatText: user-supplied format string with multiple spaces
    // - applyTextFilters: text replacements
    return normalizeWhitespaces(formattedText);
  };

  const messageQueue: string[] = [];
  let isProcessing = false;

  const processQueue = async () => {
    if (isProcessing || messageQueue.length === 0) {
      return;
    }

    isProcessing = true;

    const { enabled } = await extensionEnabledStorage.get();
    if (enabled && messageQueue.length > 0) {
      const { uri: storedVoiceURI } = await ttsVoiceEngineStorage.get();

      while (messageQueue.length > 0) {
        const message = messageQueue.shift()!;
        logger.debug(`Speaking queued message: ${message}`);
        await speakText(message, storedVoiceURI, logger);
      }
    } else if (!enabled && messageQueue.length > 0) {
      logger.debug('Extension is disabled, clearing speech queue');
      messageQueue.length = 0;
    }

    isProcessing = false;
  };

  const queueMessage = (message: string) => {
    logger.debug(`Adding message to queue: ${message}`);
    messageQueue.push(message);
    processQueue();
  };

  // Set up MutationObserver to watch for new messages
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') {
        continue;
      }

      // Check if any added nodes match message selector or contain matching elements
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes.item(i)!;
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // Check if the element itself matches the message selector;
          // if not, check if it contains any matching elements
          if (element.matches(config.messageSelector) || element.querySelector(config.messageSelector)) {
            const messageText = extractMessageData(element);
            if (messageText) {
              queueMessage(messageText);
            }
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
  const siteConfig = findSiteConfigByUrl(url);

  logger.debug(`Running content script on URL: ${url}`, { enabled: Boolean(siteConfig) });
  if (!siteConfig) {
    return;
  }

  logger.debug(`Site configuration found: ${siteConfig.name}`);

  speechSynthesis.getVoices(); // Ensure voices are loaded on first speechSynthesis.speak call

  const monitor = createMonitor(siteConfig);
  monitor();
};

main();
