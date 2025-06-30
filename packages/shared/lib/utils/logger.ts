import { logConsoleStorage, logStorage } from '@extension/storage';
import type { LogEntry } from '@extension/storage/lib/base/types.js';

type LogTask = {
  level: LogEntry['level'];
  args: unknown[];
  timestamp: number;
};

// Use queue mechanism to prevent race conditions when writing to log storage.
const logQueue: LogTask[] = [];
let isProcessing = false;

const processLogQueue = async () => {
  if (isProcessing || logQueue.length === 0) return;

  isProcessing = true;

  while (logQueue.length > 0) {
    const task = logQueue.shift()!;
    await processLogTask(task);
  }

  isProcessing = false;
};

const processLogTask = async ({ level, args, timestamp }: LogTask) => {
  const text = formatMessage(...args);

  try {
    await Promise.allSettled([
      logStorage.addEntry(level, text, undefined, timestamp),
      logConsoleStorage.get().then(({ enabled }) => {
        if (enabled) {
          switch (level) {
            case 'error':
              console.error('[T2S]', ...args);
              break;
            case 'warn':
              console.warn('[T2S]', ...args);
              break;
            case 'info':
              console.log('[T2S]', ...args);
              break;
            case 'debug':
              console.debug('[T2S]', ...args);
              break;
          }
        }
      }),
    ]);
  } catch {
    /* noop */
  }
};

const logMessage = (level: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]) => {
  logQueue.push({ level, args, timestamp: Date.now() });
  processLogQueue();
};

const formatMessage = (...args: unknown[]): string =>
  args
    .map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');

export const logger = {
  error(...args: unknown[]) {
    logMessage('error', ...args);
  },
  warn(...args: unknown[]) {
    logMessage('warn', ...args);
  },
  log(...args: unknown[]) {
    logMessage('info', ...args);
  },
  debug(...args: unknown[]) {
    logMessage('debug', ...args);
  },
};
