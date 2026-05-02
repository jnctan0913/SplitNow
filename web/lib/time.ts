// Normalizes free-form time strings from the spreadsheet into a single short
// form like "10AM", "5:30PM", "10:50PM - 6:55AM". Textual labels like "EVENING"
// or "8PM onwards" pass through untouched.

export function normalizeTime(input: string | null | undefined): string {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  // Range separators: hyphen / em / en dash / "to"
  const parts = raw.split(/\s*(?:-|—|–|to)\s*/i);
  if (parts.length === 2) {
    const a = normalizePart(parts[0]);
    const b = normalizePart(parts[1]);
    if (looksLikeTime(a) && looksLikeTime(b)) return `${a} - ${b}`;
  }
  return normalizePart(raw);
}

function normalizePart(input: string): string {
  const s = input.trim().toUpperCase();
  if (!s) return s;

  // ISO datetime that Sheets uses for time-only cells (1899-12-30 epoch).
  // Convert to local clock time and round to nearest 5 min to absorb float noise.
  const iso = input.match(/^1899-12-30T\d{2}:\d{2}:/);
  if (iso) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
      let h = d.getHours();
      let m = Math.round(d.getMinutes() / 5) * 5;
      if (m === 60) { m = 0; h = (h + 1) % 24; }
      return formatTime(h, m);
    }
  }

  // 24h: HH:MM or HH:MM:SS
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return formatTime(h, m);
  }

  // 12h with period instead of colon: "9.30AM"
  const mPeriod = s.match(/^(\d{1,2})\.(\d{2})\s*(AM|PM)$/);
  if (mPeriod) {
    let h = parseInt(mPeriod[1], 10);
    const m = parseInt(mPeriod[2], 10);
    if (h >= 1 && h <= 12 && m >= 0 && m < 60) {
      if (mPeriod[3] === 'AM' && h === 12) h = 0;
      if (mPeriod[3] === 'PM' && h !== 12) h += 12;
      return formatTime(h, m);
    }
  }

  // 12h with AM/PM at end. Accepts "7AM", "10:30PM", "130PM", "1050PM".
  const m12 = s.match(/^(\d{1,4}):?(\d{2})?\s*(AM|PM)$/);
  if (m12) {
    let h: number;
    let m: number;
    if (m12[2] !== undefined) {
      h = parseInt(m12[1], 10);
      m = parseInt(m12[2], 10);
    } else {
      const num = m12[1];
      if (num.length <= 2) { h = parseInt(num, 10); m = 0; }
      else if (num.length === 3) { h = parseInt(num[0], 10); m = parseInt(num.slice(1), 10); }
      else { h = parseInt(num.slice(0, 2), 10); m = parseInt(num.slice(2), 10); }
    }
    if (h >= 1 && h <= 12 && m >= 0 && m < 60) {
      let h24 = h;
      if (m12[3] === 'AM' && h === 12) h24 = 0;
      if (m12[3] === 'PM' && h !== 12) h24 += 12;
      return formatTime(h24, m);
    }
  }

  return s;
}

function formatTime(h: number, m: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

function looksLikeTime(s: string): boolean {
  return /^(?:\d{1,2})(?::\d{2})?(?:AM|PM)$/.test(s);
}

// Convert a free-form time string into minutes-since-midnight for sorting.
// Returns null if nothing parseable can be extracted, in which case the caller
// should treat the item as having no time and use a fallback ordering.
const TEXTUAL: Array<[RegExp, number]> = [
  [/EARLY\s*MORNING/, 5 * 60],
  [/MORNING/,         8 * 60],
  [/NOON/,            12 * 60],
  [/AFTERNOON/,       14 * 60],
  [/EVENING/,         18 * 60],
  [/LATE\s*NIGHT/,    23 * 60],
  [/NIGHT/,           21 * 60],
];

export function timeToMinutes(input: string | null | undefined): number | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Range: take the start time as the sort key.
  const first = raw.split(/\s*(?:-|—|–|to)\s*/i)[0].trim();
  if (!first) return null;

  // ISO datetime that Sheets uses for time-only cells.
  if (/^1899-12-30T/.test(first)) {
    const d = new Date(first);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }

  const upper = first.toUpperCase();

  // Textual labels first.
  for (const [pattern, mins] of TEXTUAL) {
    if (pattern.test(upper)) return mins;
  }

  // 24h: HH:MM[:SS]
  let m = upper.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (h >= 0 && h < 24 && mi >= 0 && mi < 60) return h * 60 + mi;
  }

  // 12h with period: "9.30AM"
  m = upper.match(/^(\d{1,2})\.(\d{2})\s*(AM|PM)/);
  if (m) {
    let h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (h >= 1 && h <= 12 && mi < 60) {
      if (m[3] === 'AM' && h === 12) h = 0;
      if (m[3] === 'PM' && h !== 12) h += 12;
      return h * 60 + mi;
    }
  }

  // 12h with AM/PM. Accepts "7AM", "10:30PM", "130PM", "1050PM".
  m = upper.match(/^(\d{1,4}):?(\d{2})?\s*(AM|PM)/);
  if (m) {
    let h: number;
    let mi: number;
    if (m[2] !== undefined) {
      h = parseInt(m[1], 10);
      mi = parseInt(m[2], 10);
    } else {
      const num = m[1];
      if (num.length <= 2) { h = parseInt(num, 10); mi = 0; }
      else if (num.length === 3) { h = parseInt(num[0], 10); mi = parseInt(num.slice(1), 10); }
      else { h = parseInt(num.slice(0, 2), 10); mi = parseInt(num.slice(2), 10); }
    }
    if (h >= 1 && h <= 12 && mi >= 0 && mi < 60) {
      if (m[3] === 'AM' && h === 12) h = 0;
      if (m[3] === 'PM' && h !== 12) h += 12;
      return h * 60 + mi;
    }
  }

  return null;
}
