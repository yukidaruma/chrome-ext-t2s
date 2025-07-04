import '@src/Popup.css';
import { t } from '@extension/i18n';
import { useStorage, useSubscribeIcon, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage, extensionEnabledStorage } from '@extension/storage';
import { cn, ErrorDisplay, getIconColor, icons, LoadingSpinner, ToggleButton } from '@extension/ui';

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { enabled } = useStorage(extensionEnabledStorage);
  const iconColor = getIconColor(isLight);

  useSubscribeIcon();

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
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
