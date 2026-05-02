import type { TripConfig } from './types';

export const china: TripConfig = {
  id: 'china',
  name: 'Travel Expenses Log',
  subtitle: 'China, 13 to 27 Jun 2026',
  currencies: ['CNY', 'SGD', 'MYR'],
  defaultCurrency: 'CNY',
  loginImage: '/china.png',
  apiUrlEnv: 'NEXT_PUBLIC_SHEETS_API_URL_CHINA',
};
