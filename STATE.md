# Travel Log — Current State (compaction-proof working notes)

Update this file whenever a meaningful chunk of work is finished or a decision changes. New conversations should read this first.

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
