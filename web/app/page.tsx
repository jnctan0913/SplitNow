'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, actor as actorStore, passcode as passcodeStore, applyExpenseChange, clearBootCache } from '@/lib/api';
import type { Bootstrap, Settlement, Member } from '@/lib/types';
import type { CurrencyCode } from '@/lib/currency';
import { CURRENCY_CODES, CURRENCIES } from '@/lib/currency';
import { Mascot } from '@/components/Mascot';
import { ExpenseSheet } from '@/components/ExpenseSheet';
import { formatMoney, shortMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { computeSettlement } from '@/lib/settlement';

export default function Dashboard() {
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('SGD');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const settlement: Settlement | null = useMemo(
    () => (boot ? computeSettlement(boot.expenses, boot.members, currency) : null),
    [boot, currency],
  );

  async function refresh() {
    try {
      const b = await api.bootstrap();
      setBoot(b);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  useEffect(() => {
    if (!passcodeStore.get() || !actorStore.get()) {
      router.replace('/login');
      return;
    }
    const cached = api.bootstrapCache();
    if (cached) {
      setBoot(cached);
      setMe(cached.members.find((m) => m.id === actorStore.get()) ?? null);
      setLoading(false);
    }
    (async () => {
      try {
        const b = await api.bootstrap();
        setBoot(b);
        setMe(b.members.find((m) => m.id === actorStore.get()) ?? null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cached) setError(msg);
        if (msg.toLowerCase().includes('passcode')) {
          passcodeStore.clear();
          actorStore.clear();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <SkeletonDashboard />;
  if (error) return <ErrorState message={error} />;
  if (!boot || !settlement || !me) return null;

  const myBalance = settlement.balances.find((b) => b.id === me.id);
  const myNet = myBalance?.net ?? 0;
  const totalSpent = boot.expenses.reduce(
    (acc, e) => acc + (Number(e[`amount_${currency.toLowerCase()}` as 'amount_sgd']) || 0),
    0,
  );

  return (
    <div className="space-y-5">
      <Header tripName={boot.settings.trip_name} me={me} />

      <CurrencyToggle currency={currency} onChange={setCurrency} />

      <BalanceCard net={myNet} currency={currency} mascot={me.mascot} name={me.name} />

      <TripSummary total={totalSpent} currency={currency} expenseCount={boot.expenses.length} />

      <MemberStrip members={boot.members} settlement={settlement} currency={currency} myId={me.id} />

      <SettlementList settlement={settlement} myId={me.id} />

      <FabAdd onClick={() => setSheetOpen(true)} />

      <ExpenseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={(saved) => setBoot((b) => (b ? { ...b, expenses: applyExpenseChange(b.expenses, saved) } : b))}
        members={boot.members}
        settings={boot.settings}
        currency={currency}
      />
    </div>
  );
}

function Header({ tripName, me }: { tripName: string; me: Member }) {
  const router = useRouter();
  return (
    <header className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider opacity-60">Trip</p>
        <h1 className="text-lg font-bold">{tripName}</h1>
      </div>
      <button
        onClick={() => {
          actorStore.clear();
          passcodeStore.clear();
          clearBootCache();
          router.push('/login');
        }}
        aria-label="Switch user"
      >
        <Mascot name={me.mascot} size="md" />
      </button>
    </header>
  );
}

function CurrencyToggle({ currency, onChange }: { currency: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <div className="card-plush flex p-1 gap-1">
      {CURRENCY_CODES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            'flex-1 py-2 rounded-[var(--radius-pillow)] text-sm font-semibold transition-colors',
            currency === c
              ? 'bg-peach text-cocoa shadow-sm'
              : 'opacity-60 hover:opacity-100',
          )}
          style={currency === c ? { background: 'var(--color-peach)' } : undefined}
        >
          {CURRENCIES[c].symbol} {c}
        </button>
      ))}
    </div>
  );
}

function BalanceCard({ net, currency, mascot, name }: { net: number; currency: CurrencyCode; mascot: Member['mascot']; name: string }) {
  const owed = net > 0;
  const settled = Math.abs(net) < (currency === 'JPY' ? 1 : 0.01);
  const bg = settled ? 'var(--color-cream-soft)' : owed ? '#E8F5EA' : '#FFE5E5';
  return (
    <section className="card-plush p-5" style={{ background: bg }}>
      <div className="flex items-center gap-4">
        <Mascot name={mascot} size="xl" />
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider opacity-60">{name}</p>
          {settled ? (
            <>
              <p className="text-2xl font-bold">All settled</p>
              <p className="text-sm opacity-70 mt-1">Nothing to chase</p>
            </>
          ) : owed ? (
            <>
              <p className="text-sm opacity-70">you are owed</p>
              <p className="text-3xl font-bold">{formatMoney(net, currency)}</p>
            </>
          ) : (
            <>
              <p className="text-sm opacity-70">you owe</p>
              <p className="text-3xl font-bold">{formatMoney(-net, currency)}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TripSummary({ total, currency, expenseCount }: { total: number; currency: CurrencyCode; expenseCount: number }) {
  return (
    <section className="card-plush p-4 flex justify-between items-center">
      <div>
        <p className="text-xs uppercase tracking-wider opacity-60">Total spent</p>
        <p className="text-xl font-bold">{shortMoney(total, currency)}</p>
      </div>
      <div className="text-right">
        <p className="text-xs uppercase tracking-wider opacity-60">Expenses</p>
        <p className="text-xl font-bold">{expenseCount}</p>
      </div>
    </section>
  );
}

function MemberStrip({ members, settlement, currency, myId }: { members: Member[]; settlement: Settlement; currency: CurrencyCode; myId: string }) {
  const eps = currency === 'JPY' ? 1 : 0.01;
  return (
    <section>
      <h2 className="text-sm font-semibold opacity-70 mb-2 px-1">Group</h2>
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-2">
        {members.map((m) => {
          const bal = settlement.balances.find((b) => b.id === m.id);
          const net = bal?.net ?? 0;
          const isMe = m.id === myId;
          const settled = Math.abs(net) < eps;
          return (
            <div key={m.id} className="flex flex-col items-center min-w-[68px]">
              <Mascot name={m.mascot} size="lg" selected={isMe} />
              <p className="text-xs font-semibold mt-2 truncate max-w-[68px]">{m.name}</p>
              <p
                className="text-xs mt-0.5"
                style={{
                  color: settled ? 'var(--color-cocoa-soft)' : net > 0 ? 'var(--color-mint-deep)' : 'var(--color-blush-deep)',
                  opacity: settled ? 0.6 : 1,
                }}
              >
                {settled ? '—' : shortMoney(net, currency)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SettlementList({ settlement, myId }: { settlement: Settlement; myId: string }) {
  if (!settlement.transfers.length) return null;

  const grouped = new Map<string, { mascot: Member['mascot']; name: string; rows: typeof settlement.transfers }>();
  for (const t of settlement.transfers) {
    const g = grouped.get(t.from);
    if (g) {
      g.rows.push(t);
    } else {
      grouped.set(t.from, { mascot: t.from_mascot, name: t.from_name, rows: [t] });
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold opacity-70 mb-2 px-1">Settle up</h2>
      <ul className="space-y-2">
        {Array.from(grouped.entries()).map(([fromId, g]) => {
          const involvesMe = fromId === myId || g.rows.some((r) => r.to === myId);
          return (
            <li
              key={fromId}
              className="card-plush p-3"
              style={involvesMe ? { boxShadow: '0 0 0 2px var(--color-peach), 0 4px 16px -6px rgba(107,79,63,0.12)' } : undefined}
            >
              <div className="flex items-center gap-3 mb-2">
                <Mascot name={g.mascot} size="sm" />
                <p className="text-sm">
                  <span className="font-semibold">{g.name}</span>
                  <span className="opacity-60"> pays</span>
                </p>
              </div>
              <ul className="ml-11 space-y-1.5">
                {g.rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Mascot name={r.to_mascot} size="sm" />
                    <span className="text-sm font-semibold flex-1">{r.to_name}</span>
                    <span className="font-bold">{formatMoney(r.amount, settlement.currency)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FabAdd({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="fixed right-6 z-50 w-14 h-14 rounded-full font-bold text-2xl shadow-lg flex items-center justify-center"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)', background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
      aria-label="Add expense"
      onClick={onClick}
    >
      +
    </button>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-white/60 rounded-[var(--radius-pillow)]" />
      <div className="h-12 bg-white/60 rounded-[var(--radius-pillow)]" />
      <div className="h-32 bg-white/60 rounded-[var(--radius-plush)]" />
      <div className="h-16 bg-white/60 rounded-[var(--radius-plush)]" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card-plush p-6 text-center space-y-3">
      <p className="text-2xl">🐻</p>
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm opacity-70">{message}</p>
    </div>
  );
}
