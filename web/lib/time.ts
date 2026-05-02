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

  // ISO datetime that Sheets uses for time-only cells. Sheets serializes these
  // 1899-12-30-epoch values using the Asia/Singapore LMT offset (+6h55m), not
  // the modern +8. Apply that offset to the UTC time so the result is browser-
  // TZ independent. Round minutes to nearest 5 to absorb float noise.
  const iso = input.match(/^1899-12-\d{2}T\d{2}:\d{2}:/);
  if (iso) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
      const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + 6 * 60 + 55;
      let h = Math.floor(minutes / 60) % 24;
      let m = Math.round((minutes % 60) / 5) * 5;
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

// Convert any free-form time input the user might type into the canonical form
// stored in the sheet: "HH:MM" 24-hour, an uppercase tag, or empty. Anything
// unrecognized passes through untouched (uppercased) so the user can edit it.
const TAGS = ['EARLY MORNING', 'MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'LATE NIGHT', 'NIGHT'];

export function canonicalizeTime(input: string | null | undefined): string {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  // ISO 1899 from legacy data: convert via LMT offset, return HH:MM.
  const iso = raw.match(/^1899-12-\d{2}T(\d{2}):(\d{2}):/);
  if (iso) {
    const total = parseInt(iso[1], 10) * 60 + parseInt(iso[2], 10) + 6 * 60 + 55;
    let h = Math.floor(total / 60) % 24;
    let m = Math.round((total % 60) / 5) * 5;
    if (m === 60) { m = 0; h = (h + 1) % 24; }
    return `${pad2(h)}:${pad2(m)}`;
  }

  const upper = raw.toUpperCase().trim();
  for (const tag of TAGS) {
    if (upper.includes(tag)) return tag;
  }

  // Range like "230PM - 530PM" — keep the start time canonical.
  const first = raw.split(/\s*(?:-|—|–|to)\s*/i)[0].trim();

  // 24h with colon: "9:30", "21:00", "09:30:00"
  let m = first.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (h >= 0 && h < 24 && mi >= 0 && mi < 60) return `${pad2(h)}:${pad2(mi)}`;
  }

  // 12h with period: "9.30am", "9.30 PM"
  m = first.match(/^(\d{1,2})\.(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (h === 12 && ap === 'AM') h = 0;
    else if (ap === 'PM' && h !== 12) h += 12;
    if (h >= 0 && h < 24 && mi < 60) return `${pad2(h)}:${pad2(mi)}`;
  }

  // 12h with optional colon: "7AM", "10:30PM", "130PM", "1050PM", "9 30 AM"
  m = first.replace(/\s+/g, '').match(/^(\d{1,4}):?(\d{2})?(AM|PM)$/i);
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
    const ap = m[3].toUpperCase();
    if (h >= 1 && h <= 12 && mi >= 0 && mi < 60) {
      if (ap === 'AM' && h === 12) h = 0;
      if (ap === 'PM' && h !== 12) h += 12;
      return `${pad2(h)}:${pad2(mi)}`;
    }
  }

  // 4-digit 24h: "0930", "2100"
  m = first.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (h >= 0 && h < 24 && mi >= 0 && mi < 60) return `${pad2(h)}:${pad2(mi)}`;
  }

  // Unrecognized: pass through uppercased so the user can fix manually.
  return upper;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
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

  // ISO datetime that Sheets uses for time-only cells. Check this BEFORE
  // splitting on hyphens, because the ISO string itself contains hyphens
  // ("1899-12-30T03:04:35Z") and the range-splitter would shred it. See
  // the +6h55m LMT note in normalizePart.
  if (/^1899-12-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return (d.getUTCHours() * 60 + d.getUTCMinutes() + 6 * 60 + 55) % (24 * 60);
    }
  }

  // Range like "10AM - 6PM": take the start time as the sort key.
  const first = raw.split(/\s*(?:-|—|–|to)\s*/i)[0].trim();
  if (!first) return null;

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
