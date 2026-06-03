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
  // Shared fund: each member contributes this amount (in fund_currency) to a
  // pooled wallet. Leave both blank to disable the feature entirely.
  fund_amount_per_person?: number;
  fund_currency?: string;
  // Who is physically holding the remaining fund cash at trip end. When set,
  // the remaining fund balance is folded into the greedy settlement so the
  // holder's debt/credit absorbs the fund returns automatically.
  fund_holder_id?: string;
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
  // JSON map of { memberId: amountInOriginalCurrency } when multiple people
  // split the payment. When present, credits are distributed proportionally
  // across payers; paid_by holds the primary payer for display/compat.
  payer_splits?: string;
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
  // Remaining fund balance in the settlement currency. Populated when
  // fund_amount_per_person is set and remaining > 0. Used by the UI to
  // prompt for a fund holder.
  fundRemaining?: number;
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
