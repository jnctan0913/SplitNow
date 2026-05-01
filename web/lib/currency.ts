// Trimmed from split-pro's CURRENCIES (https://github.com/oss-apps/split-pro)
// We only need the three trip currencies.

export const CURRENCIES = {
  JPY: { symbol: '¥',  symbolNative: '￥', decimalDigits: 0, rounding: 0, code: 'JPY' },
  SGD: { symbol: 'S$', symbolNative: '$',  decimalDigits: 2, rounding: 0, code: 'SGD' },
  MYR: { symbol: 'RM', symbolNative: 'RM', decimalDigits: 2, rounding: 0, code: 'MYR' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export const isCurrencyCode = (value?: string | null): value is CurrencyCode =>
  !!value && value in CURRENCIES;

export const parseCurrencyCode = (code: string): CurrencyCode =>
  isCurrencyCode(code) ? code : 'SGD';
