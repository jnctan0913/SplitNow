import type { TripConfig, TripId } from './types';
import { tokyo } from './tokyo';
import { china } from './china';

export const TRIPS: Record<TripId, TripConfig> = { tokyo, china };

// Resolved at build time from NEXT_PUBLIC_TRIP. Defaults to tokyo so the
// existing single-trip dev experience keeps working with no env var set.
const TRIP_ID = (process.env.NEXT_PUBLIC_TRIP as TripId | undefined) ?? 'tokyo';

if (!TRIPS[TRIP_ID]) {
  throw new Error(
    `Unknown NEXT_PUBLIC_TRIP="${TRIP_ID}". Add a config in web/lib/trips and register it in trips/index.ts.`,
  );
}

export const trip: TripConfig = TRIPS[TRIP_ID];

export type { TripConfig, TripId };
