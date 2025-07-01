import { useRef, useLayoutEffect, useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

const debounce = <T extends AnyFunction>(func: T, wait: number): T => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  }) as T;
};

export const useDebounce = (callback: AnyFunction, delay: number) => {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return useMemo(() => debounce((...args) => callbackRef.current(...args), delay), [delay]);
};
