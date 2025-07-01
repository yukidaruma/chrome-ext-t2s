import {
  logger,
  formatText,
  extractFieldValues,
  speakText,
  normalizeWhitespaces,
  findSiteConfigByUrl,
  retryForValue,
  sleep,
} from '@extension/shared/lib/utils';
import { applyTextFilters } from '@extension/shared/lib/utils/text-filter';
import { extensionEnabledStorage, textFilterStorage, ttsVoiceEngineStorage } from '@extension/storage';
import type { SiteConfig } from '@extension/shared/lib/utils/site-config';

logger.log('All content script loaded');

type CleanUpFunction = () => void;
const createMonitor = (config: SiteConfig) => async (): Promise<CleanUpFunction> => {
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
    const containerNodeFound = await retryForValue(() => document.querySelector(config.containerSelector!), {
      // Retry up to 5 seconds
      retries: 50,
      baseDelay: 100,
    });
    if (containerNodeFound) {
      containerNode = containerNodeFound;
    }
  }

  // Wait for page to load if loadDetectionSelector is specified
  if (config.loadDetectionSelector) {
    const _loadDetectionElement = await retryForValue(
      () => containerNode.querySelector(config.loadDetectionSelector!),
      {
        // Retry forever; since it multiplies in the retry function, it can overflow in unrealistic scenario
        retries: Number.MAX_SAFE_INTEGER,
        baseDelay: 100,
      },
    );
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

  const queueMessages = async (messages: string[]) => {
    const { enabled } = await extensionEnabledStorage.get();
    if (!enabled) {
      logger.debug('Extension is disabled, skipping speech');
      return;
    }

    const { uri: storedVoiceURI } = await ttsVoiceEngineStorage.get();

    for (const message of messages) {
      logger.debug(`Added new message to speech queue: ${message}`);

      await speakText(message, storedVoiceURI, logger);
    }
  };

  // Set up MutationObserver to watch for new messages
  const observer = new MutationObserver(mutations => {
    const newMessages: string[] = [];

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
              newMessages.push(messageText);
            }
          }
        }
      }
    }

    if (newMessages.length > 0) {
      queueMessages(newMessages);
    }
  });

  observer.observe(containerNode, {
    childList: true,
    subtree: !config.containerSelector, // Only observe subtree if no specific container
  });
  logger.debug('MutationObserver started', { containerNode });

  // Return cleanup function
  return () => {
    logger.debug(`${config.name} monitoring stopped.`);
    observer.disconnect();
  };
};

let currentCleanup: CleanUpFunction | null = null;
const setUpMonitorWithUrlWatcher = async (siteConfig: SiteConfig) => {
  const monitor = createMonitor(siteConfig);
  currentCleanup = await monitor();

  // Since Twitch.tv overriding history.pushState and history.replaceState,
  // we need to watch for URL changes using polling
  let currentUrl = location.href;
  while (true) {
    await sleep(1000);

    const newUrl = location.href;
    if (newUrl !== currentUrl) {
      logger.log('URL changed detected', { currentUrl, newUrl });
      currentUrl = newUrl;

      // Clean up previous monitor if it exists
      if (currentCleanup) {
        logger.debug('Cleaning up previous monitor');
        currentCleanup();
      }

      // Create a new monitor for the new URL
      currentCleanup = await monitor();
      logger.debug(`Created new monitor for: ${newUrl}`);
    }
  }
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

  // Check if this is Twitch (SPA that needs URL watching)
  const isTwitch = siteConfig.id === 'twitch';

  if (isTwitch) {
    logger.debug('Setting up URL watcher for Twitch SPA navigation');
    setUpMonitorWithUrlWatcher(siteConfig);
  } else {
    // For non-SPA sites, just start monitoring once
    const monitor = createMonitor(siteConfig);
    monitor();
  }
};

main();
