import type { TripConfig } from './types';

export const tokyo: TripConfig = {
  id: 'tokyo',
  name: 'Travel Expenses Log',
  subtitle: 'Tokyo, May to Jun 2026',
  currencies: ['JPY', 'SGD', 'MYR'],
  defaultCurrency: 'SGD',
  loginImage: '/tokyo.png',
  apiUrlEnv: 'NEXT_PUBLIC_SHEETS_API_URL',
};
