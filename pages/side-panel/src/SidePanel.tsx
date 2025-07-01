import '@src/SidePanel.css';
import { logger, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage, logConsoleStorage, logStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useEffect, useState } from 'react';
import type { LogEntry } from '@extension/storage/lib/base/types';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { enabled: consoleLogging } = useStorage(logConsoleStorage);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [storageData, setStorageData] = useState<Record<string, unknown>>({});
  const [enabledLevels, setEnabledLevels] = useState<Record<LogEntry['level'], boolean>>({
    error: true,
    warn: true,
    info: true,
    debug: true,
  });

  useEffect(() => {
    const loadLogs = async () => {
      const recentLogs = await logStorage.getRecentLogs(50);
      setLogs(recentLogs);
    };

    loadLogs();

    // Subscribe to log changes
    const unsubscribe = logStorage.subscribe(() => {
      loadLogs();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const getAllStorage = async () => {
      const data = await chrome.storage.local.get();
      const processedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => {
          if (key === 'log-storage-key' && value && typeof value === 'object' && 'entries' in value) {
            const logData = value as { entries: unknown[]; maxEntries: number };
            return [key, { entries: `[${logData.entries?.length || 0} items]`, maxEntries: logData.maxEntries }];
          }
          return [key, value];
        }),
      );
      setStorageData(processedData);
    };

    getAllStorage();

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      setStorageData(prev => {
        const updated = { ...prev };
        Object.entries(changes).forEach(([key, { newValue }]) => {
          if (newValue !== undefined) {
            if (key === 'log-storage-key' && newValue && typeof newValue === 'object' && 'entries' in newValue) {
              const logData = newValue as { entries: unknown[]; maxEntries: number };
              updated[key] = { entries: `[${logData.entries?.length || 0} items]`, maxEntries: logData.maxEntries };
            } else {
              updated[key] = newValue;
            }
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

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const [hours, minutes, seconds] = [date.getHours(), date.getMinutes(), date.getSeconds()].map(n =>
      n.toString().padStart(2, '0'),
    );
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return [hours, minutes, seconds].join(':') + '.' + ms;
  };

  const levelColors: Record<LogEntry['level'], string> = {
    error: 'text-red-500',
    warn: 'text-yellow-500',
    info: 'text-blue-500',
    debug: 'text-gray-500',
  };

  const filteredLogs = logs.filter(log => enabledLevels[log.level]);

  const toggleLevel = (level: LogEntry['level']) => {
    setEnabledLevels(prev => ({ ...prev, [level]: !prev[level] }));
  };

  const clearLogs = async () => {
    await logStorage.clearLogs();
  };

  const copyToClipboard = async (data: unknown, description: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Failed to copy ${description}:`, error);
    }
  };

  const copyLogs = () => copyToClipboard(filteredLogs, 'logs');
  const copyStorage = () => copyToClipboard(storageData, 'storage');

  return (
    <div className={cn('App', isLight ? 'light' : 'dark')}>
      <div className="px-6 pt-6">
        <div className="mt-2">
          <ToggleButton
            checked={consoleLogging}
            onChange={logConsoleStorage.toggle}
            label={consoleLogging ? 'Console Logging: On' : 'Console Logging: Off'}
          />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Logs:</h3>
            <div className="ml-4 flex gap-3 space-x-1 text-xs">
              {(Object.keys(levelColors) as LogEntry['level'][]).map(level => (
                <label key={level} className="flex cursor-pointer items-center gap-1">
                  <input
                    type="checkbox"
                    checked={enabledLevels[level]}
                    onChange={() => toggleLevel(level)}
                    className="rounded"
                  />
                  <span className={levelColors[level]}>{level}</span>
                </label>
              ))}
            </div>

            <div className="flex-1"></div>

            <div className="flex gap-2">
              <button
                onClick={copyLogs}
                className="bg-secondary border-primary rounded border px-2 py-1 text-xs hover:opacity-80">
                Copy
              </button>
              <button
                onClick={clearLogs}
                className="bg-secondary border-primary rounded border px-2 py-1 text-xs hover:opacity-80">
                Clear
              </button>
            </div>
          </div>

          <pre className="bg-secondary h-64 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-secondary">No logs available</div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="mb-1 font-mono">
                  <span className="text-secondary">{formatTimestamp(log.timestamp)}</span>{' '}
                  <span className={cn('inline-block w-12', levelColors[log.level])}>[{log.level.toUpperCase()}]</span>{' '}
                  <span className="text-primary">{log.message}</span>
                  {log.data && (
                    <div className="text-secondary ml-4 text-xs">
                      {String(typeof log.data === 'string' ? log.data : JSON.stringify(log.data))}
                    </div>
                  )}
                </div>
              ))
            )}
          </pre>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">App Storage:</h3>
            <button
              onClick={copyStorage}
              className="bg-secondary border-primary rounded border px-2 py-1 text-xs hover:opacity-80">
              Copy
            </button>
          </div>
          <pre className="bg-secondary h-64 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-xs">
            {JSON.stringify(storageData, null, 2)}
          </pre>
        </div>
      </div>

      <iframe
        className="h-[30rem] w-full p-0 [&::-webkit-scrollbar]:hidden"
        src="/options/index.html?inline=1"
        title="Options"></iframe>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
