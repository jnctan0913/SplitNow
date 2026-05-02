import type { CurrencyCode } from '../currency';

export type TripId = 'tokyo' | 'china';

export interface TripConfig {
  id: TripId;
  name: string;
  subtitle: string;
  // Three currencies the trip operates in. First entry is the default.
  // Must match the column convention used in the trip's Apps Script
  // (each Apps Script copy has its own TRIP_CURRENCIES constant).
  currencies: readonly [CurrencyCode, CurrencyCode, CurrencyCode];
  defaultCurrency: CurrencyCode;
  // Path under web/public for the login hero image.
  loginImage: string;
  // Path prefix under web/public for the trip's icon set. The build expects
  // three files at this prefix: `<iconBase>-icon.png` (512x512),
  // `<iconBase>-apple-icon.png` (180x180), `<iconBase>-favicon.png` (32x32).
  iconBase: string;
  // Name of the build-time env var that holds this trip's Apps Script /exec URL.
  // GHA secret with this name is injected during `next build`.
  apiUrlEnv: string;
}
