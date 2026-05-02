# Travel Log — Current State (compaction-proof working notes)

Update this file whenever a meaningful chunk of work is finished or a decision changes. New conversations should read this first.

## Active migration: Architecture Y (multitenant)

**Code complete on branch `multitenant`.** Both `NEXT_PUBLIC_TRIP=tokyo` and `NEXT_PUBLIC_TRIP=china` builds pass locally with zero TS errors. Awaiting user actions below before merge.

Goal: refactor the app to support N trips from one repo with config-driven trip switching, then add China as the second trip alongside Tokyo. Tokyo data, Tokyo Apps Script, and Tokyo's deployed URL all remain untouched.

**Architecture decision:** Architecture Y (config-driven multitenant) chosen over Architecture X (branch per trip) so that future trips cost only a config file + a secret + a matrix entry. One-time refactor cost is paid now; every subsequent trip is cheap.

**Layout after migration:**
- One `main` branch holds the multitenant code.
- `web/lib/trips/{tokyo,china,...}.ts` configs declare trip identity (id, name, dates, currencies, members, theme image, env-var name).
- GHA workflow is a matrix: one job per trip, each builds with `NEXT_PUBLIC_TRIP=<id>` and its own `NEXT_PUBLIC_BASE_PATH` and `NEXT_PUBLIC_SHEETS_API_URL` secret.
- Pages serves Tokyo at `/SplitNow/` and China at `/SplitNow/china/`. Future trips get their own subpath.
- Each trip has its own Google Sheet + Apps Script web-app deployment. Sheets cannot reach each other.

**Tokyo invariants (must hold across the migration):**
- Tokyo's Google Sheet columns stay named `amount_jpy/sgd/myr`.
- Tokyo's existing Apps Script deployment is **not** redeployed. The old hardcoded Code.gs keeps running. The new config-driven Code.gs in the repo is for fresh deployments only (China and future trips). Tokyo can be migrated to new Code.gs later if needed; it is not blocking.
- Tokyo's `/SplitNow/` Pages URL stays the same; only the build inputs (multitenant code + tokyo config) change. Build output is functionally equivalent.
- Tokyo's existing `SHEETS_API_URL` GHA secret stays as-is.

**China setup (user actions before merge):**
1. Open the China sheet's Apps Script editor (Extensions -> Apps Script).
2. Paste the contents of `apps-script/Code.gs`. The file already has `TRIP_CURRENCIES = ['CNY','SGD','MYR']`, `TRIP_INFO` for China dates, and a placeholder `DEFAULT_MEMBERS`. Edit `DEFAULT_MEMBERS` to the actual China member rows (id, name, Mascot, hex color, true) before running setup. The Mascot column must be one of: Duffy, ShellieMay, Gelatoni, StellaLou, CookieAnn, OluMel, LinaBell.
3. Run `setup()` once. Authorize when prompted.
4. Open the Settings sheet. Set the `passcode` row's value to the China trip passcode.
5. Deploy -> New deployment -> Web app. Execute as: Me. Who has access: Anyone. Copy the `/exec` URL.
6. Add a new GitHub repo secret named `SHEETS_API_URL_CHINA` with that URL. (Existing `SHEETS_API_URL` secret for Tokyo stays as-is.)
7. Merge `multitenant` branch to `main`. The GHA workflow's matrix deploys Tokyo at `/SplitNow/` and China at `/SplitNow/china/` in one Pages deployment.

**Future trips (post-China, when adding e.g. Korea):**
1. Create a Google Sheet for the new trip. Paste `apps-script/Code.gs`, edit `TRIP_CURRENCIES` / `DEFAULT_MEMBERS` / `TRIP_INFO`, run `setup()`, set passcode, deploy, copy `/exec` URL.
2. Add a new repo secret e.g. `SHEETS_API_URL_KOREA`.
3. Add `web/lib/trips/korea.ts` (copy `china.ts`, edit values).
4. Register it in `web/lib/trips/index.ts`'s `TRIPS` map and `TripId` union.
5. Add a matrix entry in `.github/workflows/pages.yml` (trip, base_path, out_subdir).
6. Bake the secret into the workflow `env:` block (alongside the Tokyo and China ones).

**China trip metadata:**
- Dates: 13 to 27 Jun 2026
- Currencies: CNY (default), SGD, MYR
- Members: TBD from China sheet (Gelatoni mascot is one; image at `assets/gelatoni.png`)
- Login image: `assets/china.png`
- New mascot wired: Gelatoni (palette already present, image was missing)

**Decision log:**
- Currency schema: keep column-name convention `amount_<lowercase>` rather than introduce `amount_by_currency` map. Tokyo's existing data is preserved unchanged.
- Tokyo Apps Script: don't redeploy. Old hardcoded code continues to serve Tokyo.
- localStorage: namespace per trip (`travel_log_<trip>_passcode`, etc.) to prevent collisions if a user visits both subpaths.
- API URL: each trip declares its env-var name in its config; `lib/api.ts` reads from `process.env[trip.apiUrlEnv]`.

