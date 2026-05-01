# Travel Log

Mobile-first webapp to track shared travel expenses across multiple currencies (MYR, SGD, JPY) and compute Splitwise-style settlements. Hosted on Vercel. Backend is a Google Sheet driven by Apps Script.

## Stack (proposed, not yet locked)

- Next.js (App Router) on Vercel
- TypeScript, Tailwind CSS, shadcn/ui (mobile-first)
- Google Sheets as DB via Apps Script Web App (HTTPS POST/GET endpoints)
- Auth: shared trip passcode for v1 (no per-user accounts)

## Data model (mirrors the Expenses sheet)

- **Trip**: name, start/end date, base currency, members[]
- **Member**: name (e.g. Careen, Evelyn, Cheok, Qi Hui, Wan Qian)
- **Expense**: date, day#, category (Accommodation, Transport, Entertainment, Food, Other), description, amount, currency, paid_by, split_among[] (default = all members), fx_rate_to_base
- **Settlement**: derived (greedy creditor-debtor matching), not stored

## Conventions

- Stick to the global writing rules in `~/.claude/CLAUDE.md` (no em/en dashes, surgical changes, simplicity first).
- Do not commit Google service account keys or Apps Script deployment IDs. Store as Vercel env vars.
- Apps Script endpoint URL goes in `.env.local` as `NEXT_PUBLIC_SHEETS_API_URL` (it is public anyway because it ships to the client).
- All amounts stored in original currency + computed base-currency value at entry time. Don't recompute historic FX.

## Theme

Duffy and Friends pastel aesthetic. Soft cream/peach/mint/lavender palette, rounded corners, plush-toy mascots as category icons.

## Reference

- Original spreadsheet: `Tokyo_26th_May_-_2nd_June_2026.xlsx` (Expenses sheet has the canonical column layout and tally formulas).
- Inspiration: https://github.com/oss-apps/split-pro
