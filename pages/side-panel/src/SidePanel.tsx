import '@src/SidePanel.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useEffect, useState } from 'react';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [storageData, setStorageData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const getAllStorage = async () => {
      const data = await chrome.storage.local.get();
      setStorageData(data);
    };

    getAllStorage();

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      setStorageData(prev => {
        const updated = { ...prev };
        Object.entries(changes).forEach(([key, { newValue }]) => {
          if (newValue !== undefined) {
            updated[key] = newValue;
          } else {
            delete updated[key];
          }
        });
        return updated;
      });
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return (
    <div className={cn('App', isLight ? 'light' : 'dark')}>
      <ToggleButton
        checked={isLight}
        onChange={exampleThemeStorage.toggle}
        label={isLight ? 'Light Mode' : 'Dark Mode'}
      />

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold">Storage Debug:</h3>
        <pre className="bg-secondary text-secondary max-h-64 overflow-auto rounded p-4 text-left text-xs">
          {JSON.stringify(storageData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
