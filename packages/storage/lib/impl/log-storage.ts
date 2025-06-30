import { createStorage, StorageEnum } from '../base/index.js';
import type { JSDataType, LogEntry, LogStateType, LogStorageType } from '../base/index.js';

const storage = createStorage<LogStateType>(
  'log-storage-key',
  {
    entries: [],
    maxEntries: 1000,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const logStorage: LogStorageType = {
  ...storage,
  addEntry: async (level: LogEntry['level'], message: string, data?: JSDataType, timestamp = Date.now()) => {
    const newEntry: LogEntry = {
      timestamp: timestamp,
      level,
      message,
      data,
    };

    await storage.set(currentState => {
      const newEntries = [...currentState.entries, newEntry];

      // Keep only the most recent entries up to maxEntries
      if (newEntries.length > currentState.maxEntries) {
        newEntries.splice(0, newEntries.length - currentState.maxEntries);
      }

      return {
        ...currentState,
        entries: newEntries,
      };
    });
  },
  clearLogs: async () => {
    await storage.set(currentState => ({
      ...currentState,
      entries: [],
    }));
  },
  getRecentLogs: async (count?: number) => {
    const state = await storage.get();
    const { entries } = state;

    return count ? entries.slice(-count) : entries;
  },
};
