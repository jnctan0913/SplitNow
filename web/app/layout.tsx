import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Travel Expenses Log',
  description: 'Mobile expense tracker for the Tokyo trip',
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
