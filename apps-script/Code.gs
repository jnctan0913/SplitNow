/**
 * SplitNow - Google Apps Script backend.
 *
 * One-time setup (per trip):
 *   1. Edit TRIP_CURRENCIES below for this trip (3-tuple, default first).
 *   2. Edit DEFAULT_MEMBERS for this trip's travelers.
 *   3. Edit TRIP_INFO (name, dates) for this trip.
 *   4. Paste this file into the Apps Script editor of the trip's spreadsheet.
 *   5. Run setup() once (Run -> setup). Authorize when prompted.
 *   6. Open the Settings sheet and set 'passcode' to your chosen code.
 *   7. Deploy -> New deployment -> Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *      Copy the /exec URL into the GHA secret for this trip
 *      (e.g. SHEETS_API_URL for tokyo, SHEETS_API_URL_CHINA for china).
 *   8. After any code change, Deploy -> Manage deployments -> Edit -> New version.
 *
 * Note: Tokyo's existing deployment runs an older hardcoded version of this
 * file (JPY/SGD/MYR baked in). Don't redeploy Tokyo unless you intentionally
 * want to migrate it to this currency-config-driven version. The column
 * conventions are identical, so a migration would be safe but not required.
 */

// =====================================================================
// TRIP CONFIG - edit these per trip
// =====================================================================

const TRIP_CURRENCIES = ['CNY', 'SGD', 'MYR']; // default currency = first
const DEFAULT_MEMBERS = [
  ['m1', 'Careen',    'StellaLou',  '#D8C8E8', true],
  ['m2', 'Justina',   'LinaBell',   '#FFCCD5', true],
  ['m3', 'Irene',     'ShellieMay', '#F8C8C8', true],
  ['m4', 'Justin',    'OluMel',     '#C8E6D0', true],
  ['m5', 'Lily',      'CookieAnn',  '#FFE9A8', true],
  ['m6', 'Catherine', 'Gelatoni',   '#A8DDF0', true],
];
const TRIP_INFO = {
  name:  'China Jun 2026',
  start: '2026-06-13',
  end:   '2026-06-27',
};

// =====================================================================
// DERIVED CONSTANTS - do not edit
// =====================================================================

const SHEETS = {
  members: 'Members',
  expenses: 'Expenses',
  rates: 'Rates',
  settings: 'Settings',
  itinerary: 'Itinerary',
};

const AMOUNT_COLS = TRIP_CURRENCIES.map(function (c) { return 'amount_' + c.toLowerCase(); });

const EXPENSE_HEADERS = [
  'id', 'created_at', 'updated_at', 'date', 'day_num',
  'category', 'description',
  'amount', 'currency',
].concat(AMOUNT_COLS).concat([
  'paid_by', 'split_mode', 'split_data',
  'last_edited_by', 'deleted_at',
]);

const MEMBER_HEADERS = ['id', 'name', 'mascot', 'color', 'active'];
const RATES_HEADERS = ['pair', 'rate', 'updated_at'];
const SETTINGS_HEADERS = ['key', 'value', 'description'];

const ITINERARY_HEADERS = [
  'id', 'created_at', 'updated_at',
  'day_num', 'date', 'time', 'time_fixed',
  'title', 'notes', 'category',
  'map_url', 'link', 'cost_note',
  'position',
  'last_edited_by', 'deleted_at',
];

const DEFAULT_CATEGORIES = ['Accommodation', 'Transport', 'Entertainment', 'Food', 'Shopping', 'Other'];

const DEFAULT_ITINERARY_HELP = [
  'You can bulk-add itinerary items by editing the Itinerary tab directly in this spreadsheet.',
  '',
  'Required columns: day_num, date, title, category.',
  'Optional: time, notes, map_url, link, cost_note, position.',
  '',
  'For tap-to-edit and tap-to-delete to work, every row needs a unique value in column A (id). Easiest: paste this into A2, copy down, then paste-as-values to freeze it:',
  '=CONCATENATE("i_", TEXT(NOW(),"yyyymmddhhmmss"), "_", ROW())',
  '',
  'Set time_fixed to TRUE if the time is exact, leave blank for "approximate". Leave created_at, updated_at, last_edited_by, deleted_at empty.',
].join('\n');

// All from->to pairs across the trip's currencies. e.g. for [CNY,SGD,MYR] this
// produces CNYSGD, SGDCNY, CNYMYR, MYRCNY, SGDMYR, MYRSGD.
const RATE_PAIRS = (function () {
  const pairs = [];
  for (let i = 0; i < TRIP_CURRENCIES.length; i++) {
    for (let j = 0; j < TRIP_CURRENCIES.length; j++) {
      if (i === j) continue;
      pairs.push(TRIP_CURRENCIES[i] + TRIP_CURRENCIES[j]);
    }
  }
  return pairs;
})();

