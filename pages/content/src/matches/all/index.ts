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

const youtubeChatURLPattern = /^https:\/\/studio\.youtube\.com\/live_chat\?/;

const main = async () => {
  const url = location.href;
  logger.debug(`Running content script on URL: ${url}`);

  if (!youtubeChatURLPattern.test(url)) {
    logger.debug('Not a YouTube Live Chat URL, skipping execution.');
    return;
  }

  logger.debug('YouTube Live Chat URL detected.');

  let lastMessageId =
    document.querySelector('yt-live-chat-text-message-renderer:last-of-type:last-of-type')?.getAttribute('id') || null;
  logger.debug(`Initial lastMessageId: ${lastMessageId}`);

  type ChatMessage = {
    author: string;
    body: string;
  };
  const speechQueue: ChatMessage[] = [];

  while (true) {
    let foundPreviousLastMessage = !lastMessageId;

    document.querySelectorAll('yt-live-chat-text-message-renderer').forEach(element => {
      const elementId = element.getAttribute('id');
      if (!elementId) {
        return;
      }

      if (elementId === lastMessageId) {
        foundPreviousLastMessage = true;
        return;
      }
      if (!foundPreviousLastMessage) {
        return;
      }
      if (element.getAttribute('author-type') === 'owner') {
        logger.debug(`Skipping owner's message: ${elementId}`);
        return;
      }

      lastMessageId = elementId;

      const author = element.querySelector('#author-name')?.textContent;
      const message = element.querySelector('#message')?.textContent;
      if (!message || !author) {
        return;
      }

      logger.log('Adding message to the speech queue', { elementId, author, message });
      speechQueue.push({
        author,
        body: message,
      });
    });

    for (const message of speechQueue) {
      // Read out the message
      const uttr = new SpeechSynthesisUtterance(`${message.author} ${message.body}`);
      speechSynthesis.speak(uttr);
    }
    speechQueue.splice(0); // Clear the queue

    await sleep(1000);
  }
};

main();
