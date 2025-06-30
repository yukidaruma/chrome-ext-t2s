import type { logger as loggerType } from './logger.js';
import type { TextFilter } from '@extension/storage/lib/base/types.js';

const parseCommand = (command: string): { name: string; args: string[] } | null => {
  const match = command.trim().match(/^(\w+)\(([^)]*)\)$/);
  if (!match) return null;

  const [, name, argsStr] = match;
  const args = argsStr.trim() === '' ? [] : argsStr.split(',').map(arg => arg.trim());

  return { name, args };
};

const executeCommand = (text: string, command: string, logger?: typeof loggerType): string => {
  const parsed = parseCommand(command);
  if (!parsed) {
    logger?.warn(`Invalid command format: ${command}`);
    return text;
  }

  const { name, args } = parsed;

  switch (name) {
    case 'substring': {
      const start = parseInt(args[1] ?? '0', 10);
      const end = args[0] ? parseInt(args[0], 10) : undefined;
      return text.substring(start, end);
    }
    default:
      logger?.warn(`Unknown command: ${name}`);
      return text;
  }
};

export const applyTextFilters = (
  text: string,
  filters: TextFilter[],
  { field, logger }: { field?: string; logger?: typeof loggerType } = {},
): string => {
  let result = text;

  for (const filter of filters) {
    if (!filter.enabled) {
      continue;
    }
    if (filter.fieldName && filter.fieldName !== field) {
      continue;
    }

    switch (filter.type) {
      case 'pattern': {
        try {
          if (filter.isRegex) {
            const regex = new RegExp(filter.pattern, filter.flags ?? '');
            result = result.replace(regex, filter.replacement);
          } else {
            result = result.replaceAll(filter.pattern, filter.replacement);
          }
        } catch (error) {
          logger?.warn(`Invalid pattern in filter ${filter.id}:`, error);
        }
        break;
      }
      case 'command': {
        result = executeCommand(result, filter.pattern, logger);
        break;
      }
    }
  }

  return result;
};