// Decimal digits per currency. JPY is the only zero-decimal one we care about
// today; extend this map if a future trip uses another zero-decimal currency.
const DECIMALS_BY_CURRENCY = { JPY: 0, SGD: 2, MYR: 2, CNY: 2, USD: 2, EUR: 2 };
function decimalsFor_(c) { return DECIMALS_BY_CURRENCY[c] != null ? DECIMALS_BY_CURRENCY[c] : 2; }

// =====================================================================
// SETUP
// =====================================================================

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEETS.members,   MEMBER_HEADERS);
  ensureSheet_(ss, SHEETS.expenses,  EXPENSE_HEADERS);
  ensureSheet_(ss, SHEETS.rates,     RATES_HEADERS);
  ensureSheet_(ss, SHEETS.settings,  SETTINGS_HEADERS);
  ensureSheet_(ss, SHEETS.itinerary, ITINERARY_HEADERS);

  seedMembersIfEmpty_(ss);
  seedRatesIfEmpty_(ss);
  seedSettingsIfEmpty_(ss);
  forceTextColumns_(ss);

  SpreadsheetApp.getUi().alert(
    'Setup complete.\n\n' +
    '1. Open Settings sheet and set passcode.\n' +
    '2. Deploy -> New deployment -> Web app (Execute: Me, Access: Anyone).\n' +
    '3. Copy the /exec URL into the Next.js app.'
  );
}

function forceTextColumns_(ss) {
  // Stop Sheets from auto-converting human-readable time/date strings into
  // Date cells. Without this, "9:30AM" gets re-serialized as a 1899 ISO
  // datetime that drifts under the modern timezone offset.
  const sh = ss.getSheetByName(SHEETS.itinerary);
  if (!sh) return;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const cols = ['date', 'time'];
  cols.forEach((h) => {
    const idx = headers.indexOf(h);
    if (idx === -1) return;
    sh.getRange(1, idx + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  });
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return;
  }
  // Idempotent column migration: append any new headers that aren't yet on the
  // sheet so older deployments pick up new schema fields without losing data.
  const lastCol = sh.getLastColumn();
  const existing = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = headers.filter((h) => existing.indexOf(h) === -1);
  if (missing.length) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

function seedMembersIfEmpty_(ss) {
  const sh = ss.getSheetByName(SHEETS.members);
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, DEFAULT_MEMBERS.length, MEMBER_HEADERS.length).setValues(DEFAULT_MEMBERS);
}

function seedRatesIfEmpty_(ss) {
  const sh = ss.getSheetByName(SHEETS.rates);
  if (sh.getLastRow() > 1) return;
  const rows = RATE_PAIRS.map(p => {
    const from = p.slice(0, 3), to = p.slice(3, 6);
    return [p, `=GOOGLEFINANCE("CURRENCY:${from}${to}")`, '=NOW()'];
  });
  sh.getRange(2, 1, rows.length, RATES_HEADERS.length).setValues(rows);
}

function seedSettingsIfEmpty_(ss) {
  const sh = ss.getSheetByName(SHEETS.settings);
  if (sh.getLastRow() > 1) return;
  const rows = [
    ['passcode',       'CHANGE_ME',                       'Shared passcode required for all writes - update before sharing'],
    ['trip_name',      TRIP_INFO.name,                    'Display name'],
    ['trip_start',     TRIP_INFO.start,                   'ISO date'],
    ['trip_end',       TRIP_INFO.end,                     'ISO date'],
    ['categories',     JSON.stringify(DEFAULT_CATEGORIES), 'JSON array of expense categories'],
    ['itinerary_help', DEFAULT_ITINERARY_HELP,             'Free-form text shown on the Settings page; edit anytime, no redeploy needed'],
  ];
  sh.getRange(2, 1, rows.length, SETTINGS_HEADERS.length).setValues(rows);
}

// =====================================================================
// HTTP HANDLERS
// =====================================================================

const GET_ACTIONS_REQUIRING_PASSCODE = {
  bootstrap: true, expenses: true, rates: true, settlement: true, itinerary: true,
};

function doGet(e) {
  return handle_(e, (params) => {
    const action = params.action;
    if (action === 'bootstrap')  return bootstrap_();
    if (action === 'expenses')   return listExpenses_();
    if (action === 'rates')      return getRates_();
    if (action === 'settlement') return computeSettlement_(params.currency || 'SGD');
    if (action === 'itinerary')  return listItinerary_();
    throw new Error('Unknown action: ' + action);
  });
}

