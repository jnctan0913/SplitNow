export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// Prefix a /public asset with the configured basePath. Required because
// next/image with output: 'export' doesn't auto-prefix src for /public files.
export function asset(path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  return BASE_PATH + path;
}
