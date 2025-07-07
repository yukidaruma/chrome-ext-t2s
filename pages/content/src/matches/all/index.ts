import {
  logger,
  formatText,
  extractFieldValues,
  speakText,
  normalizeWhitespaces,
  findSiteConfigByUrl,
  initWebDriverShim,
} from '@extension/shared/lib/utils';
import { applyTextFilters } from '@extension/shared/lib/utils/text-filter';
import { extensionEnabledStorage, textFilterStorage, ttsVoiceEngineStorage } from '@extension/storage';
import type { SiteConfig } from '@extension/shared/lib/utils/site-config';

logger.log('All content script loaded');

const createMonitor =
  (config: SiteConfig, { ignoreNames }: { ignoreNames?: string[] }) =>
  () => {
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

    type MessageData = {
      fieldValues: Record<string, string>;
      filteredFieldValues: Record<string, string>;
      text: string;
    };
    const extractMessageData = (element: Element): MessageData | null => {
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
      return { fieldValues, filteredFieldValues, text: normalizeWhitespaces(formattedText) };
    };

    const messageQueue: string[] = [];
    let isProcessing = false;

    const processQueue = async () => {
      if (isProcessing || messageQueue.length === 0) {
        return;
      }

      isProcessing = true;

      const { enabled } = await extensionEnabledStorage.get();
      const { uri: storedVoiceURI } = await ttsVoiceEngineStorage.get();

      while (enabled && messageQueue.length > 0) {
        const message = messageQueue.shift()!;
        logger.debug(`Start speech: "${message}"`);

        const { promise, cancel } = speakText(message, storedVoiceURI, { logger });
        const unsubscribe = extensionEnabledStorage.subscribe(() => {
          const snapshot = extensionEnabledStorage.getSnapshot();
          if (snapshot && !snapshot.enabled) {
            logger.debug('Extension disabled, canceling current speech');
            isProcessing = false;

            cancel();

            messageQueue.length = 0; // Clear the queue
          }
        });

        try {
          const speechResult = await promise;
          if (speechResult) {
            logger.debug(`Finished speech: "${message}"`);
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            logger.error(`Error during speech: "${message}": ${error.message}`);
          }
        }

        unsubscribe();
      }

      isProcessing = false;
    };

    const queueMessage = (message: string) => {
      logger.debug(`Adding message to queue: "${message}"`);
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
            const element = node as Element & { data?: { authorExternalChannelId?: string } };

            // Check if the element itself matches the message selector;
            // if not, check if it contains any matching elements
            if (element.matches(config.messageSelector) || element.querySelector(config.messageSelector)) {
              const message = extractMessageData(element);

              if (message) {
                if (ignoreNames?.includes(message.fieldValues.name)) {
                  logger.debug(`Skipping message from user: ${message.fieldValues.name}`);
                  continue;
                }

                queueMessage(message.text);
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

const main = async () => {
  const url = location.href;
  const siteConfig = findSiteConfigByUrl(url);

  // Initialize shim for E2E testing
  if (navigator.webdriver) {
    await initWebDriverShim();
  }

  logger.debug(`Running content script on URL: ${url}`, { enabled: Boolean(siteConfig) });
  if (!siteConfig) {
    return;
  }

  logger.debug(`Site configuration found: ${siteConfig.name}`);

  speechSynthesis.getVoices(); // Ensure voices are loaded on first speechSynthesis.speak call

  let myName: string | null = null;
  const ytInitialDataScript = Array.from(document.scripts).find(script =>
    script.textContent?.startsWith('window["ytInitialData"]'),
  )?.textContent;
  const ytInitialDataMatch = ytInitialDataScript?.match(/window\["ytInitialData"\]\s*=\s*({.*?});/);
  if (ytInitialDataMatch) {
    try {
      const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
      // You can also obtain channel id from following path:
      // ytInitialData.continuationContents.liveChatContinuation.actionPanel.liveChatMessageInputRenderer.sendButton.buttonRenderer.serviceEndpoint.sendLiveChatMessageEndpoint.actions[0].addLiveChatTextMessageFromTemplateAction.template.liveChatTextMessageRenderer.authorExternalChannelId
      myName = ytInitialData?.continuationContents?.liveChatContinuation?.viewerName || null;
    } catch {
      /* noop */
    }
  }

  const monitor = createMonitor(siteConfig, { ignoreNames: myName ? [myName] : undefined });
  monitor();
};

main();
