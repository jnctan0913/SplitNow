import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Adapted from split-pro (https://github.com/oss-apps/split-pro)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
