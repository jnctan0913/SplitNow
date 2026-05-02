import type { Bootstrap, Expense, ItineraryItem, Settlement, Rates, SplitMode } from './types';
import { trip } from './trips';

export function applyExpenseChange(list: Expense[], change: Expense | null | undefined): Expense[] {
  if (!change) return list;
  if (change.deleted_at) return list.filter((e) => e && e.id !== change.id);
  const idx = list.findIndex((e) => e && e.id === change.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = change;
    return next;
  }
  return [change, ...list];
}

export function applyItineraryChange(
  list: ItineraryItem[],
  change: ItineraryItem | null | undefined,
): ItineraryItem[] {
  if (!change) return list;
  if (change.deleted_at) return list.filter((i) => i && i.id !== change.id);
  const idx = list.findIndex((i) => i && i.id === change.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = change;
    return next;
  }
  return [change, ...list];
}

import type { CurrencyCode } from './currency';

// Each trip declares which env var holds its Apps Script /exec URL. This is
// read at build time so the static export bundles the right URL per trip.
const API_URL =
  (trip.apiUrlEnv === 'NEXT_PUBLIC_SHEETS_API_URL'
    ? process.env.NEXT_PUBLIC_SHEETS_API_URL
    : trip.apiUrlEnv === 'NEXT_PUBLIC_SHEETS_API_URL_CHINA'
      ? process.env.NEXT_PUBLIC_SHEETS_API_URL_CHINA
      : undefined) ?? '';

if (!API_URL) {
  // Will only fire on the server during build if env is missing.
  console.warn(`${trip.apiUrlEnv} is not set for trip "${trip.id}"`);
}

// localStorage keys are namespaced per trip so visiting multiple subpaths
// (e.g. /SplitNow/ and /SplitNow/china/) doesn't cross-contaminate state.
const PASSCODE_KEY      = `travel_log_${trip.id}_passcode`;
const ACTOR_KEY         = `travel_log_${trip.id}_actor`;
const BOOT_CACHE_KEY    = `travel_log_${trip.id}_bootstrap_cache_v1`;
const ITIN_CACHE_KEY    = `travel_log_${trip.id}_itinerary_cache_v2`;

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
    if (!Array.isArray(parsed.data)) return null;
    // Scrub null/undefined entries that may have been written by older
    // builds; downstream code accesses .deleted_at without further guards.
    return parsed.data.filter((i): i is ItineraryItem => !!i);
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
  itinerary: () => get<ItineraryItem[]>('itinerary').then((items) => {
    const clean = Array.isArray(items) ? items.filter((i): i is ItineraryItem => !!i) : [];
    writeItineraryCache(clean);
    return clean;
  }),
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
