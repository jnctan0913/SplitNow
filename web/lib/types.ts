import type { CurrencyCode } from './currency';

export type SplitMode = 'equal' | 'amount' | 'percent';

export type Mascot = 'Duffy' | 'ShellieMay' | 'Gelatoni' | 'StellaLou' | 'CookieAnn' | 'OluMel' | 'LinaBell';

export interface Member {
  id: string;
  name: string;
  mascot: Mascot;
  color: string;
  active: boolean;
}

export interface Settings {
  trip_name: string;
  trip_start: string;
  trip_end: string;
  categories: string[];
  // Free-form markdown-ish text rendered as the "Itinerary tips" card on
  // the Settings page. Lives in the source sheet so it's editable without
  // a redeploy. Optional; section is hidden when empty.
  itinerary_help?: string;
}

// Pair keys are `${from}${to}` like 'JPYSGD'. Per-trip rate set is determined
// by the active trip's currencies, so we don't enumerate them in the type.
export type Rates = Record<string, number>;

export interface Expense {
  id: string;
  created_at: string;
  updated_at: string;
  date: string;
  day_num: number;
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  paid_by: string;
  split_mode: SplitMode;
  split_data: string;
  last_edited_by: string;
  deleted_at: string;
  // Snapshot amounts in each of the trip's currencies, keyed as
  // `amount_<lowercase code>` (e.g. amount_jpy, amount_sgd, amount_cny).
  // Which keys are present is determined by the trip config at runtime.
  [amountKey: `amount_${string}`]: number | undefined;
}

export interface Bootstrap {
  members: Member[];
  settings: Settings;
  rates: Rates;
  expenses: Expense[];
}

export interface Transfer {
  from: string;
  from_name: string;
  from_mascot: Mascot;
  to: string;
  to_name: string;
  to_mascot: Mascot;
  amount: number;
}

export interface Balance {
  id: string;
  name: string;
  mascot: Mascot;
  net: number;
}

export interface Settlement {
  currency: CurrencyCode;
  balances: Balance[];
  transfers: Transfer[];
}

export interface ItineraryItem {
  id: string;
  created_at: string;
  updated_at: string;
  day_num: number;
  date: string;
  time: string;
  time_fixed: boolean;
  title: string;
  notes: string;
  category: string;
  map_url: string;
  link: string;
  cost_note: string;
  position: number;
  last_edited_by: string;
  deleted_at: string;
}
