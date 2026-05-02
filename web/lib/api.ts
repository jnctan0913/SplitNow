import type { Bootstrap, Expense, ItineraryItem, Settlement, Rates, SplitMode } from './types';

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

export function applyItineraryChange(
  list: ItineraryItem[],
  change: ItineraryItem,
): ItineraryItem[] {
  if (change.deleted_at) return list.filter((i) => i.id !== change.id);
  const idx = list.findIndex((i) => i.id === change.id);
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
const BOOT_CACHE_KEY = 'travel_log_bootstrap_cache_v1';
const ITIN_CACHE_KEY = 'travel_log_itinerary_cache_v1';

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

function readBootCache(): Bootstrap | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: Bootstrap };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeBootCache(data: Bootstrap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOOT_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function clearBootCache() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BOOT_CACHE_KEY);
}

export function readItineraryCache(): ItineraryItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ITIN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: ItineraryItem[] };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeItineraryCache(data: ItineraryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ITIN_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function clearItineraryCache() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ITIN_CACHE_KEY);
}

export const api = {
  verify: (code: string) => post<{ ok: true }>('verify', { passcode: code }),
  // Always hits the network. Use bootstrapCached for stale-while-revalidate.
  bootstrap: () => get<Bootstrap>('bootstrap').then((b) => { writeBootCache(b); return b; }),
  bootstrapCache: readBootCache,
  listExpenses: () => get<Expense[]>('expenses'),
  rates: () => get<Rates>('rates'),
  settlement: (currency: CurrencyCode) => get<Settlement>('settlement', { currency }),
  addExpense: (expense: NewExpenseInput) => post<Expense>('addExpense', { expense }),
  updateExpense: (id: string, fields: Partial<NewExpenseInput>) =>
    post<Expense>('updateExpense', { id, fields }),
  deleteExpense: (id: string) => post<{ id: string; deleted: true }>('deleteExpense', { id }),
  itinerary: () => get<ItineraryItem[]>('itinerary').then((items) => { writeItineraryCache(items); return items; }),
  addItinerary: (item: NewItineraryInput) => post<ItineraryItem>('addItinerary', { item }),
  updateItinerary: (id: string, fields: Partial<NewItineraryInput>) =>
    post<ItineraryItem>('updateItinerary', { id, fields }),
  deleteItinerary: (id: string) => post<{ id: string; deleted: true }>('deleteItinerary', { id }),
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

export interface NewItineraryInput {
  day_num: number;
  date: string;
  time?: string;
  time_fixed?: boolean;
  title: string;
  notes?: string;
  category: string;
  map_url?: string;
  link?: string;
  cost_note?: string;
  position?: number;
}
