'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { api, type NewExpenseInput } from '@/lib/api';
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '@/lib/currency';
import { formatMoney } from '@/lib/format';
import { Mascot } from '@/components/Mascot';
import { cn } from '@/lib/utils';
import { categoryIcon } from '@/lib/categories';
import type { Expense, Member, Settings, SplitMode } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
  expense?: Expense;
  members: Member[];
  settings: Settings;
  currency: CurrencyCode;
}

const MODES: { id: SplitMode; label: string }[] = [
  { id: 'equal', label: 'Equal' },
  { id: 'amount', label: 'Amount' },
  { id: 'percent', label: 'Percent' },
];

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampDate(value: string, min: string, max: string): string {
  if (!value) return value;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

function parseSplitData(raw: string): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        out[k] = Number(v) || 0;
      }
      return out;
    }
  } catch {
    /* fall through */
  }
  return {};
}

export function ExpenseSheet({
  open,
  onClose,
  onSaved,
  expense,
  members,
  settings,
  currency,
}: Props) {
  const isEdit = !!expense;
  const activeMembers = useMemo(() => members.filter((m) => m.active !== false), [members]);

  const [amount, setAmount] = useState<string>('');
  const [curr, setCurr] = useState<CurrencyCode>(currency);
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [paidBy, setPaidBy] = useState<string>('');
  const [mode, setMode] = useState<SplitMode>('equal');
  const [equalChecked, setEqualChecked] = useState<Record<string, boolean>>({});
  const [amountSplit, setAmountSplit] = useState<Record<string, string>>({});
  const [percentSplit, setPercentSplit] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      setErrorMsg(null);
      return;
    }

    if (expense) {
      setAmount(String(expense.amount ?? ''));
      setCurr(expense.currency);
      setCategory(expense.category ?? '');
      setDescription(expense.description ?? '');
      setDate(expense.date ?? todayISO());
      setPaidBy(expense.paid_by ?? '');
      setMode(expense.split_mode);

      const data = parseSplitData(expense.split_data);
      const eq: Record<string, boolean> = {};
      const amt: Record<string, string> = {};
      const pct: Record<string, string> = {};
      for (const m of activeMembers) {
        const v = data[m.id];
        eq[m.id] = expense.split_mode === 'equal' ? v !== undefined && Number(v) !== 0 : true;
        amt[m.id] = expense.split_mode === 'amount' && v !== undefined ? String(v) : '';
        pct[m.id] = expense.split_mode === 'percent' && v !== undefined ? String(v) : '';
      }
      if (expense.split_mode !== 'equal') {
        for (const m of activeMembers) eq[m.id] = true;
      }
      setEqualChecked(eq);
      setAmountSplit(amt);
      setPercentSplit(pct);
    } else {
      const initialEq: Record<string, boolean> = {};
      const initialAmt: Record<string, string> = {};
      const initialPct: Record<string, string> = {};
      for (const m of activeMembers) {
        initialEq[m.id] = true;
        initialAmt[m.id] = '';
        initialPct[m.id] = '';
      }
      setAmount('');
      setCurr(currency);
      setCategory(settings.categories[0] ?? '');
      setDescription('');
      setDate(clampDate(todayISO(), settings.trip_start, settings.trip_end));
      setPaidBy('');
      setMode('equal');
      setEqualChecked(initialEq);
      setAmountSplit(initialAmt);
      setPercentSplit(initialPct);
    }
    setErrorMsg(null);
    setConfirmDelete(false);
  }, [open, expense, activeMembers, settings, currency]);

  const totalAmount = Number(amount) || 0;
  const decimals = CURRENCIES[curr].decimalDigits;
  const eps = decimals === 0 ? 1 : 0.01;

  const amountSum = useMemo(
    () => activeMembers.reduce((acc, m) => acc + (Number(amountSplit[m.id]) || 0), 0),
    [amountSplit, activeMembers],
  );
  const percentSum = useMemo(
    () => activeMembers.reduce((acc, m) => acc + (Number(percentSplit[m.id]) || 0), 0),
    [percentSplit, activeMembers],
  );
  const amountDelta = totalAmount - amountSum;
  const percentDelta = 100 - percentSum;
  const amountSumOk = Math.abs(amountDelta) < eps;
  const percentSumOk = Math.abs(percentDelta) < 0.01;

  function buildSplitData(): Record<string, number> {
    if (mode === 'equal') {
      const out: Record<string, number> = {};
      for (const m of activeMembers) if (equalChecked[m.id]) out[m.id] = 1;
      return out;
    }
    if (mode === 'amount') {
      const out: Record<string, number> = {};
      for (const m of activeMembers) {
        const v = Number(amountSplit[m.id]);
        if (Number.isFinite(v) && v !== 0) out[m.id] = v;
      }
      return out;
    }
    const out: Record<string, number> = {};
    for (const m of activeMembers) {
      const v = Number(percentSplit[m.id]);
      if (Number.isFinite(v) && v !== 0) out[m.id] = v;
    }
    return out;
  }

  function validate(splitData: Record<string, number>): string | null {
    if (!(totalAmount > 0)) return 'Enter an amount greater than zero';
    if (!curr) return 'Pick a currency';
    if (!category) return 'Pick a category';
    if (!paidBy) return 'Pick who paid';
    if (!date) return 'Pick a date';
    if (Object.keys(splitData).length === 0) return 'Pick at least one person to split with';
    if (mode === 'amount' && !amountSumOk) return `Amounts must sum to ${formatMoney(totalAmount, curr)}`;
    if (mode === 'percent' && !percentSumOk) return 'Percentages must sum to 100';
    return null;
  }

  async function handleSave() {
    setErrorMsg(null);
    const splitData = buildSplitData();
    const err = validate(splitData);
    if (err) {
      setErrorMsg(err);
      return;
    }
    const payload: NewExpenseInput = {
      date,
      category,
      description: description.trim() || undefined,
      amount: totalAmount,
      currency: curr,
      paid_by: paidBy,
      split_mode: mode,
      split_data: splitData,
    };
    try {
      setSubmitting(true);
      const saved = expense
        ? await api.updateExpense(expense.id, payload)
        : await api.addExpense(payload);
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!expense) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      await api.deleteExpense(expense.id);
      onSaved({ ...expense, deleted_at: new Date().toISOString() });
      onClose();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => {
          if (!submitting && !deleting) onClose();
        }}
      />
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto max-w-md transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div
          className="rounded-t-[var(--radius-plush)] max-h-[92vh] overflow-y-auto"
          style={{ background: 'var(--color-cream-soft)' }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 z-10" style={{ background: 'var(--color-cream-soft)' }}>
            <div className="flex-1 flex justify-center">
              <span className="block w-12 h-1.5 rounded-full" style={{ background: 'var(--color-cocoa-soft)', opacity: 0.25 }} />
            </div>
          </div>
          <div className="px-5 pb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{isEdit ? 'Edit expense' : 'Add expense'}</h2>
            <button
              onClick={onClose}
              disabled={submitting || deleting}
              aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'white' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 space-y-4 pb-8">
            <section className="card-plush p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider opacity-60">Amount</p>
              <input
                inputMode="decimal"
                type="number"
                step={decimals === 0 ? '1' : '0.01'}
                min="0"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-4xl font-bold bg-transparent outline-none"
              />
              <div className="flex p-1 gap-1 rounded-[var(--radius-pillow)]" style={{ background: 'var(--color-cream)' }}>
                {CURRENCY_CODES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurr(c)}
                    className={cn(
                      'flex-1 py-2 rounded-[var(--radius-pillow)] text-sm font-semibold transition-colors',
                      curr === c ? 'shadow-sm' : 'opacity-60',
                    )}
                    style={curr === c ? { background: 'var(--color-peach)' } : undefined}
                  >
                    {CURRENCIES[c].symbol} {c}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60 px-1">Category</p>
              <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                {settings.categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                      category === c ? 'shadow-sm' : 'opacity-70',
                    )}
                    style={{
                      background: category === c ? 'var(--color-peach)' : 'white',
                      color: 'var(--color-cocoa)',
                    }}
                  >
                    <i className={cn(categoryIcon(c), 'text-base leading-none')} />
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Description</p>
              <input
                type="text"
                placeholder="What was it for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent outline-none text-base"
              />
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Date</p>
              <input
                type="date"
                value={date}
                min={settings.trip_start || undefined}
                max={settings.trip_end || undefined}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent outline-none text-base"
              />
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60 px-1">Paid by</p>
              <div className="grid grid-cols-3 gap-2">
                {activeMembers.map((m) => {
                  const sel = paidBy === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaidBy(m.id)}
                      className={cn(
                        'card-plush flex flex-col items-center py-3 transition-transform',
                        sel && 'scale-[1.02]',
                      )}
                      style={sel ? { boxShadow: '0 0 0 3px var(--color-peach-deep), 0 4px 16px -6px rgba(107,79,63,0.12)' } : undefined}
                    >
                      <Mascot name={m.mascot} size="md" selected={sel} />
                      <span className="text-xs font-semibold mt-2 truncate max-w-[80px]">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-wider opacity-60 px-1">Split</p>
              <div className="card-plush flex p-1 gap-1">
                {MODES.map((mItem) => (
                  <button
                    key={mItem.id}
                    onClick={() => setMode(mItem.id)}
                    className={cn(
                      'flex-1 py-2 rounded-[var(--radius-pillow)] text-sm font-semibold transition-colors',
                      mode === mItem.id ? 'shadow-sm' : 'opacity-60',
                    )}
                    style={mode === mItem.id ? { background: 'var(--color-peach)' } : undefined}
                  >
                    {mItem.label}
                  </button>
                ))}
              </div>

              {mode === 'equal' && (
                <div className="card-plush p-3 space-y-1">
                  {activeMembers.map((m) => {
                    const checked = !!equalChecked[m.id];
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-3 px-2 py-2 rounded-[var(--radius-pillow)] cursor-pointer"
                        style={checked ? { background: 'var(--color-cream)' } : undefined}
                      >
                        <Mascot name={m.mascot} size="sm" />
                        <span className="flex-1 text-sm font-semibold">{m.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setEqualChecked({ ...equalChecked, [m.id]: e.target.checked })}
                          className="w-5 h-5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {mode === 'amount' && (
                <div className="card-plush p-3 space-y-2">
                  {activeMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-2 py-1">
                      <Mascot name={m.mascot} size="sm" />
                      <span className="flex-1 text-sm font-semibold">{m.name}</span>
                      <input
                        inputMode="decimal"
                        type="number"
                        step={decimals === 0 ? '1' : '0.01'}
                        min="0"
                        placeholder="0"
                        value={amountSplit[m.id] ?? ''}
                        onChange={(e) => setAmountSplit({ ...amountSplit, [m.id]: e.target.value })}
                        className="w-24 text-right bg-transparent outline-none px-2 py-1 rounded-[var(--radius-pillow)]"
                        style={{ background: 'var(--color-cream)' }}
                      />
                    </div>
                  ))}
                  <div
                    className="flex items-center justify-between px-2 pt-2 text-xs"
                    style={{ color: amountSumOk ? 'var(--color-mint-deep)' : 'var(--color-blush-deep)' }}
                  >
                    <span className="opacity-70">Sum</span>
                    <span className="font-semibold">
                      {formatMoney(amountSum, curr)} / {formatMoney(totalAmount, curr)}
                    </span>
                  </div>
                </div>
              )}

              {mode === 'percent' && (
                <div className="card-plush p-3 space-y-2">
                  {activeMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-2 py-1">
                      <Mascot name={m.mascot} size="sm" />
                      <span className="flex-1 text-sm font-semibold">{m.name}</span>
                      <div className="flex items-center gap-1">
                        <input
                          inputMode="decimal"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={percentSplit[m.id] ?? ''}
                          onChange={(e) => setPercentSplit({ ...percentSplit, [m.id]: e.target.value })}
                          className="w-20 text-right bg-transparent outline-none px-2 py-1 rounded-[var(--radius-pillow)]"
                          style={{ background: 'var(--color-cream)' }}
                        />
                        <span className="text-sm opacity-60">%</span>
                      </div>
                    </div>
                  ))}
                  <div
                    className="flex items-center justify-between px-2 pt-2 text-xs"
                    style={{ color: percentSumOk ? 'var(--color-mint-deep)' : 'var(--color-blush-deep)' }}
                  >
                    <span className="opacity-70">Sum</span>
                    <span className="font-semibold">{percentSum.toFixed(1)} / 100</span>
                  </div>
                </div>
              )}
            </section>

            {errorMsg && (
              <p
                className="text-sm text-center font-semibold"
                style={{ color: 'var(--color-blush-deep)' }}
              >
                {errorMsg}
              </p>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleSave}
                disabled={submitting || deleting}
                className="w-full py-3 rounded-[var(--radius-pillow)] font-bold text-base shadow-sm disabled:opacity-60"
                style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
              >
                {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add expense'}
              </button>

              {isEdit && (
                <button
                  onClick={handleDelete}
                  disabled={submitting || deleting}
                  className="w-full py-3 rounded-[var(--radius-pillow)] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{
                    background: confirmDelete ? 'var(--color-blush-deep)' : 'white',
                    color: confirmDelete ? 'white' : 'var(--color-blush-deep)',
                  }}
                >
                  <Trash2 size={16} />
                  {deleting
                    ? 'Deleting...'
                    : confirmDelete
                      ? 'Tap again to confirm delete'
                      : 'Delete expense'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
