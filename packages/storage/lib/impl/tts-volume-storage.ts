import { createStorage, StorageEnum } from '../base/index.js';
import type { TtsVolumeStateType, TtsVolumeStorageType } from '../base/index.js';

const storage = createStorage<TtsVolumeStateType>(
  'tts-volume-key',
  {
    volume: 1.0, // Default to 100% volume
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const ttsVolumeStorage: TtsVolumeStorageType = {
  ...storage,
  setVolume: async volume => {
    // Clamp volume between 0.0 and 1.0
    const clampedVolume = Math.max(0.0, Math.min(1.0, volume));
    await storage.set({ volume: clampedVolume });
  },
};
