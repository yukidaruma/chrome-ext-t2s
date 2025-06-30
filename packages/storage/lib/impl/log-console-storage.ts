import { createStorage, StorageEnum } from '../base/index.js';
import type { LogConsoleStateType, LogConsoleStorageType } from '../base/index.js';

const storage = createStorage<LogConsoleStateType>(
  'log-console-storage-key',
  {
    enabled: false,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const logConsoleStorage: LogConsoleStorageType = {
  ...storage,
  toggle: async () => {
    await storage.set(currentState => ({
      enabled: !currentState.enabled,
    }));
  },
};
