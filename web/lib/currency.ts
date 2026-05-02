// Trimmed from split-pro's CURRENCIES (https://github.com/oss-apps/split-pro)
// We keep one row per trip currency. Add more here as new trips arrive.

export const CURRENCIES = {
  JPY: { symbol: '¥',  symbolNative: '￥', decimalDigits: 0, rounding: 0, code: 'JPY' },
  SGD: { symbol: 'S$', symbolNative: '$',  decimalDigits: 2, rounding: 0, code: 'SGD' },
  MYR: { symbol: 'RM', symbolNative: 'RM', decimalDigits: 2, rounding: 0, code: 'MYR' },
  CNY: { symbol: '¥',  symbolNative: '￥', decimalDigits: 2, rounding: 0, code: 'CNY' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export const isCurrencyCode = (value?: string | null): value is CurrencyCode =>
  !!value && value in CURRENCIES;

export const parseCurrencyCode = (code: string): CurrencyCode =>
  isCurrencyCode(code) ? code : 'SGD';

// Smallest representable unit for a currency (1 for JPY, 0.01 otherwise).
// Used for settlement epsilons and "fully settled" thresholds.
export const currencyEpsilon = (code: CurrencyCode): number =>
  Math.pow(10, -CURRENCIES[code].decimalDigits);

// Decimal precision for rounding amounts in this currency.
export const currencyDecimals = (code: CurrencyCode): number =>
  CURRENCIES[code].decimalDigits;

// Column key on the Expense row for this currency's snapshot amount.
export const amountKey = (code: CurrencyCode): `amount_${string}` =>
  `amount_${code.toLowerCase()}`;
