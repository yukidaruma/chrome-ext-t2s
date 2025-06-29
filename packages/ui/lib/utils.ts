import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const getIconColor = (isLight: boolean): string => (isLight ? '#1f2937' : '#fafafa');
