import { createStorage, StorageEnum } from '../base/index.js';
import type { LanguageStateType, LanguageStorageType } from '../base/index.js';

const storage = createStorage<LanguageStateType>(
  'language-storage-key',
  {
    language: 'en',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const languageStorage: LanguageStorageType = {
  ...storage,
  setLanguage: async language => {
    await storage.set({ language });
  },
};
