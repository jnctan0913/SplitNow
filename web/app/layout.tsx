import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';
import { trip } from '@/lib/trips';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: trip.name,
  description: `Mobile expense tracker for ${trip.subtitle}`,
  icons: {
    icon: [
      { url: `${basePath}${trip.iconBase}-favicon.png`, sizes: '32x32', type: 'image/png' },
      { url: `${basePath}${trip.iconBase}-icon.png`,    sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: `${basePath}${trip.iconBase}-apple-icon.png`, sizes: '180x180', type: 'image/png' },
    shortcut: `${basePath}${trip.iconBase}-favicon.png`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FFF6E9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full max-w-md mx-auto px-4 pb-24 pt-6">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
