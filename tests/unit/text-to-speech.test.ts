import { formatText, extractFieldValues } from '../../packages/shared/lib/utils/text-to-speech.ts';
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import type { FieldExtractor } from '../../packages/shared/lib/utils/text-to-speech.ts';

describe('Text-to-Speech Utility Functions', () => {
  describe('formatText', () => {
    it('should replace single field placeholder', () => {
      const result = formatText('Hello, %(name)!', { name: 'Donut' });
      assert.equal(result, 'Hello, Donut!');
    });

    it('should replace multiple field placeholders', () => {
      const result = formatText('%(author): %(message)', {
        author: 'Donut',
        message: 'Hello there',
      });
      assert.equal(result, 'Donut: Hello there');
    });

    // Note: This should not happen in a real application
    it('should replace missing fields with undefined', () => {
      const result = formatText('%(author): %(message)', { author: 'Donut' });
      assert.equal(result, 'Donut: undefined');
    });

    it('should handle empty format string', () => {
      const result = formatText('', { author: 'Donut' });
      assert.equal(result, '');
    });

    it('should return text unchanged when no placeholders are used', () => {
      const result = formatText('Plain text', { author: 'Donut' });
      assert.equal(result, 'Plain text');
    });
  });

  describe('extractFieldValues', () => {
    it('should extract text content from mock elements', () => {
      const mockElement = {
        querySelector: (selector: string) => {
          const mockElements: Record<string, any> = {
            '#author-name': { textContent: 'Donut' },
            '#message': { textContent: 'Hi' },
          };
          return mockElements[selector];
        },
      } as Element;

      const fields: FieldExtractor[] = [
        { name: 'author', selector: '#author-name' },
        { name: 'message', selector: '#message' },
      ];

      const result = extractFieldValues(mockElement, fields);
      assert.deepEqual(result, { author: 'Donut', message: 'Hi' });
    });

    it('should extract attributes when specified', () => {
      const mockElement = {
        querySelector: (selector: string) => {
          if (selector === '.user') {
            return {
              getAttribute: (attr: string) => (attr === 'data-id' ? '123' : null),
            };
          }
          return null;
        },
      } as Element;

      const fields: FieldExtractor[] = [{ name: 'userId', selector: '.user', attribute: 'data-id' }];

      const result = extractFieldValues(mockElement, fields);
      assert.deepEqual(result, { userId: '123' });
    });

    it('should use default values when element is not found', () => {
      const mockElement = {
        querySelector: (_selector: string) => null,
      } as Element;

      const fields: FieldExtractor[] = [{ name: 'author', selector: '.missing', defaultValue: 'Anonymous' }];

      const result = extractFieldValues(mockElement, fields);
      assert.deepEqual(result, { author: 'Anonymous' });
    });

    it('should handle empty text content', () => {
      const mockElement = {
        querySelector: (selector: string) => {
          if (selector === '.empty') {
            return { textContent: '   ' }; // Only whitespace
          }
          return null;
        },
      } as Element;

      const fields: FieldExtractor[] = [{ name: 'content', selector: '.empty' }];

      const result = extractFieldValues(mockElement, fields);
      assert.deepEqual(result, { content: '' }); // Should be trimmed to empty string
    });

    it('should handle YouTube message structure', () => {
      const mockElement = {
        querySelector: (selector: string) => {
          const mockElements: Record<string, any> = {
            '#author-name': { textContent: 'Donut' },
            '#message': { textContent: 'Great stream!' },
          };
          return mockElements[selector];
        },
      } as Element;

      const fields: FieldExtractor[] = [
        { name: 'author', selector: '#author-name' },
        { name: 'message', selector: '#message' },
      ];

      const result = extractFieldValues(mockElement, fields);
      assert.deepEqual(result, { author: 'Donut', message: 'Great stream!' });
    });
  });
});
