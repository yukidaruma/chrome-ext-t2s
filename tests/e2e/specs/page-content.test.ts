import CDP from 'chrome-remote-interface';

declare global {
  interface Window {
    addMessage: (message: { name: string; body: string; isAuto?: boolean }) => void;
  }
}

const TTS_SCRIPTS_LOADED_LOG = 'All content script loaded';

describe('Text-to-Speech Extension E2E', () => {
  let cdpClient: CDP.Client = null!;

  // Incremental URL counter to clear browser cache
  let extensionPath: string = null!;
  let testUrlCounter = 0;
  const getTestUrl = (): string => {
    testUrlCounter += 1;
    return `${extensionPath}/options/chat-test.html?${testUrlCounter}`;
  };

  before(async () => {
    // Set up basic CDP connection (target will be determined per test)
    try {
      cdpClient = await CDP({ port: 9223 });
    } catch (error) {
      console.warn('CDP monitoring not available:', (error as Error).message);
    }

    // Get the path to the extension (chrome-extension://)
    extensionPath = await browser.getExtensionPath();
  });

  after(async () => {
    if (cdpClient) {
      await cdpClient.close();
    }

    // Uncomment to keep the browser open after tests
    // await browser.debug();
  });

  it('should load TTS extension content script', async () => {
    await browser.sessionSubscribe({ events: ['log.entryAdded'] });
    const logs: Array<string | null> = [];

    browser.on('log.entryAdded', logEntry => {
      logs.push(logEntry.text);
    });

    // Load the chat-test.html file from our HTTP server
    await browser.url(getTestUrl());

    // This works like an implicit assertion;
    // the test will fail if the log is not found within the timeout.
    await browser.waitUntil(() => logs.some(log => log?.includes(TTS_SCRIPTS_LOADED_LOG)));
  });

  it('should detect and process YouTube chat messages', async () => {
    // Set up logging to monitor extension loading
    await browser.sessionSubscribe({ events: ['log.entryAdded'] });
    const logs: Array<string | null> = [];
    browser.on('log.entryAdded', logEntry => {
      logs.push(logEntry.text);
    });

    // Load the chat-test.html file
    await browser.url(getTestUrl());

    // Wait for extension to load and process existing messages
    await browser.waitUntil(() => logs.some(log => log?.includes(TTS_SCRIPTS_LOADED_LOG)));

    // Add a test message to the chat
    await browser.execute(() => {
      window.addMessage({ name: 'User1', body: 'Test message' });
    });

    // waitUntil serves as an implicit assertion; the test will fail on timeout.
    await browser.waitUntil(() => logs.some(log => log?.includes('Adding message to queue:')));
  });

  // This message should be changed
  it('should process multiple messages sequentially and spy on speakText calls using CDP', async () => {
    const speakTextCalls: Array<{ text: string; timestamp: number }> = [];
    const { Runtime, Page } = cdpClient;

    browser.on('log.entryAdded', logEntry => {
      const message = logEntry.text;
      if (!message) {
        return;
      }

      // Finished speech: "<message>"
      const match = message.match(/Finished speech: "(.*)"/);

      if (match) {
        const text = match[1];
        const timestamp = Date.now();
        speakTextCalls.push({ text, timestamp });
      }
    });

    await Runtime.enable();
    await Page.enable();
    await Page.navigate({ url: getTestUrl() });

    // Add multiple messages sequentially
    await Page.loadEventFired();
    await browser.execute(() => {
      window.addMessage({ name: 'User1', body: 'First message' });
      window.addMessage({ name: 'User2', body: 'Second message' });
    });

    // Wait for all messages to be processed sequentially
    await browser.waitUntil(() => speakTextCalls.length >= 2, {
      timeoutMsg: 'Expected at least 2 speechSynthesis.speak calls within 10 seconds',
    });

    // Verify the messages were processed in order (timestamps should be sequential)
    expect(speakTextCalls[0].text).toContain('First message');
    expect(speakTextCalls[1].text).toContain('Second message');
    expect(speakTextCalls[0].timestamp).toBeLessThan(speakTextCalls[1].timestamp);
  });
});
