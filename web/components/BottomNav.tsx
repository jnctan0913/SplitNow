'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Receipt, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/login')) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 w-screen card-plush"
      style={{
        borderTopLeftRadius: 'var(--radius-plush)',
        borderTopRightRadius: 'var(--radius-plush)',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="max-w-md mx-auto flex items-stretch justify-around px-2 py-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-pillow py-2 px-3 transition-colors',
                )}
                style={{
                  background: active ? 'var(--color-peach)' : 'transparent',
                  color: active ? 'var(--color-cocoa)' : 'var(--color-cocoa-soft)',
                  borderRadius: 'var(--radius-pillow)',
                }}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
