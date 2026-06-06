import type { Expense, Member, Settlement, Balance, Transfer, Rates, Settings } from './types';
import type { CurrencyCode } from './currency';
import { amountKey, currencyDecimals } from './currency';

// Mirrors the greedy algorithm in apps-script/Code.gs (greedyTransfers_).
// Computing locally avoids a second server round-trip per refresh.

export function computeSettlement(
  expenses: Expense[],
  members: Member[],
  currency: CurrencyCode,
  rates?: Rates,
  settings?: Settings,
  // When provided, all math runs in this currency and results are converted to
  // `currency` for display. This keeps who-owes-whom stable across currency
  // toggles, and fixes split_mode:'amount' expenses whose split_data values
  // are in the original expense currency (not the display currency).
  settlementCurrency?: CurrencyCode,
): Settlement {
  const mathCur = settlementCurrency ?? currency;
  const col = amountKey(mathCur);
  const totals: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));

  for (const e of expenses) {
    if (e.deleted_at) continue;
    // Fund expenses are pre-funded communally in cash; they don't affect who
    // owes whom between members, so skip them entirely for settlement.
    if (e.paid_by === 'fund') continue;
    const total = Number(e[col]) || 0;

    // Credit payers. When payer_splits is present and has multiple entries,
    // distribute credit proportionally based on each payer's raw amount.
    let credited = false;
    if (e.payer_splits) {
      try {
        const ps = JSON.parse(e.payer_splits) as Record<string, number>;
        const ids = Object.keys(ps);
        if (ids.length > 1) {
          const rawTotal = ids.reduce((a, id) => a + (Number(ps[id]) || 0), 0);
          if (rawTotal > 0) {
            for (const id of ids) {
              totals[id] = (totals[id] ?? 0) + total * (Number(ps[id]) / rawTotal);
            }
            credited = true;
          }
        }
      } catch {
        // fall through to single-payer below
      }
    }
    if (!credited) {
      totals[e.paid_by] = (totals[e.paid_by] ?? 0) + total;
    }

    const shares = computeShares(e, total, members);
    for (const id of Object.keys(shares)) {
      totals[id] = (totals[id] ?? 0) - shares[id]!;
    }
  }

  const mathDp = currencyDecimals(mathCur);

  // Compute remaining fund balance in mathCur. When a holder is set, fold the
  // fund returns into the balance totals so the single greedy pass produces
  // the globally minimal transfer set.
  let fundRemainingInMathCur: number | undefined;
  const fundAmountPerPerson = Number(settings?.fund_amount_per_person) || 0;
  const fundCurrency = settings?.fund_currency as CurrencyCode | undefined;
  const activeMembers = members.filter((m) => m.active !== false);
  const N = activeMembers.length;

  if (fundAmountPerPerson > 0 && fundCurrency && N > 0) {
    const fundCol = amountKey(fundCurrency);
    const totalContributed = fundAmountPerPerson * N;
    const totalSpent = expenses
      .filter((e) => !e.deleted_at && e.paid_by === 'fund')
      .reduce((acc, e) => acc + (Number(e[fundCol]) || 0), 0);
    const remainingInFundCur = totalContributed - totalSpent;

    if (remainingInFundCur > 0) {
      const remaining =
        fundCurrency === mathCur
          ? remainingInFundCur
          : remainingInFundCur * (rates?.[fundCurrency + mathCur] ?? 1);
      fundRemainingInMathCur = round(remaining, mathDp);

      const holderId = settings?.fund_holder_id;
      if (holderId && holderId in totals) {
        const perPerson = round(fundRemainingInMathCur / N, mathDp);
        for (const m of activeMembers) {
          totals[m.id] = (totals[m.id] ?? 0) + perPerson;
        }
        totals[holderId] = (totals[holderId] ?? 0) - fundRemainingInMathCur;
      }
    }
  }

  const balancesInMathCur: Balance[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    mascot: m.mascot,
    net: round(totals[m.id] ?? 0, mathDp),
  }));
  const transfersInMathCur = greedy(balancesInMathCur, mathDp);

  // Convert math-currency amounts to display currency for output.
  const displayDp = currencyDecimals(currency);
  const convRate = mathCur === currency ? 1 : (rates?.[mathCur + currency] ?? 1);

  const balances = balancesInMathCur.map((b) => ({
    ...b,
    net: round(b.net * convRate, displayDp),
  }));
  const transfers = transfersInMathCur.map((t) => ({
    ...t,
    amount: round(t.amount * convRate, displayDp),
  }));
  const fundRemaining =
    fundRemainingInMathCur != null
      ? round(fundRemainingInMathCur * convRate, displayDp)
      : undefined;

  return { currency, balances, transfers, fundRemaining };
}

function computeShares(e: Expense, total: number, members: Member[]): Record<string, number> {
  let split: Record<string, number> = {};
  try {
    split = JSON.parse(e.split_data || '{}');
  } catch {
    split = {};
  }
  const out: Record<string, number> = {};

  if (e.split_mode === 'equal') {
    const ids = Object.keys(split).length ? Object.keys(split) : members.map((m) => m.id);
    const each = total / ids.length;
    for (const id of ids) out[id] = each;
    return out;
  }
  if (e.split_mode === 'amount') {
    // split_data values are in the original expense currency, not the
    // settlement currency. Normalise by the original total so each person's
    // share scales correctly with whatever settlement currency is in use.
    const origTotal = Number(e.amount) || 0;
    for (const id of Object.keys(split)) {
      out[id] = origTotal > 0 ? total * (Number(split[id]) / origTotal) : 0;
    }
    return out;
  }
  if (e.split_mode === 'percent') {
    for (const id of Object.keys(split)) out[id] = (total * (Number(split[id]) || 0)) / 100;
    return out;
  }
  return out;
}

function greedy(balances: Balance[], dp: number): Transfer[] {
  const eps = dp === 0 ? 0.5 : 0.005;
  const arr = balances.map((b) => ({ ...b }));
  const transfers: Transfer[] = [];

  while (true) {
    arr.sort((a, b) => a.net - b.net);
    const debtor = arr[0]!;
    const creditor = arr[arr.length - 1]!;
    if (creditor.net <= eps || debtor.net >= -eps) break;
    const amount = round(Math.min(creditor.net, -debtor.net), dp);
    if (amount <= eps) break;

    transfers.push({
      from: debtor.id,
      from_name: debtor.name,
      from_mascot: debtor.mascot,
      to: creditor.id,
      to_name: creditor.name,
      to_mascot: creditor.mascot,
      amount,
    });

    debtor.net = round(debtor.net + amount, dp);
    creditor.net = round(creditor.net - amount, dp);
  }
  return transfers;
}

function round(n: number, dp: number): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
