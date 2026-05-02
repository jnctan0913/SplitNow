'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Trash2, X } from 'lucide-react';
import { api, type NewExpenseInput } from '@/lib/api';
import { CURRENCIES, CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from '@/lib/currency';
import { Mascot } from '@/components/Mascot';
import { cn } from '@/lib/utils';
import { PAYMENT_CATEGORY } from '@/lib/categories';
import type { Expense, Member, Settings } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
  members: Member[];
  settings: Settings;
  currency: CurrencyCode;
  payment?: Expense;
  defaultFrom?: string;
  defaultTo?: string;
  defaultAmount?: number;
}

function recipientFromSplit(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const ids = Object.keys(parsed).filter((id) => Number(parsed[id]) !== 0);
      return ids[0] ?? '';
    }
  } catch {
    /* fall through */
  }
  return '';
}

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

export function PaymentSheet({
  open,
  onClose,
  onSaved,
  members,
  settings,
  currency,
  payment,
  defaultFrom,
  defaultTo,
  defaultAmount,
}: Props) {
  const isEdit = !!payment;
  const activeMembers = useMemo(() => members.filter((m) => m.active !== false), [members]);

  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [curr, setCurr] = useState<CurrencyCode>(currency);
  const [date, setDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      setConfirmDelete(false);
      return;
    }
    if (payment) {
      setFrom(payment.paid_by ?? '');
      setTo(recipientFromSplit(payment.split_data));
      setAmount(payment.amount ? String(payment.amount) : '');
      setCurr(isCurrencyCode(payment.currency) ? payment.currency : currency);
      setDate(payment.date || clampDate(todayISO(), settings.trip_start, settings.trip_end));
    } else {
      setFrom(defaultFrom ?? '');
      setTo(defaultTo ?? '');
      setAmount(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : '');
      setCurr(currency);
      setDate(clampDate(todayISO(), settings.trip_start, settings.trip_end));
    }
    setErrorMsg(null);
    setConfirmDelete(false);
  }, [open, payment, defaultFrom, defaultTo, defaultAmount, currency, settings]);

  const decimals = CURRENCIES[curr].decimalDigits;
  const total = Number(amount) || 0;

  const fromMember = activeMembers.find((m) => m.id === from);
  const toMember = activeMembers.find((m) => m.id === to);

  function validate(): string | null {
    if (!from) return 'Pick who paid';
    if (!to) return 'Pick who got paid';
    if (from === to) return 'Pick two different people';
    if (!(total > 0)) return 'Enter an amount greater than zero';
    if (!date) return 'Pick a date';
    return null;
  }

  async function handleSave() {
    setErrorMsg(null);
    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }
    const payload: NewExpenseInput = {
      date,
      category: PAYMENT_CATEGORY,
      amount: total,
      currency: curr,
      paid_by: from,
      split_mode: 'amount',
      split_data: { [to]: total },
    };
    try {
      setSubmitting(true);
      const saved = payment
        ? await api.updateExpense(payment.id, payload)
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
    if (!payment) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      await api.deleteExpense(payment.id);
      onSaved({ ...payment, deleted_at: new Date().toISOString() });
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
            <h2 className="text-lg font-bold">{isEdit ? 'Edit payment' : 'Settle up'}</h2>
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
            <section className="card-plush p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider opacity-60 mb-2">From</p>
                  {fromMember ? (
                    <Mascot name={fromMember.mascot} size="lg" />
                  ) : (
                    <span className="inline-flex h-14 w-14 rounded-full" style={{ background: 'var(--color-cream)' }} />
                  )}
                  <span className="text-xs font-semibold mt-2 truncate max-w-[80px]">{fromMember?.name ?? '—'}</span>
                </div>
                <ArrowRight size={20} className="opacity-50 shrink-0" />
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider opacity-60 mb-2">To</p>
                  {toMember ? (
                    <Mascot name={toMember.mascot} size="lg" />
                  ) : (
                    <span className="inline-flex h-14 w-14 rounded-full" style={{ background: 'var(--color-cream)' }} />
                  )}
                  <span className="text-xs font-semibold mt-2 truncate max-w-[80px]">{toMember?.name ?? '—'}</span>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60 px-1">From</p>
              <div className="grid grid-cols-3 gap-2">
                {activeMembers.map((m) => {
                  const sel = from === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setFrom(m.id)}
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

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60 px-1">To</p>
              <div className="grid grid-cols-3 gap-2">
                {activeMembers.map((m) => {
                  const sel = to === m.id;
                  const disabled = m.id === from;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setTo(m.id)}
                      disabled={disabled}
                      className={cn(
                        'card-plush flex flex-col items-center py-3 transition-transform',
                        sel && 'scale-[1.02]',
                        disabled && 'opacity-30',
                      )}
                      style={sel ? { boxShadow: '0 0 0 3px var(--color-mint-deep), 0 4px 16px -6px rgba(107,79,63,0.12)' } : undefined}
                    >
                      <Mascot name={m.mascot} size="md" selected={sel} />
                      <span className="text-xs font-semibold mt-2 truncate max-w-[80px]">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

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
                {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Record payment'}
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
                      : 'Delete payment'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
