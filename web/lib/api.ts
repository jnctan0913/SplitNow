import type { Bootstrap, Expense, Settlement, Rates, SplitMode } from './types';

export function applyExpenseChange(list: Expense[], change: Expense): Expense[] {
  if (change.deleted_at) return list.filter((e) => e.id !== change.id);
  const idx = list.findIndex((e) => e.id === change.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = change;
    return next;
  }
  return [change, ...list];
}

import type { CurrencyCode } from './currency';

const API_URL = process.env.NEXT_PUBLIC_SHEETS_API_URL!;

if (!API_URL) {
  // Will only fire on the server during build if env is missing.
  console.warn('NEXT_PUBLIC_SHEETS_API_URL is not set');
}

const PASSCODE_KEY = 'travel_log_passcode';
const ACTOR_KEY = 'travel_log_actor';

export const passcode = {
  get: () => (typeof window === 'undefined' ? '' : localStorage.getItem(PASSCODE_KEY) ?? ''),
  set: (v: string) => localStorage.setItem(PASSCODE_KEY, v),
  clear: () => localStorage.removeItem(PASSCODE_KEY),
};

export const actor = {
  get: () => (typeof window === 'undefined' ? '' : localStorage.getItem(ACTOR_KEY) ?? ''),
  set: (id: string) => localStorage.setItem(ACTOR_KEY, id),
  clear: () => localStorage.removeItem(ACTOR_KEY),
};

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function get<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const u = new URL(API_URL);
  u.searchParams.set('action', action);
  u.searchParams.set('passcode', passcode.get());
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u.toString(), { method: 'GET' });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data as T;
}

async function post<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  // text/plain to avoid CORS preflight on Apps Script
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, passcode: passcode.get(), actor: actor.get(), ...payload }),
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data as T;
}

export const api = {
  verify: (code: string) => post<{ ok: true }>('verify', { passcode: code }),
  bootstrap: () => get<Bootstrap>('bootstrap'),
  listExpenses: () => get<Expense[]>('expenses'),
  rates: () => get<Rates>('rates'),
  settlement: (currency: CurrencyCode) => get<Settlement>('settlement', { currency }),
  addExpense: (expense: NewExpenseInput) => post<Expense>('addExpense', { expense }),
  updateExpense: (id: string, fields: Partial<NewExpenseInput>) =>
    post<Expense>('updateExpense', { id, fields }),
  deleteExpense: (id: string) => post<{ id: string; deleted: true }>('deleteExpense', { id }),
};

export interface NewExpenseInput {
  date: string;
  day_num?: number;
  category: string;
  description?: string;
  amount: number;
  currency: CurrencyCode;
  paid_by: string;
  split_mode: SplitMode;
  split_data: Record<string, number>;
}
