import '@src/Options.css';
import { t } from '@extension/i18n';
import { supportedLanguages } from '@extension/i18n/lib/types';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage, languageStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { language } = useStorage(languageStorage);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    languageStorage.setLanguage(event.target.value);
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
          <h2 className="mb-2 text-lg font-semibold">Development</h2>
          <a href="chat-test.html" target="_blank">
            {t('openPage', t('testPage'))}
          </a>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
