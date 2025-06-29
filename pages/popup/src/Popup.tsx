import '@src/Popup.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage, extensionEnabledStorage } from '@extension/storage';
import { cn, ErrorDisplay, getIconColor, icons, LoadingSpinner, ToggleButton } from '@extension/ui';

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { enabled } = useStorage(extensionEnabledStorage);
  const iconColor = getIconColor(isLight);

  return (
    <div className={cn('App h-screen w-full', isLight ? 'light' : 'dark')}>
      <header className="App-header flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('extensionName')}</h1>
        <a href="/options/index.html" target="_blank" title={t('openPage', t('settings'))} aria-label={t('settings')}>
          <icons.Configure color={iconColor} size="24" />
        </a>
      </header>

      <div className="mt-4">
        <div className="mb-4">
          <ToggleButton
            checked={enabled}
            onChange={extensionEnabledStorage.toggle}
            label={enabled ? t('enabled') : t('disabled')}
            srOnlyLabel={t('toggleExtension')}
          />
        </div>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-lg">{t('contacts')}</h3>
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
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
