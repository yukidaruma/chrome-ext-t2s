import { IS_DEV } from '@extension/env';
import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

const permissions: ManifestType['permissions'] = [
  'storage',
  'scripting',
  'tts', // This permission is required for using TTS without user interaction
];
if (IS_DEV) {
  permissions.push('sidePanel');
}

/**
 * @prop default_locale
 * if you want to support multiple languages, you can use the following reference
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
 *
 * @prop browser_specific_settings
 * Must be unique to your extension to upload to addons.mozilla.org
 * (you can delete if you only want a chrome extension)
 *
 * @prop permissions
 * Firefox doesn't support sidePanel (It will be deleted in manifest parser)
 *
 * @prop content_scripts
 * css: ['content.css'], // public folder
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  // browser_specific_settings: {
  //   gecko: {
  //     id: 'example@example.com',
  //     strict_min_version: '109.0',
  //   },
  // },
  version: packageJson.version,
  description: '__MSG_extensionDescription__',
  host_permissions: ['<all_urls>'],
  permissions,
  options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_popup: 'popup/index.html',
    default_icon: 'speaker-icon-32.png',
  },
  icons: {
    '32': 'speaker-icon-32.png',
    '128': 'speaker-icon-128.png',
    '512': 'speaker-icon-512.png',
  },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/live_chat*', 'https://studio.youtube.com/live_chat*'],
      js: ['content/all.iife.js'],
      all_frames: true,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', '*.png'],
      matches: ['https://www.youtube.com/*', 'https://studio.youtube.com/*'], // The exact same pattern with `content_scripts` does not work
    },
  ],
  side_panel: {
    default_path: 'side-panel/index.html',
  },
} satisfies ManifestType;

export default manifest;
