'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api, actor as actorStore, passcode as passcodeStore, applyExpenseChange } from '@/lib/api';
import type { Bootstrap, Expense, Member } from '@/lib/types';
import { CURRENCY_CODES, CURRENCIES, type CurrencyCode } from '@/lib/currency';
import { Mascot } from '@/components/Mascot';
import { ExpenseSheet } from '@/components/ExpenseSheet';
import { PaymentSheet } from '@/components/PaymentSheet';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { categoryIcon, isPayment } from '@/lib/categories';

type Group = { date: string; dayNum: number; items: Expense[] };

export default function ExpensesPage() {
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencyCode>('SGD');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>(undefined);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Expense | undefined>(undefined);

  async function refresh() {
    try {
      const b = await api.bootstrap();
      setBoot(b);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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
      setLoading(false);
    }
    (async () => {
      try {
        const b = await api.bootstrap();
        setBoot(b);
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

  const memberMap = useMemo(() => {
    const m = new Map<string, Member>();
    if (boot) for (const x of boot.members) m.set(x.id, x);
    return m;
  }, [boot]);

  const groups = useMemo<Group[]>(() => {
    if (!boot) return [];
    const live = boot.expenses.filter((e) => !e.deleted_at);
    const byDate = new Map<string, Group>();
    for (const e of live) {
      const key = e.date;
      let g = byDate.get(key);
      if (!g) {
        g = { date: key, dayNum: e.day_num, items: [] };
        byDate.set(key, g);
      }
      g.items.push(e);
    }
    const result = Array.from(byDate.values());
    for (const g of result) {
      g.items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    result.sort((a, b) => (a.date < b.date ? 1 : -1));
    return result;
  }, [boot]);

  function openAdd() {
    setEditing(undefined);
    setSheetOpen(true);
  }

  function openEdit(e: Expense) {
    if (isPayment(e)) {
      setEditingPayment(e);
      setPaymentOpen(true);
      return;
    }
    setEditing(e);
    setSheetOpen(true);
  }

  function onSheetClose() {
    setSheetOpen(false);
    setEditing(undefined);
  }

  function onPaymentSheetClose() {
    setPaymentOpen(false);
    setEditingPayment(undefined);
  }

  if (loading) return <SkeletonExpenses />;
  if (error) return <ErrorState message={error} />;
  if (!boot) return null;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-60">All</p>
          <h1 className="text-lg font-bold">Expenses</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-pillow)] text-sm font-semibold shadow-sm"
          style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Add expense
        </button>
      </header>

      <CurrencyToggle currency={currency} onChange={setCurrency} />

      {groups.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <DayGroup
              key={g.date}
              group={g}
              currency={currency}
              memberMap={memberMap}
              onTap={openEdit}
            />
          ))}
        </div>
      )}

      <ExpenseSheet
        open={sheetOpen}
        onClose={onSheetClose}
        onSaved={(saved) => setBoot((b) => (b ? { ...b, expenses: applyExpenseChange(b.expenses, saved) } : b))}
        expense={editing}
        members={boot.members}
        settings={boot.settings}
        currency={currency}
      />

      <PaymentSheet
        open={paymentOpen}
        onClose={onPaymentSheetClose}
        onSaved={(saved) => setBoot((b) => (b ? { ...b, expenses: applyExpenseChange(b.expenses, saved) } : b))}
        payment={editingPayment}
        members={boot.members}
        settings={boot.settings}
        currency={currency}
      />
    </div>
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
            currency === c ? 'shadow-sm' : 'opacity-60 hover:opacity-100',
          )}
          style={currency === c ? { background: 'var(--color-peach)' } : undefined}
        >
          {CURRENCIES[c].symbol} {c}
        </button>
      ))}
    </div>
  );
}

