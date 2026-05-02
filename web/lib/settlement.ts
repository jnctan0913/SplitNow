import type { Expense, Member, Settlement, Balance, Transfer } from './types';
import type { CurrencyCode } from './currency';
import { amountKey, currencyDecimals } from './currency';

// Mirrors the greedy algorithm in apps-script/Code.gs (greedyTransfers_).
// Computing locally avoids a second server round-trip per refresh.

export function computeSettlement(
  expenses: Expense[],
  members: Member[],
  currency: CurrencyCode,
): Settlement {
  const col = amountKey(currency);
  const totals: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));

  for (const e of expenses) {
    if (e.deleted_at) continue;
    const total = Number(e[col]) || 0;
    totals[e.paid_by] = (totals[e.paid_by] ?? 0) + total;

    const shares = computeShares(e, total, members);
    for (const id of Object.keys(shares)) {
      totals[id] = (totals[id] ?? 0) - shares[id]!;
    }
  }

  const dp = currencyDecimals(currency);
  const balances: Balance[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    mascot: m.mascot,
    net: round(totals[m.id] ?? 0, dp),
  }));
  const transfers = greedy(balances, dp);
  return { currency, balances, transfers };
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
    for (const id of Object.keys(split)) out[id] = Number(split[id]) || 0;
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
