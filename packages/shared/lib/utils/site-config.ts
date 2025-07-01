import type { FieldExtractor } from './text-to-speech.js';

export type DetectUpdateByAttribute = {
  type: 'attribute';
  attribute: string;
};

export type SiteConfig = {
  name: string;
  urlPatterns: string[];
  containerSelector?: string;
  messageSelector: string;
  detectUpdateBy?: DetectUpdateByAttribute;
  fields: FieldExtractor[];
  textFormat: string;
  pollingInterval?: number;
};

export const siteConfigs: SiteConfig[] = [
  {
    name: 'YouTube Live Chat',
    urlPatterns: ['https://www.youtube.com/live_chat', 'https://studio.youtube.com/live_chat'],
    containerSelector: '#items',
    messageSelector: 'yt-live-chat-text-message-renderer:not([author-type="owner"])',
    detectUpdateBy: {
      type: 'attribute',
      attribute: 'id',
    },
    fields: [
      { name: 'name', selector: '#author-name' },
      { name: 'body', selector: '#message' },
    ],
    textFormat: '%(name) %(body)',
  },
];

export const findSiteConfigByUrl = (url: string): SiteConfig | null => {
  // Use YouTube config for test screen
  if (url.startsWith('chrome-extension:') && url.includes('/chat-test.html')) {
    return siteConfigs[0];
  }

  return siteConfigs.find(config => config.urlPatterns.some(pattern => url.startsWith(pattern))) ?? null;
};
