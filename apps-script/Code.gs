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
  'You can bulk-add itinerary items by editing the Itinerary tab in the source spreadsheet.',
  '',
  'Required columns: day_num, date, title, category.',
  'Optional: time, notes, map_url, link, cost_note.',
  '',
  'Helpful menu items (top of the spreadsheet, "Travel Log" menu after Help):',
  ' • Fix itinerary rows — fills id, created_at, updated_at, time_fixed, position, and day_num (derived from date) for new rows. Never overwrites existing values.',
  ' • Compact itinerary — deletes phantom blank rows so new entries from the app land next to your existing ones instead of at row 1000.',
  ' • Validate itinerary rows — scans for typos: invalid category, day_num out of range, missing title/date, unknown member id, duplicate ids.',
  ' • Apply itinerary validation rules — re-attaches dropdowns and warning indicators in case they get cleared.',
  '',
  'Cells with invalid values show a red triangle. Hover any column header for guidance on what it accepts.',
  '',
  'Refresh the app to see the changes. Tap-to-edit and tap-to-delete only work after the row has an id, which "Fix itinerary rows" takes care of.',
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
// SPREADSHEET MENU
// =====================================================================

// Auto-runs when the spreadsheet is opened. Adds a "Travel Log" menu
// next to Help with one-click maintenance actions.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Travel Log')
    .addItem('Fix itinerary rows (assign id + timestamps)', 'fixItineraryRows')
    .addItem('Compact itinerary (delete blank rows)', 'compactItineraryRows')
    .addItem('Validate itinerary rows', 'validateItineraryRows')
    .addItem('Apply itinerary validation rules', 'applyItineraryValidation')
    .addSeparator()
    .addItem('Reseed exchange rate pairs (after currency change)', 'reseedRates')
    .addSeparator()
    .addItem('Re-run setup() (idempotent)', 'setup')
    .addToUi();
}

// Scans the Itinerary sheet and fills missing id, created_at, updated_at,
// time_fixed, and position cells. Never overwrites existing values. Run
// after a bulk paste to make the rows fully editable from the app.
function fixItineraryRows() {
  const ui = SpreadsheetApp.getUi();
  const sh = sheet_(SHEETS.itinerary);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { ui.alert('Itinerary tab has no data rows.'); return; }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const col = function (h) { return headers.indexOf(h); };
  const required = ['id', 'created_at', 'updated_at', 'time', 'time_fixed', 'position', 'day_num'];
  for (let r = 0; r < required.length; r++) {
    if (col(required[r]) === -1) {
      ui.alert('Itinerary sheet is missing column "' + required[r] + '". Run setup() first.');
      return;
    }
  }

  const data = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const idC = col('id'), cAtC = col('created_at'), uAtC = col('updated_at');
  const tC = col('time'), tFC = col('time_fixed'), posC = col('position');
  const dayC = col('day_num'), dateC = col('date'), titleC = col('title');
  const tripStart = getSetting_('trip_start') || TRIP_INFO.start;
  const startMs = tripStart ? new Date(tripStart).getTime() : NaN;
  const now = new Date().toISOString();
  const posByDay = {};
  let fixed = 0;

  // A row is "real" if it has any meaningful field. Rows that are entirely
  // blank (just spread by Sheets' default 1000-row sheet) are skipped so we
  // don't generate ids for them and pollute the data range.
  function isMeaningful_(row) {
    return (
      String(row[titleC] || '').trim() !== '' ||
      String(row[dateC]  || '').trim() !== '' ||
      String(row[idC]    || '').trim() !== '' ||
      String(row[dayC]   || '').trim() !== ''
    );
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!isMeaningful_(row)) continue;

    let touched = false;
    if (row[idC] === '' || row[idC] == null) {
      row[idC] = 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + (i + 2);
      touched = true;
    }
    if (row[cAtC] === '' || row[cAtC] == null) { row[cAtC] = now; touched = true; }
    if (row[uAtC] === '' || row[uAtC] == null) { row[uAtC] = now; touched = true; }
    if (row[tFC] === '' || row[tFC] == null) {
      row[tFC] = row[tC] ? true : false;
      touched = true;
    }
    // Derive day_num from date when missing (and trip_start is known).
    // Fall back to 1 only if date is also missing.
    if (row[dayC] === '' || row[dayC] == null) {
      let dn = 1;
      if (!isNaN(startMs) && row[dateC]) {
        const d2 = new Date(row[dateC]);
        if (!isNaN(d2.getTime())) {
          dn = Math.max(1, Math.floor((d2.getTime() - startMs) / 86400000) + 1);
        }
      }
      row[dayC] = dn;
      touched = true;
    }
    if (row[posC] === '' || row[posC] == null) {
      const day = Number(row[dayC]) || 1;
      posByDay[day] = (posByDay[day] || 0) + 1;
      row[posC] = posByDay[day];
      touched = true;
    }
    if (touched) fixed++;
  }

  sh.getRange(2, 1, data.length, headers.length).setValues(data);
  ui.alert('Fixed ' + fixed + ' itinerary row' + (fixed === 1 ? '' : 's') + '.');
}

