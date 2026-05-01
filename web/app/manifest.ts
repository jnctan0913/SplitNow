import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Travel Expenses Log',
    short_name: 'SplitNow',
    description: 'Trip expense tracker with split settlements',
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    background_color: '#FFF6E9',
    theme_color: '#FFD4B8',
    icons: [
      { src: `${basePath}/icon.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${basePath}/apple-icon.png`, sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
