import { CURRENCIES, type CurrencyCode } from './currency';

const formatters = new Map<CurrencyCode, Intl.NumberFormat>();

function fmt(currency: CurrencyCode) {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: CURRENCIES[currency].decimalDigits,
    });
    formatters.set(currency, f);
  }
  return f;
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  if (!Number.isFinite(amount)) return '';
  return fmt(currency).format(amount);
}

export function shortMoney(amount: number, currency: CurrencyCode): string {
  // Compact for dashboards: "S$ 1.2k", "¥120k"
  const abs = Math.abs(amount);
  const sym = CURRENCIES[currency].symbol;
  if (abs >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000)    return `${sym}${Math.round(amount / 1000)}k`;
  if (abs >= 1_000)     return `${sym}${(amount / 1000).toFixed(1)}k`;
  return formatMoney(amount, currency);
}