// Deletes phantom blank rows in the Itinerary sheet (rows where every
// meaningful field is empty but Sheets still treats them as data because
// of formatting or prior empty-string writes). Real rows are kept; their
// values stay where they are. Idempotent.
function compactItineraryRows() {
  const ui = SpreadsheetApp.getUi();
  const sh = sheet_(SHEETS.itinerary);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { ui.alert('Itinerary tab has no data rows.'); return; }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const data = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const col = function (h) { return headers.indexOf(h); };
  const titleC = col('title'), dateC = col('date'), idC = col('id'), dayC = col('day_num');

  function isMeaningful(row) {
    return (
      String(row[titleC] || '').trim() !== '' ||
      String(row[dateC]  || '').trim() !== '' ||
      String(row[idC]    || '').trim() !== '' ||
      String(row[dayC]   || '').trim() !== ''
    );
  }

  // Walk bottom-up so row indices stay valid as we delete.
  let deleted = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (!isMeaningful(data[i])) {
      sh.deleteRow(i + 2);
      deleted++;
    }
  }

  ui.alert('Compacted itinerary: deleted ' + deleted + ' empty row' + (deleted === 1 ? '' : 's') + '.');
}

// Menu-callable wrapper: applies validation and shows a confirmation.
function applyItineraryValidation() {
  applyItineraryValidation_();
  SpreadsheetApp.getUi().alert(
    'Itinerary validation rules applied.\n\n' +
    'Cells with invalid values now show a red triangle. Hover the column header for guidance on what each column accepts.',
  );
}

// Applies in-cell data validation rules to the Itinerary sheet so users
// see a red triangle on cells with invalid values (warn-and-accept mode,
// to keep bulk-paste workflows working). Idempotent; safe to re-run.
function applyItineraryValidation_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = sheet_(SHEETS.itinerary);
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const colOf = function (h) { return headers.indexOf(h) + 1; };
  const maxRows = sh.getMaxRows();
  const rowsBelowHeader = Math.max(maxRows - 1, 1);
  const tripDays = computeTripDays_();

  // category dropdown
  if (colOf('category') > 0) {
    const r = sh.getRange(2, colOf('category'), rowsBelowHeader);
    r.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(DEFAULT_CATEGORIES, true)
      .setAllowInvalid(true)
      .setHelpText('Must be one of: ' + DEFAULT_CATEGORIES.join(', '))
      .build());
  }

  // day_num: integer 1..tripDays
  if (colOf('day_num') > 0) {
    const r = sh.getRange(2, colOf('day_num'), rowsBelowHeader);
    r.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireNumberBetween(1, tripDays)
      .setAllowInvalid(true)
      .setHelpText('Whole number 1 to ' + tripDays + ' (trip length).')
      .build());
  }

  // date: parseable as a date
  if (colOf('date') > 0) {
    const r = sh.getRange(2, colOf('date'), rowsBelowHeader);
    r.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(true)
      .setHelpText('YYYY-MM-DD (this column is text-formatted to preserve the literal value).')
      .build());
  }

  // time_fixed: checkbox
  if (colOf('time_fixed') > 0) {
    const r = sh.getRange(2, colOf('time_fixed'), rowsBelowHeader);
    r.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .setAllowInvalid(true)
      .build());
  }

  // last_edited_by: dropdown of live member ids from the Members sheet
  const membersSh = ss.getSheetByName(SHEETS.members);
  if (colOf('last_edited_by') > 0 && membersSh) {
    const r = sh.getRange(2, colOf('last_edited_by'), rowsBelowHeader);
    r.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(membersSh.getRange('A2:A'), true)
      .setAllowInvalid(true)
      .setHelpText('Member id from the Members sheet (m1, m2, ...).')
      .build());
  }

  setItineraryHeaderNotes_(sh, headers, tripDays);
}

