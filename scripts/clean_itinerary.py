#!/usr/bin/env python3
"""
Re-derive clean values for every Itinerary item from Sheet1 of the original
xlsx, then update each row via the SplitNow Apps Script. Strips URLs from
titles/notes, properly assigns map_url and link, drops repeated information.

Usage:
  SHEETS_API_URL=... PASSCODE=... python3 scripts/clean_itinerary.py [--dry-run]
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

XLSX = Path(__file__).resolve().parent.parent / 'Tokyo_26th_May_-_2nd_June_2026.xlsx'
TRIP_START = datetime(2026, 5, 26).date()

URL = os.environ.get('SHEETS_API_URL')
PASSCODE = os.environ.get('PASSCODE')
DRY_RUN = '--dry-run' in sys.argv

if not DRY_RUN and (not URL or not PASSCODE):
    print('Set SHEETS_API_URL and PASSCODE (or pass --dry-run)', file=sys.stderr)
    sys.exit(1)


def categorize(text: str) -> str:
    t = (text or '').lower()
    food_kw = ['breakfast', 'lunch', 'dinner', 'supper', 'snack', 'cafe', 'coffee', 'meal',
               'tonkatsu', 'ramen', 'soba', 'tempura', 'unagi', 'pancake', 'bairin',
               'shack', 'food', 'eat', 'restaurant', 'lawson', 'glitch', 'bread', 'tendon',
               'ikushika', 'mizunokaze', 'rice', 'foodshow']
    transport_kw = ['flight', 'train', 'depart', 'station', 'drive', 'walk', 'bus',
                    'taxi', 'car rental', 'return car', 'transport', 'route']
    accom_kw = ['hotel', 'airbnb', 'check in', 'check out', 'accommodation',
                'collect luggage', 'drop luggage', 'store luggage']
    shop_kw = ['shopping', 'uniqlo', 'gu', 'foodshow', 'souvenir', 'shop', 'mart']
    ent_kw = ['disney', 'sky', 'crossing', 'park', 'beach', 'sunset', 'sunrise',
              'photo', 'view', 'shrine', 'temple', 'tower', 'museum', 'art',
              'teamlab', 'sensoji', 'pagoda', 'observatory', 'garden',
              'lake', 'mountain', 'corridor', 'bridge', 'gate', 'sightseeing', 'hike']
    if any(k in t for k in accom_kw): return 'Accommodation'
    if any(k in t for k in transport_kw): return 'Transport'
    if any(k in t for k in food_kw): return 'Food'
    if any(k in t for k in shop_kw): return 'Shopping'
    if any(k in t for k in ent_kw): return 'Entertainment'
    return 'Other'


def normalize_time(v) -> str:
    if v is None:
        return ''
    if isinstance(v, datetime):
        return v.strftime('%H:%M')
    s = str(v).strip()
    if re.match(r'^\d{2}:\d{2}:\d{2}$', s):
        return s[:5]
    return s


def split_dates(s: str):
    m = re.match(r'^\s*(\d{1,2})/(\d{1,2})/(\d{2,4})', s)
    if not m: return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100: y += 2000
    try:
        return datetime(y, mo, d).date()
    except Exception:
        return None


def reinterpret(d):
    if abs((d - TRIP_START).days) <= 14:
        return d
    try:
        s = datetime(d.year, d.day, d.month).date()
        if abs((s - TRIP_START).days) <= 14:
            return s
    except Exception:
        pass
    return d


URL_RE = re.compile(r'https?://\S+')

def all_urls(*texts):
    out = []
    for t in texts:
        if not t: continue
        for m in URL_RE.finditer(str(t)):
            u = m.group(0).rstrip('.,;)')
            if u not in out: out.append(u)
    return out


def is_map_url(u: str) -> bool:
    return any(s in u for s in ('maps.app.goo.gl', 'google.com/maps', 'maps.google.', 'goo.gl/maps'))


def strip_urls(s):
    if not s: return ''
    return URL_RE.sub('', str(s)).strip()


def clean_text(s):
    if not s: return ''
    return re.sub(r'\s+', ' ', str(s).replace('\r', '').replace('\n', ' ')).strip()


def derive_items():
    import openpyxl
    wb = openpyxl.load_workbook(XLSX, data_only=False)
    ws = wb['Sheet1']

    items = []
    cur_date = None
    cur_day = 0
    pos = 0

    for row in ws.iter_rows(values_only=True, min_row=2):
        date_cell, time_cell, itinerary, remarks, parking, maps, hotel, est, _ = row[:9]

        if isinstance(date_cell, datetime):
            cur_date = reinterpret(date_cell.date())
        elif isinstance(date_cell, str):
            d = split_dates(date_cell)
            if d: cur_date = d

        title_raw = (str(itinerary).strip() if itinerary else '')
        any_content = title_raw or remarks or maps or hotel
        if not any_content: continue
        if cur_date is None: continue

        new_day = max(1, (cur_date - TRIP_START).days + 1)
        if new_day != cur_day:
            cur_day = new_day
            pos = 0
        pos += 1

        # URL extraction
        urls = all_urls(itinerary, remarks, parking, maps, hotel)
        map_urls = [u for u in urls if is_map_url(u)]
        non_map_urls = [u for u in urls if not is_map_url(u)]
        airbnb_urls = [u for u in non_map_urls if 'airbnb' in u]
        other_urls = [u for u in non_map_urls if 'airbnb' not in u]

        map_url = map_urls[0] if map_urls else ''
        link = (airbnb_urls[0] if airbnb_urls else (other_urls[0] if other_urls else ''))

        # Title — never include URLs
        title = clean_text(strip_urls(title_raw))
        if not title or title.upper() in ('HOTEL', 'ACCOMMODATION'):
            if hotel:
                first = clean_text(strip_urls(str(hotel).split('\n', 1)[0]))
                first = re.sub(r'^(Airbnb|Hotel)\s*[:\-]?\s*', '', first, flags=re.I).strip()
                title = first or 'Accommodation'
            else:
                title = 'Untitled'

        # Notes — labeled sections, deduped against title, URLs stripped
        sections = []
        rk = clean_text(strip_urls(remarks))
        if rk and rk.lower() != title.lower():
            sections.append(f'Remarks: {rk}')
        pk = clean_text(strip_urls(parking))
        if pk and pk.lower() != title.lower():
            sections.append(f'Parking: {pk}')
        if hotel:
            ht = clean_text(strip_urls(hotel))
            ht = re.sub(r'^(Airbnb|Hotel)\s*[:\-]?\s*', '', ht, flags=re.I).strip()
            # Drop hotel-as-notes if it is the same as the title
            if ht and ht.lower() not in (title.lower(),) and ht.lower() not in [s.lower() for s in sections]:
                sections.append(f'Hotel: {ht}')
        notes = '\n'.join(sections)

        # Cost note
        cost_note = clean_text(est) if est and not str(est).startswith('=') else ''

        # Category
        category = 'Accommodation' if hotel else categorize(title + ' ' + notes)

        items.append({
            'day_num': cur_day,
            'date': cur_date.isoformat(),
            'time': normalize_time(time_cell),
            'title': title,
            'notes': notes,
            'category': category,
            'map_url': map_url,
            'link': link,
            'cost_note': cost_note,
            'position': pos,
        })

    return items


def fetch_current():
    req = urllib.request.Request(URL + '?action=itinerary&passcode=' + PASSCODE)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())['data']


def post(action, payload):
    body = json.dumps({'action': action, 'passcode': PASSCODE, 'actor': 'm1', **payload}).encode()
    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'text/plain;charset=utf-8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    targets = derive_items()
    print(f'Derived {len(targets)} target items from xlsx')

    if DRY_RUN:
        for t in targets[:6]:
            print(json.dumps(t, indent=2, ensure_ascii=False))
        print('...')
        return

    current = fetch_current()
    print(f'Current sheet has {len(current)} items')

    # Match by (day_num, position)
    by_key = {(c.get('day_num'), c.get('position')): c for c in current}
    updated, created, skipped = 0, 0, 0
    for t in targets:
        key = (t['day_num'], t['position'])
        cur = by_key.get(key)
        fields = {k: t[k] for k in ('title', 'notes', 'category', 'map_url', 'link', 'cost_note')}
        # We do NOT touch the time field: Sheets re-mangles it on every write. Display normalizer handles it.
        if cur:
            same = all(str(cur.get(k, '') or '') == str(fields[k]) for k in fields)
            if same:
                skipped += 1
                continue
            r = post('updateItinerary', {'id': cur['id'], 'fields': fields})
            if r.get('ok'):
                updated += 1
            else:
                print('  FAIL update:', t['title'], r.get('error'))
        else:
            r = post('addItinerary', {'item': t})
            if r.get('ok'):
                created += 1
            else:
                print('  FAIL add:', t['title'], r.get('error'))
        if (updated + created) % 10 == 0:
            print(f'  progress: updated={updated} created={created} skipped={skipped}')

    print(f'Done. updated={updated} created={created} skipped={skipped}')


if __name__ == '__main__':
    main()
