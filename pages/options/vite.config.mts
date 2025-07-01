import { resolve } from 'node:path';
import { withPageConfig } from '@extension/vite-config';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'dist', 'options'),
    rollupOptions: {
      input: {
        index: resolve('index.html'),
        'chat-test': resolve('chat-test.html'),
      },
      // Necessary to suppress build warnings. The file comes from the content script.
      external: ['/content/all.iife.js'],
    },
  },
});
