import CDP from 'chrome-remote-interface';
import { readFileSync } from 'fs';
import { createServer } from 'http';
import path from 'path';
import type { AddressInfo } from 'net';

declare global {
  interface Window {
    addMessage: (message: { name: string; body: string; isAuto?: boolean }) => void;
  }
}

const TTS_SCRIPTS_LOADED_LOG = '[TTS] All content script loaded';

describe('Text-to-Speech Extension E2E', () => {
  let server!: ReturnType<typeof createServer>;
  let serverUrl: string;
  let cdpClient: CDP.Client = null!;

  // Incremental URL counter to clear browser cache
  let testUrlCounter = 0;
  const getTestUrl = (): string => {
    testUrlCounter += 1;
    return `${serverUrl}/chat-test.html?${testUrlCounter}`;
  };

  before(async () => {
    // Start HTTP server to serve the chat-test.html file
    const testFilePath = path.resolve(process.cwd(), '../../pages/options/public/chat-test.html');
    const htmlContent = readFileSync(testFilePath, 'utf-8');
    const jsFilePath = path.resolve(process.cwd(), '../../pages/options/public/chat-test.js');
    const jsContent = readFileSync(jsFilePath, 'utf-8');

    server = createServer((req, res) => {
      if (req.url?.startsWith('/chat-test.html') || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
      } else if (req.url?.startsWith('/chat-test.js')) {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(jsContent);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Find an available port
    const port = await new Promise<number>(resolve => {
      server.listen(0, () => {
        resolve((server.address() as AddressInfo).port);
      });
    });

    serverUrl = `http://localhost:${port}`;
    console.log(`Test server started at ${serverUrl}`);

    // Set up basic CDP connection (target will be determined per test)
    try {
      cdpClient = await CDP({ port: 9223 });
    } catch (error) {
      console.warn('CDP monitoring not available:', (error as Error).message);
    }
  });

  after(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
    if (cdpClient) {
      await cdpClient.close();
    }

    // Uncomment to keep the browser open after tests
    // await browser.debug();
  });

  it('should load TTS extension content script', async () => {
    await browser.sessionSubscribe({ events: ['log.entryAdded'] });
    const logs: (string | null)[] = [];

    browser.on('log.entryAdded', logEntry => {
      logs.push(logEntry.text);
    });

    // Load the chat-test.html file from our HTTP server
    await browser.url(getTestUrl());

    // This works like an implicit assertion;
    // the test will fail if the log is not found within the timeout.
    await browser.waitUntil(() => logs.includes(TTS_SCRIPTS_LOADED_LOG));
  });

  it('should detect and process YouTube chat messages', async () => {
    // Set up logging to monitor extension loading
    await browser.sessionSubscribe({ events: ['log.entryAdded'] });
    const logs: (string | null)[] = [];
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
    await browser.waitUntil(() => logs.some(log => log?.includes('[TTS] Added new message to speech queue:')));
  });

  it('should process multiple messages sequentially and spy on speakText calls using CDP', async () => {
    const speakTextCalls: Array<{ text: string; voiceURI: string | null; timestamp: number }> = [];
    const { Runtime, Page } = cdpClient;

    // Use CDP to spy on speechSynthesis.speak calls
    let hasInjectedScript = false;
    Runtime.executionContextCreated(event => {
      const context = event.context;
      console.log('Execution context created:', context.name, context.origin);

      if (context.origin.startsWith('chrome-extension://')) {
        Runtime.evaluate({
          uniqueContextId: context.uniqueId,
          expression: `
            (function() {
              const originalSpeak = speechSynthesis.speak;
              speechSynthesis.speak = function(utterance) {
                console.log('[SPEAKTEXT_MONITOR] speechSynthesis.speak is being called with: ' + JSON.stringify({
                  text: utterance.text,
                  voiceURI: utterance.voice ? utterance.voice.voiceURI : null,
                  timestamp: Date.now()
                }));

                // Call onend to simulate completion
                if (utterance.onend) {
                  setTimeout(() => {
                    utterance.onend(new Event('end'));
                  }, 0);
                }
                
                // Mute the speech to avoid actual playback
                utterance.volume = 0;

                // It is necessary to call the original "speak" function. The extension's
                // message queuing logic relies on the 'onend' event that is dispatched
                // by the browser's actual speech engine after an utterance is complete.
                // This spy allows us to monitor the calls without breaking the sequence.
                return originalSpeak.call(this, utterance);
              };
              
              console.log('[SPEAKTEXT_MONITOR] Speech monitoring active in extension context');
            })();
          `,
        }).then(() => (hasInjectedScript = true));
      }
    });
    Runtime.consoleAPICalled(params => {
      const { args } = params;
      const message = args[0]?.value || '';

      if (!message.startsWith('[SPEAKTEXT_MONITOR]')) {
        return;
      }

      try {
        const jsonStart = message.indexOf('{');
        if (jsonStart !== -1) {
          const jsonData = message.substring(jsonStart);
          const callData = JSON.parse(jsonData);
          speakTextCalls.push(callData);
          console.log('Captured speakText call:', callData);
        }
      } catch (e) {
        console.warn('Failed to parse JSON from console log:', e);
      }
    });

    await Runtime.enable();
    await Page.enable();
    await Page.navigate({ url: getTestUrl() });

    // Wait for the script to be injected
    await browser.waitUntil(() => hasInjectedScript, {
      timeoutMsg: 'Failed to inject speech monitoring script into extension context',
    });

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
