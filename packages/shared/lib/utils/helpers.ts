import type { logger as loggerType } from './logger.js';
import type { ExcludeValuesFromBaseArrayType } from './types.js';

export const excludeValuesFromBaseArray = <B extends string[], E extends (string | number)[]>(
  baseArray: B,
  excludeArray: E,
) => baseArray.filter(value => !excludeArray.includes(value)) as ExcludeValuesFromBaseArrayType<B, E>;

export const sleep = async (time: number) => new Promise(r => setTimeout(r, time));

export const retryForValue = async <T>(
  callback: () => T | Promise<T>,
  options: {
    retries?: number;
    baseDelay?: number;
    strategy?: 'none' | 'linear' | 'exponential';
    logger?: typeof loggerType;
  } = {},
): Promise<T | null> => {
  const { retries = 5, baseDelay = 100, strategy = 'none', logger } = options;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await callback();
      if (result) {
        return result;
      }
    } catch (error) {
      logger?.error(`Attempt ${attempt + 1} failed:`, error);
    }

    if (attempt < retries) {
      let delay = baseDelay;
      if (strategy !== 'none') {
        delay = strategy === 'linear' ? baseDelay * (attempt + 1) : Math.random() * baseDelay * 2 ** attempt;
      }

      logger?.debug(`Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(delay);
    }
  }

  logger?.warn('Max retries reached');
  return null;
};
