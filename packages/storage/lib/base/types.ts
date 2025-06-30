/* eslint-disable import-x/exports-last */
import type { StorageEnum } from './index.js';

export type ValueOrUpdateType<D> = D | ((prev: D) => Promise<D> | D);

export type BaseStorageType<D> = {
  get: () => Promise<D>;
  set: (value: ValueOrUpdateType<D>) => Promise<void>;
  getSnapshot: () => D | null;
  subscribe: (listener: () => void) => () => void;
};

export type StorageConfigType<D = string> = {
  /**
   * Assign the {@link StorageEnum} to use.
   * @default Local
   */
  storageEnum?: StorageEnum;
  /**
   * Only for {@link StorageEnum.Session}: Grant Content scripts access to storage area?
   * @default false
   */
  sessionAccessForContentScripts?: boolean;
  /**
   * Keeps state live in sync between all instances of the extension. Like between popup, side panel and content scripts.
   * To allow chrome background scripts to stay in sync as well, use {@link StorageEnum.Session} storage area with
   * {@link StorageConfigType.sessionAccessForContentScripts} potentially also set to true.
   * @see https://stackoverflow.com/a/75637138/2763239
   * @default false
   */
  liveUpdate?: boolean;
  /**
   * An optional props for converting values from storage and into it.
   * @default undefined
   */
  serialization?: {
    /**
     * convert non-native values to string to be saved in storage
     */
    serialize: (value: D) => string;
    /**
     * convert string value from storage to non-native values
     */
    deserialize: (text: string) => D;
  };
};

// extension-enabled-storage.ts
export type ExtensionEnabledStateType = {
  enabled: boolean;
};
export type ExtensionEnabledStorageType = ToggleStorageType<ExtensionEnabledStateType>;

// language-storage.ts
export type LanguageStateType = {
  language: string; // must be `SupportedLanguagesKeysType`
};
export type LanguageStorageType = BaseStorageType<LanguageStateType> & {
  setLanguage: (language: string) => Promise<void>;
};

// log-console-storage.ts
export type LogConsoleStateType = {
  enabled: boolean;
};
export type LogConsoleStorageType = ToggleStorageType<LogConsoleStateType>;

// log-storage.ts
export type JSDataType = string | number | JSDataObject | Array<JSDataType>;
type JSDataObject = {
  [key: string]: JSDataType;
};
export type LogEntry = {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: JSDataType;
};
export type LogStateType = {
  entries: LogEntry[];
  maxEntries: number;
};

export type LogStorageType = BaseStorageType<LogStateType> & {
  addEntry: (level: LogEntry['level'], message: string, data?: JSDataType, timestamp?: number) => Promise<void>;
  clearLogs: () => Promise<void>;
  getRecentLogs: (count?: number) => Promise<LogEntry[]>;
};

// theme-storage.ts
export type ThemeStateType = {
  theme: 'light' | 'dark';
  isLight: boolean;
};
export type ToggleStorageType<T> = BaseStorageType<T> & {
  toggle: () => Promise<void>;
};
export type ThemeStorageType = ToggleStorageType<ThemeStateType>;

// tts-volume-storage.ts
export type TtsVolumeStateType = {
  volume: number; // 0.0 to 1.0
};
export type TtsVolumeStorageType = BaseStorageType<TtsVolumeStateType> & {
  setVolume: (volume: number) => Promise<void>;
};