// Adds hover notes on the Itinerary header cells so contributors see
// what each column expects without having to read documentation.
function setItineraryHeaderNotes_(sh, headers, tripDays) {
  const notes = {
    id:             'Auto-generated. Leave blank when bulk-pasting; "Fix itinerary rows" menu fills it.',
    created_at:     'Auto-generated. Leave blank when bulk-pasting.',
    updated_at:     'Auto-generated.',
    day_num:        'Whole number 1..' + tripDays + ' (trip length). Required.',
    date:           'YYYY-MM-DD. Required.',
    time:           'HH:MM 24-hour. Optional. The app canonicalizes app-entered times; bulk paste should already use HH:MM.',
    time_fixed:     'Checkbox. TRUE if the time is exact, FALSE/blank for "approximate".',
    title:          'Required.',
    notes:          'Free text.',
    category:       'One of: ' + DEFAULT_CATEGORIES.join(', ') + '. Required.',
    map_url:        'Optional URL.',
    link:           'Optional URL.',
    cost_note:      'Free text.',
    position:       'Auto-set by "Fix itinerary rows". Override only if you need a specific intra-day order.',
    last_edited_by: 'Member id (m1, m2, ...). Auto-set when edited via app.',
    deleted_at:     'Soft-delete timestamp. Leave blank.',
  };
  Object.keys(notes).forEach(function (h) {
    const c = headers.indexOf(h) + 1;
    if (c > 0) sh.getRange(1, c).setNote(notes[h]);
  });
}

// Trip length in days, derived from Settings.trip_start/trip_end if
// present, else from TRIP_INFO. Fallback of 30 covers edge cases.
function computeTripDays_() {
  const start = getSetting_('trip_start') || TRIP_INFO.start;
  const end   = getSetting_('trip_end')   || TRIP_INFO.end;
  if (!start || !end) return 30;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!isFinite(ms)) return 30;
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// Diagnostic: scans the Itinerary tab and reports rows with invalid
// or missing required values. Read-only. Use after a bulk paste to
// catch typos before they reach the app.
function validateItineraryRows() {
  const ui = SpreadsheetApp.getUi();
  const sh = sheet_(SHEETS.itinerary);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { ui.alert('No itinerary rows.'); return; }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const data = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const col = function (h) { return headers.indexOf(h); };

  const memberIds = readSheet_(SHEETS.members).map(function (m) { return m.id; });
  const tripDays = computeTripDays_();
  const issues = [];
  const seenIds = {};

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const rowNum = i + 2;

    const id = r[col('id')];
    if (id) {
      if (seenIds[id]) issues.push('Row ' + rowNum + ': duplicate id "' + id + '" (also in row ' + seenIds[id] + ')');
      seenIds[id] = rowNum;
    }
    if (!r[col('title')]) issues.push('Row ' + rowNum + ': title is empty');
    const cat = r[col('category')];
    if (!cat) issues.push('Row ' + rowNum + ': category is empty');
    else if (DEFAULT_CATEGORIES.indexOf(cat) === -1) issues.push('Row ' + rowNum + ': category "' + cat + '" not in [' + DEFAULT_CATEGORIES.join(', ') + ']');
    const dn = Number(r[col('day_num')]);
    if (!Number.isInteger(dn) || dn < 1 || dn > tripDays) issues.push('Row ' + rowNum + ': day_num "' + r[col('day_num')] + '" not in 1..' + tripDays);
    if (!r[col('date')]) issues.push('Row ' + rowNum + ': date is empty');
    const eb = r[col('last_edited_by')];
    if (eb && memberIds.indexOf(eb) === -1) issues.push('Row ' + rowNum + ': last_edited_by "' + eb + '" is not a known member id');
  }

  if (issues.length === 0) {
    ui.alert('All ' + data.length + ' itinerary rows look valid.');
    return;
  }
  const shown = issues.slice(0, 50).join('\n');
  const overflow = issues.length > 50 ? '\n\n... and ' + (issues.length - 50) + ' more.' : '';
  ui.alert(issues.length + ' itinerary issue' + (issues.length === 1 ? '' : 's'), shown + overflow, ui.ButtonSet.OK);
}

