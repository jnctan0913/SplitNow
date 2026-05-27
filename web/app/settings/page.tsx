'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { api, actor as actorStore, passcode as passcodeStore, clearBootCache } from '@/lib/api';
import type { Bootstrap } from '@/lib/types';
import { Mascot } from '@/components/Mascot';
import { categoryIcon } from '@/lib/categories';
import { asset } from '@/lib/asset';
import { trip } from '@/lib/trips';
import { CURRENCIES, type CurrencyCode, amountKey } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';

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
        <h2 className="text-sm font-semibold opacity-70 mb-2 px-1">Exchange rates</h2>
        <ul className="card-plush p-3 space-y-2">
          {Object.entries(boot.rates).map(([pair, rate]) => (
            <li key={pair} className="flex justify-between text-sm">
              <span className="opacity-70">1 {pair.slice(0, 3)} =</span>
              <span className="font-mono font-semibold">{Number(rate).toFixed(6)} {pair.slice(3)}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] opacity-50 mt-2 px-1">
          Pulled live from Google Finance via the source spreadsheet.
        </p>
      </section>

      <Collapsible title="Shared Fund">
        <FundSettings boot={boot} onSaved={setBoot} />
      </Collapsible>

      <Collapsible title="Travellers">
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
      </Collapsible>

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

      {boot.settings.itinerary_help && boot.settings.itinerary_help.trim() && (
        <section>
          <h2 className="text-sm font-semibold opacity-70 mb-2 px-1">Itinerary tips</h2>
          <div className="card-plush p-4">
            <p className="text-sm whitespace-pre-line opacity-80 leading-relaxed">
              {boot.settings.itinerary_help}
            </p>
          </div>
          <p className="text-[11px] opacity-50 mt-2 px-1">
            Edit in the source spreadsheet's Settings tab (key: <code>itinerary_help</code>).
          </p>
        </section>
      )}

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

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full mb-2 px-1"
      >
        <h2 className="text-sm font-semibold opacity-70">{title}</h2>
        <ChevronDown
          size={16}
          className={cn('opacity-50 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && children}
    </section>
  );
}

function FundSettings({ boot, onSaved }: { boot: Bootstrap; onSaved: (b: Bootstrap) => void }) {
  const existing = boot.settings;
  const [amount, setAmount] = useState(String(existing.fund_amount_per_person ?? ''));
  const [currency, setCurrency] = useState<CurrencyCode>(
    (existing.fund_currency as CurrencyCode) ?? trip.defaultCurrency,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const perPerson = Number(existing.fund_amount_per_person) || 0;
  const fundCur = existing.fund_currency as CurrencyCode | undefined;
  const memberCount = boot.members.filter((m) => m.active !== false).length;

  const fundBalance = (() => {
    if (!perPerson || !fundCur) return null;
    const col = amountKey(fundCur);
    const spent = boot.expenses
      .filter((e) => !e.deleted_at && e.paid_by === 'fund')
      .reduce((acc, e) => acc + (Number(e[col]) || 0), 0);
    const total = perPerson * memberCount;
    return { spent, total, remaining: total - spent };
  })();

  async function handleSave() {
    const n = Number(amount);
    if (!(n > 0)) { setErr('Enter an amount greater than zero'); return; }
    setErr(null);
    setSaving(true);
    try {
      await api.updateSettings('fund_amount_per_person', n);
      await api.updateSettings('fund_currency', currency);
      const fresh = await api.bootstrap();
      onSaved(fresh);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-plush p-4 space-y-4">
      <div className="flex items-center gap-3">
        <img src={asset('/shared_wallet.png')} alt="Fund" className="w-12 h-12 object-contain shrink-0" />
        <p className="text-sm opacity-70 leading-snug">
          Each member contributes the same amount to a shared wallet.
          Fund expenses are split equally and settled automatically.
        </p>
      </div>

      {fundBalance && fundCur && (
        <div
          className="rounded-[var(--radius-pillow)] p-3 space-y-1.5"
          style={{ background: 'var(--color-cream)' }}
        >
          <div className="flex justify-between text-sm">
            <span className="opacity-60">Total pool</span>
            <span className="font-semibold">{formatMoney(fundBalance.total, fundCur)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-60">Spent</span>
            <span className="font-semibold">{formatMoney(fundBalance.spent, fundCur)}</span>
          </div>
          <div
            className="flex justify-between text-sm font-bold border-t pt-1.5"
            style={{ borderColor: 'rgba(107,79,63,0.15)' }}
          >
            <span className="opacity-70">{fundBalance.remaining >= 0 ? 'Remaining' : 'Over budget'}</span>
            <span style={{ color: fundBalance.remaining >= 0 ? 'var(--color-mint-deep)' : 'var(--color-blush-deep)' }}>
              {formatMoney(Math.abs(fundBalance.remaining), fundCur)}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider opacity-60">Amount per person</p>
        <input
          inputMode="decimal"
          type="number"
          min="0"
          placeholder="e.g. 500"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setSaved(false); }}
          className="w-full text-2xl font-bold bg-transparent outline-none"
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider opacity-60 mb-2">Currency</p>
        <div className="flex p-1 gap-1 rounded-[var(--radius-pillow)]" style={{ background: 'var(--color-cream)' }}>
          {trip.currencies.map((c) => (
            <button
              key={c}
              onClick={() => { setCurrency(c); setSaved(false); }}
              className={cn(
                'flex-1 py-2 rounded-[var(--radius-pillow)] text-sm font-semibold transition-colors',
                currency === c ? 'shadow-sm' : 'opacity-60',
              )}
              style={currency === c ? { background: 'var(--color-peach)' } : undefined}
            >
              {CURRENCIES[c].symbol} {c}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-sm font-semibold" style={{ color: 'var(--color-blush-deep)' }}>{err}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-[var(--radius-pillow)] font-bold text-sm shadow-sm disabled:opacity-60"
        style={{
          background: saved ? 'var(--color-mint)' : 'var(--color-peach-deep)',
          color: 'var(--color-cocoa)',
        }}
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save fund settings'}
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
