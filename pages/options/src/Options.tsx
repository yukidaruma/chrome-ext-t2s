import '@src/Options.css';
import { t } from '@extension/i18n';
import { supportedLanguages } from '@extension/i18n/lib/types';
import { PROJECT_URL_OBJECT, useDebounce, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import {
  exampleThemeStorage,
  extensionEnabledStorage,
  languageStorage,
  ttsVoiceEngineStorage,
  ttsVolumeStorage,
} from '@extension/storage';
import { cn, ErrorDisplay, getIconColor, LoadingSpinner, ToggleButton } from '@extension/ui';
import * as icons from '@extension/ui/lib/icons';
import { useEffect, useRef, useState } from 'react';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { enabled } = useStorage(extensionEnabledStorage);
  const { language } = useStorage(languageStorage);
  const { volume: storedVolume } = useStorage(ttsVolumeStorage);
  const { uri: voiceURI } = useStorage(ttsVoiceEngineStorage);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [localVolume, setLocalVolume] = useState(storedVolume);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const currentVolumeRef = useRef(storedVolume);

  const iconColor = getIconColor(isLight);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    languageStorage.setLanguage(event.target.value);
  };

  const debouncedVolumeUpdate = useDebounce((newVolume: number) => {
    ttsVolumeStorage.setVolume(newVolume);
  }, 300);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);

    currentVolumeRef.current = newVolume; // Update the ref to track current volume
    setLocalVolume(newVolume); // Update UI immediately
    debouncedVolumeUpdate(newVolume); // Debounce storage write
  };

  const handleVoiceEngineChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    ttsVoiceEngineStorage.setUri(value === '' ? null : value);
  };

  const testVoice = () => {
    setIsTestingVoice(true);
    const utterance = new SpeechSynthesisUtterance(t('voiceTestMessage'));
    const selectedVoice = voices.find(voice => voice.voiceURI === voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.volume = localVolume;

    utterance.onend = () => setIsTestingVoice(false);
    utterance.onerror = () => setIsTestingVoice(false);

    speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // Make sure to save the volume when the user closes the page
    const handleBeforeUnload = (_e: BeforeUnloadEvent) => {
      if (currentVolumeRef.current === storedVolume) {
        return;
      }

      ttsVolumeStorage.setVolume(currentVolumeRef.current);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [storedVolume]);

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Sync local volume with storage changes
  useEffect(() => {
    setLocalVolume(storedVolume);
  }, [storedVolume]);

  return (
    <div className={cn('App', isLight ? 'light' : 'dark')}>
      <h1 className="mb-6 text-2xl font-bold">{t('settingsTitle')}</h1>

      <div className="space-y-6">
        <div>
          <h2>{t('extensionState')}</h2>
          <ToggleButton
            checked={enabled}
            onChange={extensionEnabledStorage.toggle}
            label={enabled ? t('enabled') : t('disabled')}
          />
        </div>
        <div>
          <h2>{t('theme')}</h2>
          <ToggleButton
            checked={isLight}
            onChange={exampleThemeStorage.toggle}
            label={isLight ? t('lightMode') : t('darkMode')}
          />
        </div>
        <div className="hidden">
          <h2 className="mb-2 font-semibold">{t('language')}</h2>
          <select
            value={language}
            onChange={handleLanguageChange}
            className="text-secondary bg-secondary border-primary rounded border px-3 py-2">
            {Object.entries(supportedLanguages).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <h2>{t('voiceEngine')}</h2>
          <div className="flex items-center space-x-2">
            <select value={voiceURI ?? ''} onChange={handleVoiceEngineChange} disabled={isTestingVoice}>
              {voices.length > 0 ? (
                <>
                  <option value="" selected={voiceURI === null}>
                    {t('noVoiceSelected')}
                  </option>
                  {voices.map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      [{voice.lang}] {voice.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="" disabled>
                  {t('loadingVoices')}
                </option>
              )}
            </select>
            <button onClick={testVoice} disabled={isTestingVoice}>
              {t('testVoice')}
            </button>
          </div>
        </div>
        <div>
          <h2>{t('voiceVolume')}</h2>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={localVolume}
              onChange={handleVolumeChange}
              disabled={isTestingVoice}
              className="w-72"
            />
            <span className="w-12 text-sm font-medium">{Math.round(localVolume * 100)}%</span>
          </div>
        </div>

        <hr />

        <div>
          <h1>{t('contacts')}</h1>
          <div className="space-x-2">
            <a
              href={PROJECT_URL_OBJECT.url}
              target="_blank"
              title={t('openPage', t('githubRepository'))}
              aria-label={t('githubRepository')}>
              <icons.Github color={iconColor} size="32" />
            </a>
            <a
              href={PROJECT_URL_OBJECT.x}
              target="_blank"
              title={t('openPage', t('xProfile'))}
              aria-label={t('xProfile')}>
              <icons.X color={iconColor} size="32" />
            </a>
          </div>
        </div>

        <hr />

        <div>
          <a href="chat-test.html">{t('openPage', t('testPage'))}</a>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
