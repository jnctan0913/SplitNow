import type { MetadataRoute } from 'next';
import { trip } from '@/lib/trips';

export const dynamic = 'force-static';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: trip.name,
    short_name: 'SplitNow',
    description: `Trip expense tracker for ${trip.subtitle}`,
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    background_color: '#FFF6E9',
    theme_color: '#FFD4B8',
    icons: [
      { src: `${basePath}${trip.iconBase}-icon.png`,       sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${basePath}${trip.iconBase}-apple-icon.png`, sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
