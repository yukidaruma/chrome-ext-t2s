import { extensionEnabledStorage } from '@extension/storage';
import { useEffect } from 'react';

/**
 * Calling this hook in different components simultaneously creates redundant subscriptions;
 * however, it is functionally safe.
 */
export const useSubscribeIcon = () => {
  useEffect(() => {
    const updateIcon = async () => {
      const { enabled } = await extensionEnabledStorage.get();
      const icon = enabled ? 'speaker-icon-128.png' : 'mute-icon-128.png';

      chrome.action.setIcon({
        path: `/${icon}`,
      });
    };

    const unsubscribe = extensionEnabledStorage.subscribe(updateIcon);

    return unsubscribe;
  }, []);
};
