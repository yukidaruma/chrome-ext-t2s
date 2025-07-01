import { findSiteConfigByUrl } from '../../packages/shared/lib/utils/site-config.ts';
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

describe('Site Configuration', () => {
  describe('findSiteConfigByUrl', () => {
    it('should find YouTube config for youtube.com live chat URL', () => {
      const config = findSiteConfigByUrl('https://www.youtube.com/live_chat/watch?v=abc123');
      assert.ok(config);
      assert.equal(config.name, 'YouTube Live Chat');
    });

    it('should find YouTube config for studio.youtube.com live chat URL', () => {
      const config = findSiteConfigByUrl('https://studio.youtube.com/live_chat?channelId=abc123');
      assert.ok(config);
      assert.equal(config.name, 'YouTube Live Chat');
    });

    it('should return null for empty URL', () => {
      const config = findSiteConfigByUrl('');
      assert.equal(config, null);
    });

    it('should return null for non-matching URL', () => {
      const config = findSiteConfigByUrl('https://example.com/some-page');
      assert.equal(config, null);
    });

    it('should not match similar URL', () => {
      const config = findSiteConfigByUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.equal(config, null);
    });

    it('should find YouTube config for chat-test.html inside chrome-extension', () => {
      const config = findSiteConfigByUrl('chrome-extension://abc123/options/chat-test.html');
      assert.ok(config);
      assert.equal(config.name, 'YouTube Live Chat');
    });
  });
});
