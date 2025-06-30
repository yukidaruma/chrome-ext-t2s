import { applyTextFilters } from '../../packages/shared/lib/utils/text-filter.ts';
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import type { TextFilter } from '../../packages/storage/lib/base/types.js';

describe('Text Filter Functions', () => {
  describe('applyTextFilters', () => {
    describe('empty filters', () => {
      it('should return input text unchanged', () => {
        const filters: TextFilter[] = [];
        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hello World!');
      });
      it('should return input text unchanged when no filters are enabled', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: false,
            target: 'output',
            type: 'pattern',
            pattern: 'Hello',
            replacement: 'Hi',
          },
        ];
        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hello World!');
      });
    });

    describe('pattern filters', () => {
      it('should apply non-regex text replacement', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            pattern: 'う',
            replacement: 'あ',
          },
        ];

        const result = applyTextFilters('あいうえお', filters);
        assert.equal(result, 'あいあえお');
      });

      it('should not normalize whitespaces', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            pattern: 'Hello',
            replacement: '',
          },
        ];

        const result = applyTextFilters('   Hello  World!   ', filters);
        assert.equal(result, '     World!   '); // Should trim whitespaces
      });

      it('should treat pattern as literal text when isRegex is false', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            pattern: '(test)',
            replacement: '[TEST]',
          },
        ];

        const result = applyTextFilters('Hello (test) world', filters);
        assert.equal(result, 'Hello [TEST] world');
      });

      it('should apply regex replacement without flags', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            isRegex: true,
            pattern: 'w',
            replacement: '笑',
          },
        ];

        const result = applyTextFilters('www', filters);
        assert.equal(result, '笑ww'); // Regex without 'g' flag should replace only first match
      });

      it('should apply regex replacement with flags', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            isRegex: true,
            flags: 'gi',
            pattern: '[wｗ]{3,}',
            replacement: 'w',
          },
        ];

        const result = applyTextFilters('すごいwWｗＷ', filters);
        assert.equal(result, 'すごいw');
      });

      it('should support capture groups in regex replacement', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            isRegex: true,
            pattern: '(\\w+) (\\w+)',
            replacement: '$2 $1',
          },
        ];

        const result = applyTextFilters('Hello World', filters);
        assert.equal(result, 'World Hello');
      });

      it('should skip disabled filter', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: false,
            target: 'output',
            type: 'pattern',
            pattern: 'test',
            replacement: 'TEST',
          },
        ];

        const result = applyTextFilters('test message', filters);
        assert.equal(result, 'test message');
      });

      it('should handle invalid regex gracefully', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            isRegex: true,
            flags: 'Z', // Invalid flag
            pattern: '[a-z', // Invalid regex
            replacement: 'X',
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hello World!');
      });
    });

    describe('command filters', () => {
      it('should apply substring command with single argument', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'command',
            pattern: 'substring(5)',
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hello');
      });

      it('should apply substring command with multiple arguments', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'command',
            pattern: 'substring(6, 11)',
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'World');
      });

      it('should ignore whitespace in arguments', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'command',
            pattern: 'substring( 6,　 11	)', // contains fullwidth space and tab
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'World');
      });

      it('should handle invalid command format', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'command',
            pattern: 'invalid format',
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hello World!');
      });

      it('should ignore unknown command', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'command',
            pattern: 'unknown(10)',
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hello World!');
      });
    });

    describe('multiple filters', () => {
      it('should apply filters in sequence', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            pattern: 'Hello',
            replacement: 'Hi',
          },
          {
            id: 2,
            enabled: true,
            target: 'output',
            type: 'command',
            pattern: 'substring(5)',
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hi Wo');
      });

      it('should skip disabled filters in sequence', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            pattern: 'Hello',
            replacement: 'Hi',
          },
          {
            id: 2,
            enabled: false,
            target: 'output',
            type: 'pattern',
            pattern: 'World',
            replacement: 'Universe',
          },
        ];

        const result = applyTextFilters('Hello World!', filters);
        assert.equal(result, 'Hi World!');
      });
    });

    describe('field-specific filters', () => {
      it('should apply filter only to specified field', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'field',
            fieldName: 'author',
            type: 'pattern',
            pattern: 'User',
            replacement: 'ユーザー',
          },
        ];

        const result1 = applyTextFilters('User123', filters, { field: 'author' });
        assert.equal(result1, 'ユーザー123');

        const result2 = applyTextFilters('User123', filters, { field: 'message' });
        assert.equal(result2, 'User123'); // Should not apply to different field

        const result3 = applyTextFilters('User123', filters);
        assert.equal(result3, 'User123'); // Should not apply without field context
      });

      it('should apply all filters whose conditions are met', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'field',
            fieldName: 'message',
            type: 'pattern',
            pattern: 'filter',
            replacement: '',
          },
          {
            id: 2,
            enabled: true,
            target: 'field',
            fieldName: 'message',
            type: 'command',
            pattern: 'substring(0, 8)',
          },
          {
            id: 3,
            enabled: true,
            target: 'output',
            type: 'pattern',
            isRegex: true,
            pattern: '^.',
            replacement: 'A',
          },
          // Not applied because fieldName does not match
          {
            id: 4,
            enabled: true,
            target: 'field',
            fieldName: 'author',
            type: 'pattern',
            isRegex: true,
            flags: 'gi',
            pattern: '.',
            replacement: '',
          },
          // Not applied because filter is disabled
          {
            id: 5,
            enabled: false,
            target: 'output',
            type: 'pattern',
            isRegex: true,
            flags: 'gi',
            pattern: '.',
            replacement: '',
          },
        ];

        const result = applyTextFilters('Hello filter world!', filters, { field: 'message' });
        assert.equal(result, 'Aello  w');
      });

      it('should apply output filter regardless of field', () => {
        const filters: TextFilter[] = [
          {
            id: 1,
            enabled: true,
            target: 'output',
            type: 'pattern',
            pattern: 'test',
            replacement: 'テスト',
          },
        ];

        const result1 = applyTextFilters('test message', filters, { field: 'author' });
        assert.equal(result1, 'テスト message');

        const result2 = applyTextFilters('test message', filters);
        assert.equal(result2, 'テスト message');
      });
    });
  });
});
