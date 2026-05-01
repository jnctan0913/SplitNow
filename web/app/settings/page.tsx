'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, actor as actorStore, passcode as passcodeStore, clearBootCache } from '@/lib/api';
import type { Bootstrap } from '@/lib/types';
import { Mascot } from '@/components/Mascot';
import { categoryIcon } from '@/lib/categories';

export default function Settings() {
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!passcodeStore.get() || !actorStore.get()) {
      router.replace('/login');
      return;
    }
    const cached = api.bootstrapCache();
    if (cached) setBoot(cached);
    api.bootstrap()
      .then(setBoot)
      .catch((e) => {
        if (!cached) setError(e instanceof Error ? e.message : String(e));
      });
  }, [router]);

  if (error) {
    return (
      <div className="card-plush p-5 text-center space-y-2">
        <p className="font-semibold">Something went wrong</p>
        <p className="text-sm opacity-70">{error}</p>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 bg-white/60 rounded-[var(--radius-plush)]" />
        <div className="h-40 bg-white/60 rounded-[var(--radius-plush)]" />
      </div>
    );
  }

  function logout() {
    actorStore.clear();
    passcodeStore.clear();
    clearBootCache();
    router.replace('/login');
  }

  const meId = actorStore.get();
  const me = boot.members.find((m) => m.id === meId);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider opacity-60">Settings</p>
        <h1 className="text-lg font-bold">Trip details</h1>
      </header>

      <section className="card-plush p-4 space-y-1">
        <p className="text-xs uppercase tracking-wider opacity-60">Trip</p>
        <p className="text-base font-semibold">{boot.settings.trip_name}</p>
        <p className="text-sm opacity-70">
          {fmtDate(boot.settings.trip_start)} → {fmtDate(boot.settings.trip_end)}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold opacity-70 mb-2 px-1">Travellers</h2>
        <ul className="card-plush divide-y divide-cream space-y-0">
          {boot.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-3">
              <Mascot name={m.mascot} size="md" selected={m.id === meId} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{m.name}</p>
                <p className="text-xs opacity-60">{m.mascot}</p>
              </div>
              {m.id === meId && (
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full"
                  style={{ background: 'var(--color-peach)', color: 'var(--color-cocoa)' }}
                >
                  you
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold opacity-70 mb-2 px-1">Exchange rates</h2>
        <ul className="card-plush p-3 space-y-2">
          {Object.entries(boot.rates).map(([pair, rate]) => (
            <li key={pair} className="flex justify-between text-sm">
              <span className="opacity-70">1 {pair.slice(0, 3)} = </span>
              <span className="font-mono font-semibold">{Number(rate).toFixed(6)} {pair.slice(3)}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] opacity-50 mt-2 px-1">
          Pulled live from Google Finance via the source spreadsheet.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold opacity-70 mb-2 px-1">Categories</h2>
        <div className="card-plush p-3 flex flex-wrap gap-2">
          {boot.settings.categories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: 'var(--color-cream)', color: 'var(--color-cocoa)' }}
            >
              <i className={`${categoryIcon(c)} text-sm leading-none`} />
              {c}
            </span>
          ))}
        </div>
        <p className="text-[10px] opacity-50 mt-2 px-1">
          Icons by <a href="https://www.flaticon.com/uicons" className="underline">Flaticon</a>
        </p>
      </section>

      <button
        onClick={logout}
        className="w-full py-3 rounded-[var(--radius-pillow)] font-semibold"
        style={{ background: 'var(--color-blush)', color: 'var(--color-cocoa)' }}
      >
        Log out {me ? `(${me.name})` : ''}
      </button>
    </div>
  );
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
