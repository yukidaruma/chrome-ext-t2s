import '@src/Options.css';
import { t } from '@extension/i18n';
import { supportedLanguages } from '@extension/i18n/lib/types';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage, languageStorage, ttsVolumeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { language } = useStorage(languageStorage);
  const { volume } = useStorage(ttsVolumeStorage);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    languageStorage.setLanguage(event.target.value);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    ttsVolumeStorage.setVolume(newVolume);
  };

  return (
    <div className={cn('App p-6', isLight ? 'light' : 'dark')}>
      <h1 className="mb-6 text-2xl font-bold">{t('settingsTitle')}</h1>

      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-lg font-semibold">{t('theme')}</h2>
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
          <h2 className="mb-2 text-lg font-semibold">{t('voiceVolume')}</h2>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="max-w-32 flex-1"
            />
            <span className="w-12 text-sm font-medium">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        <hr />

        <div>
          <a href="chat-test.html" target="_blank">
            {t('openPage', t('testPage'))}
          </a>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
