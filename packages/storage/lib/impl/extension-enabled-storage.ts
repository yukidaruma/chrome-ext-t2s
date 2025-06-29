import { createStorage, StorageEnum } from '../base/index.js';
import type { ExtensionEnabledStateType, ExtensionEnabledStorageType } from '../base/index.js';

const storage = createStorage<ExtensionEnabledStateType>(
  'extension-enabled-key',
  {
    enabled: true,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const extensionEnabledStorage: ExtensionEnabledStorageType = {
  ...storage,
  toggle: async () => {
    await storage.set(currentState => ({
      enabled: !currentState.enabled,
    }));
  },
};
