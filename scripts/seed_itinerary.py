#!/usr/bin/env python3
"""
Parse Sheet1 from the Tokyo xlsx and bulk-insert into the SplitNow Itinerary
sheet via the Apps Script web app.

Usage:
  SHEETS_API_URL=... PASSCODE=... python3 scripts/seed_itinerary.py [--dry-run]
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

XLSX = Path(__file__).resolve().parent.parent / 'Tokyo_26th_May_-_2nd_June_2026.xlsx'
TRIP_START = datetime(2026, 5, 26).date()

URL = os.environ.get('SHEETS_API_URL')
PASSCODE = os.environ.get('PASSCODE')
DRY_RUN = '--dry-run' in sys.argv

if not DRY_RUN and (not URL or not PASSCODE):
    print('Set SHEETS_API_URL and PASSCODE env vars (or pass --dry-run)', file=sys.stderr)
    sys.exit(1)


def categorize(text: str) -> str:
    t = (text or '').lower()
    food_kw = ['breakfast', 'lunch', 'dinner', 'supper', 'snack', 'cafe', 'coffee', 'meal',
               'tonkatsu', 'ramen', 'soba', 'tempura', 'unagi', 'pancake', 'bairin',
               'shack', 'food', 'eat', 'restaurant', 'lawson', 'glitch', 'bread', 'tendon',
               'ikushika', 'mizunokaze', 'rice', 'foodshow']
    transport_kw = ['flight', 'train', 'depart', 'station', 'drive', 'walk', 'bus',
                    'taxi', 'car rental', 'return car', 'transport', 'route', 'parking']
    accom_kw = ['hotel', 'airbnb', 'check in', 'check out', 'accommodation', 'sleep',
                'collect luggage', 'drop luggage', 'store luggage']
    shop_kw = ['shopping', 'uniqlo', 'gu', 'shibuya tokyo foodshow', 'souvenir',
               'buy ', 'shop', 'mart', 'store ']
    ent_kw = ['disney', 'sky', 'crossing', 'park', 'beach', 'sunset', 'sunrise',
              'photo', 'view', 'shrine', 'temple', 'tower', 'museum', 'art',
              'teamlab', 'sensoji', 'pagoda', 'sea ', 'observatory', 'garden',
              'lake ', 'shrine', 'mountain', 'corridor', 'bridge', 'gate',
              'sightseeing', 'hike', 'meet']
    if any(k in t for k in accom_kw): return 'Accommodation'
    if any(k in t for k in transport_kw): return 'Transport'
    if any(k in t for k in food_kw): return 'Food'
    if any(k in t for k in shop_kw): return 'Shopping'
    if any(k in t for k in ent_kw): return 'Entertainment'
    return 'Other'


def normalize_time(v) -> str:
    """Time cell can be a datetime.time, str like '10AM', '1050pm-0655am', '17:00:00'."""
    if v is None:
        return ''
    s = str(v).strip()
    if 'datetime.time' in s.__class__.__name__:
        return s
    # If it's a time object, str() gives 'HH:MM:SS'
    if re.match(r'^\d{2}:\d{2}:\d{2}$', s):
        return s[:5]
    return s


def split_dates(s: str):
    """Date cell like '25/5/26 Mon' -> date(2026,5,25)."""
    m = re.match(r'^\s*(\d{1,2})/(\d{1,2})/(\d{2,4})', s)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    try:
        return datetime(y, mo, d).date()
    except Exception:
        return None


def extract_first_url(s: str) -> str:
    if not s:
        return ''
    m = re.search(r'https?://[\S]+', s)
    return m.group(0).rstrip('.,;') if m else ''


def main():
    import openpyxl
    wb = openpyxl.load_workbook(XLSX, data_only=False)
    ws = wb['Sheet1']

    def reinterpret(d):
        """Excel may have stored some D/M/YY cells as M/D/YY dates. If the
        candidate is far from the trip range, try swapping day/month."""
        if abs((d - TRIP_START).days) <= 14:
            return d
        try:
            swapped = datetime(d.year, d.day, d.month).date()
            if abs((swapped - TRIP_START).days) <= 14:
                return swapped
        except Exception:
            pass
        return d

    items = []
    current_day_num = 0
    current_date = None
    position_in_day = 0

    for row in ws.iter_rows(values_only=True, min_row=2):
        date_cell, time_cell, itinerary, remarks, parking, maps, hotel, est, ppn = row[:9]

        if isinstance(date_cell, datetime):
            current_date = reinterpret(date_cell.date())
        elif isinstance(date_cell, str):
            d = split_dates(date_cell)
            if d:
                current_date = d
        # Skip rows that are blank or where we have no current_date and no itinerary
        title = (itinerary or '').strip() if itinerary else ''
        if not title and not (remarks or maps or hotel):
            continue
        if current_date is None:
            continue

        if (current_date - TRIP_START).days >= 0:
            new_day_num = (current_date - TRIP_START).days + 1
        else:
            new_day_num = 1
        if new_day_num != current_day_num:
            current_day_num = new_day_num
            position_in_day = 0
        position_in_day += 1

        # Use hotel column as a backup title source for accommodation rows.
        if not title and hotel:
            title = (str(hotel).split('\n', 1)[0] or '').strip()[:120]

        notes_parts = []
        if remarks:  notes_parts.append(f'Remarks: {str(remarks).strip()}')
        if parking:  notes_parts.append(f'Parking: {str(parking).strip()}')
        if hotel and title and 'http' not in title:
            hotel_str = str(hotel).strip()
            # Avoid duplicating the title in notes
            if hotel_str.split('\n', 1)[0] not in title:
                notes_parts.append(f'Hotel: {hotel_str}')
        notes = '\n'.join(notes_parts).strip()

        # Categorize
        category_text = title + ' ' + (notes or '')
        if hotel:
            category = 'Accommodation'
        else:
            category = categorize(category_text)

        # Maps URL: prefer the dedicated Maps column
        map_url = ''
        if maps:
            map_url = extract_first_url(str(maps)) or str(maps).strip()
        # Secondary link: Airbnb / hotel link from the Hotel column
        link = ''
        if hotel:
            link = extract_first_url(str(hotel))
        if not link and parking:
            link = extract_first_url(str(parking))

        cost_note = ''
        if est:
            cost_note = str(est).strip()
        elif ppn and not str(ppn).startswith('='):
            cost_note = str(ppn).strip()

        item = {
            'day_num': current_day_num,
            'date': current_date.isoformat(),
            'time': normalize_time(time_cell),
            'title': title or '(untitled)',
            'notes': notes,
            'category': category,
            'map_url': map_url,
            'link': link,
            'cost_note': cost_note,
            'position': position_in_day,
        }
        items.append(item)

    print(f'Parsed {len(items)} items')
    if DRY_RUN:
        for it in items[:5]:
            print(json.dumps(it, indent=2, ensure_ascii=False))
        print('...')
        for it in items[-5:]:
            print(json.dumps(it, indent=2, ensure_ascii=False))
        return

    ok, fail = 0, 0
    for it in items:
        body = json.dumps({'action': 'addItinerary', 'passcode': PASSCODE, 'actor': 'm1', 'item': it}).encode()
        req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'text/plain;charset=utf-8'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                resp = json.loads(r.read())
                if resp.get('ok'):
                    ok += 1
                else:
                    fail += 1
                    print('  FAIL:', it.get('title'), '->', resp.get('error'))
        except Exception as e:
            fail += 1
            print('  ERR :', it.get('title'), '->', e)
        if (ok + fail) % 10 == 0:
            print(f'  progress: {ok + fail}/{len(items)} (ok={ok} fail={fail})')

    print(f'Done. ok={ok} fail={fail}')


if __name__ == '__main__':
    main()
