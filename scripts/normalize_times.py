#!/usr/bin/env python3
"""Re-write every itinerary item's time field to a clean canonical form.

Output formats:
  - "HH:MM" 24-hour for specific times (e.g. "09:30", "21:00")
  - One of the textual tags: EARLY MORNING, MORNING, NOON, AFTERNOON,
    EVENING, NIGHT, LATE NIGHT
  - Empty string if no time set

Run AFTER the Apps Script's setup() forced the time column to text format,
so the values stay as written and don't get re-parsed by Sheets."""
import json, os, re, sys, urllib.request
from datetime import datetime

URL = os.environ.get('SHEETS_API_URL')
PASSCODE = os.environ.get('PASSCODE')
if not URL or not PASSCODE:
    print('Set SHEETS_API_URL and PASSCODE', file=sys.stderr); sys.exit(1)

TAGS = ['EARLY MORNING', 'MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'LATE NIGHT', 'NIGHT']

def to_canonical(raw):
    if not raw: return ''
    s = str(raw).strip()
    if not s: return ''

    # ISO 1899 (Sheets-mangled time-only cells). Recover via +6:55 LMT offset.
    m = re.match(r'^1899-12-\d{2}T(\d{2}):(\d{2}):', s)
    if m:
        total = int(m.group(1)) * 60 + int(m.group(2)) + 6 * 60 + 55
        h = (total // 60) % 24
        mm = round((total % 60) / 5) * 5
        if mm == 60: mm = 0; h = (h + 1) % 24
        return f'{h:02d}:{mm:02d}'

    upper = s.upper().strip()
    for tag in TAGS:
        if tag in upper:
            return tag

    # Range like "230PM - 530PM" or "1050pm-0655am" — keep the start time canonical.
    parts = re.split(r'\s*(?:-|—|–|to)\s*', s, flags=re.I)
    first = parts[0].strip()

    # 24h HH:MM (with optional :SS)
    m = re.match(r'^(\d{1,2}):(\d{2})(?::\d{2})?$', first)
    if m:
        h, mm = int(m.group(1)), int(m.group(2))
        if 0 <= h < 24 and 0 <= mm < 60:
            return f'{h:02d}:{mm:02d}'

    # 12h with period
    m = re.match(r'^(\d{1,2})\.(\d{2})\s*(AM|PM)$', first, re.I)
    if m:
        h, mm, ap = int(m.group(1)), int(m.group(2)), m.group(3).upper()
        if h == 12 and ap == 'AM': h = 0
        elif ap == 'PM' and h != 12: h += 12
        return f'{h:02d}:{mm:02d}'

    # 12h with optional colon: "7AM", "10:30PM", "130PM", "1050PM"
    m = re.match(r'^(\d{1,4}):?(\d{2})?\s*(AM|PM)$', first, re.I)
    if m:
        if m.group(2) is not None:
            h, mm = int(m.group(1)), int(m.group(2))
        else:
            n = m.group(1)
            if len(n) <= 2: h, mm = int(n), 0
            elif len(n) == 3: h, mm = int(n[0]), int(n[1:])
            else: h, mm = int(n[:2]), int(n[2:])
        ap = m.group(3).upper()
        if h == 12 and ap == 'AM': h = 0
        elif ap == 'PM' and h != 12: h += 12
        return f'{h:02d}:{mm:02d}'

    # "8PM onwards" -> 8PM portion
    m = re.match(r'^(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM))', first, re.I)
    if m:
        return to_canonical(m.group(1))

    # Unknown -> leave as-is (uppercased) so the user can clean manually
    return s.strip()


with urllib.request.urlopen(URL + '?action=itinerary&passcode=' + PASSCODE, timeout=30) as r:
    items = json.loads(r.read())['data']

def post(payload):
    body = json.dumps({'action': 'updateItinerary', 'passcode': PASSCODE, 'actor': 'm1', **payload}).encode()
    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'text/plain;charset=utf-8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

ok = changed = unchanged = fail = 0
for it in items:
    if it.get('deleted_at'): continue
    raw = it.get('time', '')
    canon = to_canonical(raw)
    if canon == raw:
        unchanged += 1
        continue
    r = post({'id': it['id'], 'fields': {'time': canon}})
    if r.get('ok'):
        ok += 1; changed += 1
    else:
        fail += 1
        print('FAIL', it.get('day_num'), it.get('position'), '->', r.get('error'))
    if (ok + fail) % 15 == 0:
        print(f'  progress {ok + fail}/{len(items)}')

print(f'Done. changed={changed} unchanged={unchanged} fail={fail}')
