import { createStorage, StorageEnum } from '../base/index.js';
import type { TtsVoiceEngineStateType, TtsVoiceEngineStorageType } from '../base/index.js';

const storage = createStorage<TtsVoiceEngineStateType>(
  'tts-voice-engine-key',
  {
    uri: null,
  },
  {
    storageEnum: StorageEnum.Sync,
    liveUpdate: true,
  },
);

export const ttsVoiceEngineStorage: TtsVoiceEngineStorageType = {
  ...storage,
  setUri: async uri => {
    await storage.set({ uri });
  },
};