function doPost(e) {
  return handle_(e, () => {
    const body = JSON.parse(e.postData.contents || '{}');
    requirePasscode_(body.passcode);
    const action = body.action;
    if (action === 'addExpense')      return addExpense_(body.expense, body.actor);
    if (action === 'updateExpense')   return updateExpense_(body.id, body.fields, body.actor);
    if (action === 'deleteExpense')   return deleteExpense_(body.id, body.actor);
    if (action === 'addItinerary')    return addItinerary_(body.item, body.actor);
    if (action === 'updateItinerary') return updateItinerary_(body.id, body.fields, body.actor);
    if (action === 'deleteItinerary') return deleteItinerary_(body.id, body.actor);
    if (action === 'verify')          return { ok: true };
    throw new Error('Unknown action: ' + action);
  });
}

function handle_(e, fn) {
  try {
    const params = (e && e.parameter) || {};
    if (GET_ACTIONS_REQUIRING_PASSCODE[params.action]) {
      requirePasscode_(params.passcode);
    }
    const out = fn(params);
    return json_({ ok: true, data: out });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function requirePasscode_(provided) {
  const expected = getSetting_('passcode');
  if (!expected) throw new Error('Passcode not configured. Set Settings.passcode.');
  if (String(provided || '') !== String(expected)) throw new Error('Invalid passcode');
}

// =====================================================================
// READ
// =====================================================================

function bootstrap_() {
  return {
    members:    listMembers_(),
    settings:   listSettings_(),
    rates:      getRates_(),
    expenses:   listExpenses_(),
  };
}

function listMembers_() {
  return readSheet_(SHEETS.members).filter(r => r.active === true || r.active === 'TRUE');
}

function listSettings_() {
  const rows = readSheet_(SHEETS.settings);
  const out = {};
  rows.forEach(r => { out[r.key] = r.value; });
  if (out.categories) {
    try { out.categories = JSON.parse(out.categories); } catch (_) {}
  }
  delete out.passcode; // never leak
  return out;
}

function listExpenses_() {
  return readSheet_(SHEETS.expenses).filter(r => !r.deleted_at);
}

function getRates_() {
  const rows = readSheet_(SHEETS.rates);
  const out = {};
  rows.forEach(r => { out[r.pair] = Number(r.rate); });
  return out;
}

function getSetting_(key) {
  const sh = sheet_(SHEETS.settings);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

// =====================================================================
// WRITE - EXPENSES
// =====================================================================

function addExpense_(expense, actor) {
  validateExpense_(expense);
  const id = 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();
  const snaps = computeSnapshots_(expense.amount, expense.currency);

  const row = EXPENSE_HEADERS.map(h => {
    if (h.indexOf('amount_') === 0) {
      const cur = h.slice('amount_'.length).toUpperCase();
      return snaps[cur] != null ? snaps[cur] : '';
    }
    switch (h) {
      case 'id':              return id;
      case 'created_at':      return now;
      case 'updated_at':      return now;
      case 'date':            return expense.date;
      case 'day_num':         return expense.day_num || dayNumFromDate_(expense.date);
      case 'category':        return expense.category;
      case 'description':     return expense.description || '';
      case 'amount':          return Number(expense.amount);
      case 'currency':        return expense.currency;
      case 'paid_by':         return expense.paid_by;
      case 'split_mode':      return expense.split_mode;
      case 'split_data':      return JSON.stringify(expense.split_data || {});
      case 'last_edited_by':  return actor || '';
      case 'deleted_at':      return '';
      default:                return '';
    }
  });

  sheet_(SHEETS.expenses).appendRow(row);
  return findExpenseById_(id);
}

function updateExpense_(id, fields, actor) {
  const sh = sheet_(SHEETS.expenses);
  const rowIdx = findRowIndexById_(sh, id);
  if (rowIdx === -1) throw new Error('Expense not found: ' + id);

  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const current = sh.getRange(rowIdx, 1, 1, headerRow.length).getValues()[0];
  const get = (h) => current[headerRow.indexOf(h)];
  const set = (h, v) => { current[headerRow.indexOf(h)] = v; };

  // If amount or currency changed, re-snapshot
  const amountChanged   = fields.amount   !== undefined && Number(fields.amount)   !== Number(get('amount'));
  const currencyChanged = fields.currency !== undefined && fields.currency        !== get('currency');

  Object.keys(fields).forEach(k => {
    if (!EXPENSE_HEADERS.includes(k)) return;
    if (k === 'split_data') set(k, JSON.stringify(fields[k]));
    else set(k, fields[k]);
  });

  if (amountChanged || currencyChanged) {
    const snaps = computeSnapshots_(get('amount'), get('currency'));
    TRIP_CURRENCIES.forEach(function (cur) {
      set('amount_' + cur.toLowerCase(), snaps[cur] != null ? snaps[cur] : '');
    });
  }

  set('updated_at', new Date().toISOString());
  if (actor) set('last_edited_by', actor);

  sh.getRange(rowIdx, 1, 1, headerRow.length).setValues([current]);
  return findExpenseById_(id);
}

function deleteExpense_(id, actor) {
  const sh = sheet_(SHEETS.expenses);
  const rowIdx = findRowIndexById_(sh, id);
  if (rowIdx === -1) throw new Error('Expense not found: ' + id);
  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const colDeleted = headerRow.indexOf('deleted_at') + 1;
  const colEditor  = headerRow.indexOf('last_edited_by') + 1;
  const colUpdated = headerRow.indexOf('updated_at') + 1;
  sh.getRange(rowIdx, colDeleted).setValue(new Date().toISOString());
  sh.getRange(rowIdx, colUpdated).setValue(new Date().toISOString());
  if (actor) sh.getRange(rowIdx, colEditor).setValue(actor);
  return { id, deleted: true };
}

function validateExpense_(e) {
  if (!e) throw new Error('Missing expense');
  if (typeof e.amount !== 'number' && isNaN(Number(e.amount))) throw new Error('amount must be a number');
  if (TRIP_CURRENCIES.indexOf(e.currency) === -1) throw new Error('currency must be one of ' + TRIP_CURRENCIES.join('/'));
  if (!e.date) throw new Error('date required');
  if (!e.category) throw new Error('category required');
  if (!e.paid_by) throw new Error('paid_by required');
  if (!['equal', 'amount', 'percent'].includes(e.split_mode)) throw new Error('split_mode must be equal/amount/percent');
}

// =====================================================================
// WRITE - ITINERARY
// =====================================================================

function listItinerary_() {
  return readSheet_(SHEETS.itinerary).filter(r => !r.deleted_at);
}

function addItinerary_(item, actor) {
  validateItinerary_(item);
  const id = 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();
  const row = ITINERARY_HEADERS.map(h => {
    switch (h) {
      case 'id':              return id;
      case 'created_at':      return now;
      case 'updated_at':      return now;
      case 'day_num':         return Number(item.day_num) || 1;
      case 'date':            return item.date || '';
      case 'time':            return item.time || '';
      case 'time_fixed':      return item.time_fixed === false ? false : true;
      case 'title':           return item.title;
      case 'notes':           return item.notes || '';
      case 'category':        return item.category || 'Other';
      case 'map_url':         return item.map_url || '';
      case 'link':            return item.link || '';
      case 'cost_note':       return item.cost_note || '';
      case 'position':        return Number(item.position) || 0;
      case 'last_edited_by':  return actor || '';
      case 'deleted_at':      return '';
      default:                return '';
    }
  });
  sheet_(SHEETS.itinerary).appendRow(row);
  return findItineraryById_(id);
}

function updateItinerary_(id, fields, actor) {
  const sh = sheet_(SHEETS.itinerary);
  const rowIdx = findRowIndexById_(sh, id);
  if (rowIdx === -1) throw new Error('Itinerary item not found: ' + id);

  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const current = sh.getRange(rowIdx, 1, 1, headerRow.length).getValues()[0];
  const set = (h, v) => { current[headerRow.indexOf(h)] = v; };

  Object.keys(fields).forEach(k => {
    if (!ITINERARY_HEADERS.includes(k)) return;
    set(k, fields[k]);
  });

  set('updated_at', new Date().toISOString());
  if (actor) set('last_edited_by', actor);

  sh.getRange(rowIdx, 1, 1, headerRow.length).setValues([current]);
  return findItineraryById_(id);
}

function deleteItinerary_(id, actor) {
  const sh = sheet_(SHEETS.itinerary);
  const rowIdx = findRowIndexById_(sh, id);
  if (rowIdx === -1) throw new Error('Itinerary item not found: ' + id);
  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const colDeleted = headerRow.indexOf('deleted_at') + 1;
  const colEditor  = headerRow.indexOf('last_edited_by') + 1;
  const colUpdated = headerRow.indexOf('updated_at') + 1;
  sh.getRange(rowIdx, colDeleted).setValue(new Date().toISOString());
  sh.getRange(rowIdx, colUpdated).setValue(new Date().toISOString());
  if (actor) sh.getRange(rowIdx, colEditor).setValue(actor);
  return { id, deleted: true };
}

function validateItinerary_(i) {
  if (!i) throw new Error('Missing itinerary item');
  if (!i.title || !String(i.title).trim()) throw new Error('title required');
}

function findItineraryById_(id) {
  return listItinerary_().find(i => i.id === id) || null;
}

// =====================================================================
// FX SNAPSHOTS
// =====================================================================

function computeSnapshots_(amount, currency) {
  const a = Number(amount);
  const rates = getRates_();
  const out = {};
  TRIP_CURRENCIES.forEach(function (cur) {
    if (cur === currency) {
      out[cur] = round_(a, decimalsFor_(cur));
    } else {
      const r = Number(rates[currency + cur]);
      out[cur] = round_(a * r, decimalsFor_(cur));
    }
  });
  return out;
}

function round_(n, dp) {
  if (n == null || isNaN(n)) return null;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// =====================================================================
// SETTLEMENT (greedy, returns amounts in chosen currency)
// =====================================================================

function computeSettlement_(currency) {
  const cur = TRIP_CURRENCIES.indexOf(currency) >= 0 ? currency : TRIP_CURRENCIES[0];
  const col = 'amount_' + cur.toLowerCase();
  const expenses = listExpenses_();
  const members = listMembers_();
  const totals = {}; // memberId -> net (paid - share)
  members.forEach(m => totals[m.id] = 0);

  expenses.forEach(e => {
    const total = Number(e[col]) || 0;
    totals[e.paid_by] = (totals[e.paid_by] || 0) + total;

    const splits = computeShares_(e, total);
    Object.keys(splits).forEach(mid => {
      totals[mid] = (totals[mid] || 0) - splits[mid];
    });
  });

  // Greedy: largest creditor pays largest debtor
  const dp = decimalsFor_(cur);
  const balances = members.map(m => ({ id: m.id, name: m.name, mascot: m.mascot, net: round_(totals[m.id] || 0, dp) }));
  const transfers = greedyTransfers_(balances, dp);
  return { currency: cur, balances, transfers };
}

function computeShares_(e, total) {
  const split = (() => { try { return JSON.parse(e.split_data || '{}'); } catch (_) { return {}; } })();
  const mode = e.split_mode;
  const out = {};
  if (mode === 'equal') {
    const ids = Object.keys(split).length ? Object.keys(split) : null;
    const members = ids || listMembers_().map(m => m.id);
    const each = total / members.length;
    members.forEach(id => { out[id] = each; });
    return out;
  }
  if (mode === 'amount') {
    Object.keys(split).forEach(id => { out[id] = Number(split[id]) || 0; });
    return out;
  }
  if (mode === 'percent') {
    Object.keys(split).forEach(id => { out[id] = total * (Number(split[id]) || 0) / 100; });
    return out;
  }
  return out;
}

function greedyTransfers_(balances, dp) {
  const eps = dp === 0 ? 0.5 : 0.005;
  const arr = balances.map(b => ({ id: b.id, name: b.name, mascot: b.mascot, net: b.net }));
  const transfers = [];
  while (true) {
    arr.sort((a, b) => a.net - b.net);
    const debtor   = arr[0];
    const creditor = arr[arr.length - 1];
    if (creditor.net <= eps || debtor.net >= -eps) break;
    const amt = round_(Math.min(creditor.net, -debtor.net), dp);
    if (amt <= eps) break;
    transfers.push({ from: debtor.id, from_name: debtor.name, from_mascot: debtor.mascot, to: creditor.id, to_name: creditor.name, to_mascot: creditor.mascot, amount: amt });
    debtor.net   = round_(debtor.net   + amt, dp);
    creditor.net = round_(creditor.net - amt, dp);
  }
  return transfers;
}

// =====================================================================
// HELPERS
// =====================================================================

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name + '. Run setup().');
  return sh;
}

function readSheet_(name) {
  const sh = sheet_(name);
  const range = sh.getDataRange().getValues();
  if (range.length < 2) return [];
  const headers = range[0];
  return range.slice(1).map(row => {
    const o = {};
    headers.forEach((h, i) => { o[h] = row[i]; });
    return o;
  });
}

function findRowIndexById_(sh, id) {
  const data = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === id) return i + 2;
  }
  return -1;
}

function findExpenseById_(id) {
  return listExpenses_().find(e => e.id === id) || null;
}

function dayNumFromDate_(dateStr) {
  const start = getSetting_('trip_start');
  if (!start) return null;
  const d1 = new Date(start);
  const d2 = new Date(dateStr);
  return Math.max(1, Math.floor((d2 - d1) / 86400000) + 1);
}