// Wipes the Rates sheet body and reseeds from RATE_PAIRS (derived from
// TRIP_CURRENCIES). Run this after editing TRIP_CURRENCIES at the top of
// Code.gs so the GoogleFinance formulas update to the new currency triple.
function reseedRates() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Reseed exchange rates?',
    'This deletes all rows in the Rates tab and reseeds the ' + RATE_PAIRS.length +
      ' pairs for ' + TRIP_CURRENCIES.join('/') +
      '. Run this only after intentionally changing TRIP_CURRENCIES.',
    ui.ButtonSet.YES_NO,
  );
  if (resp !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEETS.rates);
  if (!sh) throw new Error('Rates sheet missing. Run setup() first.');
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  seedRatesIfEmpty_(ss);
  ui.alert('Reseeded ' + RATE_PAIRS.length + ' pairs: ' + RATE_PAIRS.join(', '));
}

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

  // Best-effort: apply itinerary data validation rules. Uses the private
  // helper so setup() doesn't surface a second confirmation dialog on top
  // of its own. Wrapped because requireValueInRange needs the Members
  // sheet to exist; if anything fails we don't want to block setup().
  try { applyItineraryValidation_(); } catch (err) {
    Logger.log('applyItineraryValidation_ skipped: ' + err);
  }

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
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return readSheet_(SHEETS.expenses)
    .filter(function (r) {
      if (r.deleted_at) return false;
      // Skip phantom blank rows: a real expense always has an id.
      if (!r.id || String(r.id).trim() === '') return false;
      return true;
    })
    .map(function (r) { r.date = normalizeDateValue_(r.date, tz); return r; });
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
  const sh = sheet_(SHEETS.expenses);
  // Use the SHEET's actual column order for the row, not EXPENSE_HEADERS.
  // When ensureSheet_ migrates new headers it appends them at the end, so
  // a sheet's columns can be in a different order than the canonical list.
  const sheetHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  function valueFor(h) {
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
  }

  sh.appendRow(sheetHeaders.map(valueFor));
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
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return readSheet_(SHEETS.itinerary)
    .filter(function (r) {
      if (r.deleted_at) return false;
      // Skip phantom blank rows. A real itinerary item has a title at minimum;
      // missing both id AND title means the row was never populated.
      if ((!r.id || String(r.id).trim() === '') && (!r.title || String(r.title).trim() === '')) return false;
      return true;
    })
    .map(function (r) { r.date = normalizeDateValue_(r.date, tz); return r; });
}

// Coerces a date value (Date object or string in any common format) into
// a YYYY-MM-DD string using the spreadsheet's timezone. Stops the frontend's
// date tiebreaker in the sort comparator from doing wrong-order lexical
// comparisons when one cell is a Sheets Date and another is "M/D/YYYY".
function normalizeDateValue_(value, tz) {
  if (value === '' || value == null) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already canonical
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, tz, 'yyyy-MM-dd');
  return s; // unrecognized; pass through so user can fix
}

function addItinerary_(item, actor) {
  validateItinerary_(item);
  const id = 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();
  const sh = sheet_(SHEETS.itinerary);
  // Use the SHEET's actual column order, not ITINERARY_HEADERS. ensureSheet_
  // appends migrated columns at the end, so a sheet that was set up before a
  // column was added (e.g. time_fixed) will have a different layout from the
  // canonical list. Writing canonical-ordered values into a non-canonical
  // sheet shifts data into the wrong columns; among other things, the value
  // intended for last_edited_by ends up in deleted_at, which then makes the
  // row invisible because listItinerary_ filters truthy deleted_at.
  const sheetHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  function valueFor(h) {
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
  }

  sh.appendRow(sheetHeaders.map(valueFor));
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
