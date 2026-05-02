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
}

export interface Rates {
  JPYSGD: number;
  SGDJPY: number;
  JPYMYR: number;
  MYRJPY: number;
  SGDMYR: number;
  MYRSGD: number;
}

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
  amount_jpy: number;
  amount_sgd: number;
  amount_myr: number;
  paid_by: string;
  split_mode: SplitMode;
  split_data: string;
  last_edited_by: string;
  deleted_at: string;
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