function DayGroup({
  group,
  currency,
  memberMap,
  onTap,
}: {
  group: Group;
  currency: CurrencyCode;
  memberMap: Map<string, Member>;
  onTap: (e: Expense) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider opacity-60 px-1">
        Day {group.dayNum} · {fmtDayHeader(group.date)}
      </h2>
      <ul className="space-y-2">
        {group.items.map((e) => (
          <li key={e.id}>
            <ExpenseRow expense={e} currency={currency} memberMap={memberMap} onTap={onTap} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExpenseRow({
  expense,
  currency,
  memberMap,
  onTap,
}: {
  expense: Expense;
  currency: CurrencyCode;
  memberMap: Map<string, Member>;
  onTap: (e: Expense) => void;
}) {
  const payer = memberMap.get(expense.paid_by);
  const displayAmount = (expense as unknown as Record<string, number>)[
    `amount_${currency.toLowerCase()}`
  ] ?? 0;
  const showOriginal = expense.currency !== currency;
  const payment = isPayment(expense);
  const recipient = payment ? paymentRecipient(expense, memberMap) : null;

  return (
    <button
      onClick={() => onTap(expense)}
      className="card-plush p-3 w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      {payer ? (
        <Mascot name={payer.mascot} size="md" />
      ) : (
        <span
          className="inline-flex h-12 w-12 rounded-full"
          style={{ background: 'var(--color-cream)' }}
        />
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        {payment ? (
          <span
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-mint)', color: 'var(--color-cocoa)' }}
          >
            <i className="fi-sr-handshake text-[12px] leading-none" />
            Settle up
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-cream)', color: 'var(--color-cocoa)' }}
          >
            <i className={cn(categoryIcon(expense.category), 'text-[12px] leading-none')} />
            {expense.category}
          </span>
        )}
        <p className="font-semibold truncate">
          {payment
            ? `${payer?.name ?? '—'} → ${recipient?.name ?? '—'}`
            : expense.description || 'Untitled'}
        </p>
        <p className="text-xs opacity-60 truncate">
          {payment ? 'Recorded payment' : describeSplit(expense, memberMap)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className="font-bold leading-tight"
          style={payment ? { color: 'var(--color-mint-deep)' } : undefined}
        >
          {formatMoney(displayAmount, currency)}
        </p>
        {showOriginal && (
          <p className="text-[11px] opacity-60 leading-tight mt-0.5">
            {formatMoney(expense.amount, expense.currency)}
          </p>
        )}
      </div>
    </button>
  );
}

function paymentRecipient(expense: Expense, memberMap: Map<string, Member>): Member | null {
  try {
    const raw = expense.split_data ? JSON.parse(expense.split_data) : {};
    if (raw && typeof raw === 'object') {
      const ids = Object.keys(raw).filter((id) => Number(raw[id]) !== 0);
      if (ids.length) return memberMap.get(ids[0]) ?? null;
    }
  } catch {
    /* noop */
  }
  return null;
}

function describeSplit(expense: Expense, memberMap: Map<string, Member>): string {
  let parsed: Record<string, number> = {};
  try {
    const raw = expense.split_data ? JSON.parse(expense.split_data) : {};
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) parsed[k] = Number(v) || 0;
    }
  } catch {
    parsed = {};
  }
  const ids = Object.keys(parsed).filter((id) => parsed[id] !== 0);
  const count = ids.length;

  if (expense.split_mode === 'equal') {
    if (count === 0) return 'no split';
    if (count === 1) {
      const only = memberMap.get(ids[0]);
      return `just ${only?.name ?? 'one person'}`;
    }
    return `split equally with ${count}`;
  }
  if (expense.split_mode === 'amount') return 'split by amount';
  return 'split by percent';
}

function fmtDayHeader(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="card-plush p-6 text-center space-y-3 flex flex-col items-center">
      <span
        className="inline-flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'var(--color-cream)', color: 'var(--color-cocoa)' }}
      >
        <i className="fi-sr-receipt text-3xl leading-none" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">No expenses yet</p>
        <p className="text-sm opacity-70">Log the first one to get rolling.</p>
      </div>
      <button
        onClick={onAdd}
        className="px-4 py-2 rounded-[var(--radius-pillow)] font-semibold text-sm shadow-sm"
        style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
      >
        Add expense
      </button>
    </section>
  );
}

function SkeletonExpenses() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-white/60 rounded-[var(--radius-pillow)]" />
      <div className="h-12 bg-white/60 rounded-[var(--radius-pillow)]" />
      <div className="h-20 bg-white/60 rounded-[var(--radius-plush)]" />
      <div className="h-20 bg-white/60 rounded-[var(--radius-plush)]" />
      <div className="h-20 bg-white/60 rounded-[var(--radius-plush)]" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card-plush p-6 text-center space-y-2">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm opacity-70">{message}</p>
    </div>
  );
}