**Migration tasks:** see in-conversation TaskList. Mirror order:
1. STATE.md updated (this section)
2. Currency layer + types generalized
3. Trip config layer
4. localStorage namespacing + API URL routing
5. Login + JPY epsilon callsites driven by config
6. Gelatoni + china.png assets
7. Apps Script Code.gs config-driven (repo only; Tokyo deploy untouched)
8. GHA workflow matrix
9. Local build verification (both trips)
10. User actions (China Apps Script setup, secret, merge)

## Status snapshot

| Layer | State | Location |
|---|---|---|
| Apps Script backend | ✅ deployed and verified | `apps-script/Code.gs` |
| Sheet | ✅ seeded (5 members, GOOGLEFINANCE rates, settings) | private — see local memory |
| Web URL | ✅ live | private — see local memory and `web/.env.production` (committed at deploy time) |
| Passcode | set in the spreadsheet's `Settings` sheet (never committed) | |
| Next.js scaffold | ✅ Next 16, React 19, Tailwind v4 | `web/` |
| Login screen | ✅ passcode + mascot picker | `web/app/login/page.tsx` |
| Dashboard | ✅ balance card, currency toggle, member strip, settlement list | `web/app/page.tsx` |
| Mascot component | ✅ pastel circle + initial placeholder | `web/components/Mascot.tsx` |
| Add/Edit expense | ✅ done | `web/components/ExpenseSheet.tsx` |
| Expenses list | ✅ done | `web/app/expenses/page.tsx` |
| Settings | ✅ done | `web/app/settings/page.tsx` |
| Bottom nav | ✅ done | `web/components/BottomNav.tsx` |
| Vercel deploy | ⏳ next step | |

## Routes (all prerender ✓ on `npm run build`)

- `/login` — passcode + mascot picker
- `/` — dashboard (balance card, currency toggle, member strip, settlement list, FAB add)
- `/expenses` — grouped-by-day list, tap-to-edit
- `/settings` — trip info, members, live FX rates, log out

## Verified

- Apps Script POST round-trip works via browser-fetch (Node 20 fetch confirms 302→200 follow with body intact). Test expense added, settlement computed, updated, soft-deleted, sheet now clean.
- `npm run build` exits 0 after Settings + BottomNav + ExpenseSheet integration.
- Note: curl misleadingly shows POST→302→405 because curl follows 302 with POST not GET; browser fetch follows with GET (per HTTP spec) and gets the JSON body. Don't trust curl for POST tests; use `node -e "fetch(...)"` instead.

## Locked decisions (cross-reference memory)

- 5 members fixed: Careen→StellaLou, Evelyn→LinaBell, Qi Hui→ShellieMay, Cheok→OluMel, Wan Qian→CookieAnn
- Currencies: JPY, SGD, MYR. Each expense stores original + snapshots in other two.
- FX via `GOOGLEFINANCE` in the Rates sheet, snapshot at entry time.
- Settlement: greedy creditor-debtor (Apps Script `greedyTransfers_`).
- Auth: shared passcode, server-side check.
- Edit allowed; soft delete (`deleted_at`).
- Theme: Duffy and Friends pastels, palette in `web/app/globals.css` (cream/peach/mint/lavender/blush/sky/sunny + cocoa).

## What is and isn't lifted from split-pro

Source: https://github.com/oss-apps/split-pro (cloned to /tmp/split-pro)

**Lifted (with credit comment in each file):**
- `web/lib/utils.ts` — cn() helper
- `web/lib/numbers.ts` — getCurrencyHelpers, BigMath, currencyConversion (BigInt-safe formatters)
- `web/lib/currency.ts` — only JPY/SGD/MYR rows kept (trimmed from 180+)

**Not lifted:**
- `simplify.ts` settlement (we have our own server-side `greedyTransfers_`)
- All tRPC/Prisma/NextAuth code (incompatible stack)

## Conventions

- Mobile first, max-w-md container in `app/layout.tsx`.
- Use `Mascot` component for all avatars. Don't ship Disney trademarked artwork.
- Use `formatMoney` / `shortMoney` from `lib/format.ts` for all currency display.
- All API calls go through `lib/api.ts`; never fetch the Apps Script URL directly.
- `passcode` and `actor` (current user id) live in `localStorage` via `lib/api.ts` helpers.
- POST requests use `Content-Type: text/plain` to avoid CORS preflight on Apps Script.

## Run

```bash
cd web
npm run dev    # http://localhost:3000
```

## Deploy (when ready)

1. `git init` in `web/` (or root).
2. Push to GitHub.
3. Vercel → Import → set `NEXT_PUBLIC_SHEETS_API_URL` env var.
