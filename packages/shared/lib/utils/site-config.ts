import type { FieldExtractor } from './text-to-speech.js';

export type SiteConfig = {
  id: string;
  name: string;
  urlPatterns: string[];
  containerSelector?: string;
  loadDetectionSelector?: string; // If specified, will wait for the matching element to appear before processing messages
  messageSelector: string;
  fields: FieldExtractor[];
  textFormat: string;
  pollingInterval?: number;
};

export const siteConfigs: SiteConfig[] = [
  {
    id: 'youtube-live',
    name: 'YouTube Live Chat',
    urlPatterns: ['https://www.youtube.com/live_chat', 'https://studio.youtube.com/live_chat'],
    containerSelector: '#items',
    messageSelector: 'yt-live-chat-text-message-renderer:not([author-type="owner"])',
    fields: [
      { name: 'name', selector: '#author-name' },
      { name: 'body', selector: '#message' },
    ],
    textFormat: '%(name) %(body)',
  },
  {
    id: 'twitch',
    name: 'Twitch Chat',
    urlPatterns: ['https://www.twitch.tv/'],
    containerSelector: '.chat-scrollable-area__message-container',
    loadDetectionSelector: '.live-message-separator-line__hr',
    messageSelector: '.chat-line__message-container',
    fields: [
      { name: 'name', selector: '.chat-author__display-name' },
      { name: 'body', selector: '[data-a-target="chat-line-message-body"]' },
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
