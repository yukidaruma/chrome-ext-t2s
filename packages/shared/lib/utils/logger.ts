import { logConsoleStorage, logStorage } from '@extension/storage';
import type { LogEntry } from '@extension/storage/lib/base/types.js';

type LogTask = {
  prefix: string;
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

const writeToConsole = (prefix: string, level: LogEntry['level'], ...args: unknown[]) => {
  switch (level) {
    case 'error':
      console.error(prefix, ...args);
      break;
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'info':
      console.log(prefix, ...args);
      break;
    case 'debug':
      console.debug(prefix, ...args);
      break;
  }
};

const processLogTask = async ({ prefix, level, args, timestamp }: LogTask) => {
  const text = formatMessage(...args);

  try {
    await Promise.allSettled([
      logStorage.addEntry(level, `${prefix} ${text}`, undefined, timestamp),
      logConsoleStorage.get().then(({ enabled }) => {
        if (!enabled) {
          return;
        }

        writeToConsole(prefix, level, ...args);
      }),
    ]);
  } catch {
    /* noop */
  }
};

const getExecutionContext = (): string => {
  if (typeof window === 'undefined') {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return 'BG';
    }
  } else {
    if (typeof chrome !== 'undefined' && window.location?.protocol === 'chrome-extension:') {
      return 'EXT';
    }
    if (window.location) {
      return window.location.hostname;
    }
  }

  return 'UNKNOWN';
};

const context = getExecutionContext();
const prefix = `[${context}]`;
const logMessage = (level: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]) => {
  // E2E tests depending on the logs
  if (navigator.webdriver) {
    writeToConsole(prefix, level, ...args);
    return;
  }

  logQueue.push({ prefix, level, args, timestamp: Date.now() });
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
