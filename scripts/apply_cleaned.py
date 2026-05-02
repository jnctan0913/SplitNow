#!/usr/bin/env python3
"""Apply scripts/cleaned_itinerary.json to the live SplitNow itinerary."""
import json, os, sys, urllib.request
from pathlib import Path

URL = os.environ.get('SHEETS_API_URL')
PASSCODE = os.environ.get('PASSCODE')
if not URL or not PASSCODE:
    print('Set SHEETS_API_URL and PASSCODE', file=sys.stderr); sys.exit(1)

ROOT = Path(__file__).resolve().parent
cleaned = json.loads((ROOT / 'cleaned_itinerary.json').read_text())

req = urllib.request.Request(URL + '?action=itinerary&passcode=' + PASSCODE)
with urllib.request.urlopen(req, timeout=30) as r:
    current = json.loads(r.read())['data']

by_key = {(c.get('day_num'), c.get('position')): c for c in current}

def post(action, payload):
    body = json.dumps({'action': action, 'passcode': PASSCODE, 'actor': 'm1', **payload}).encode()
    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'text/plain;charset=utf-8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

updated = 0
fail = 0
for c in cleaned:
    key = (c['day_num'], c['position'])
    cur = by_key.get(key)
    fields = {k: c[k] for k in ('title', 'notes', 'category', 'map_url', 'link', 'cost_note')}
    if cur:
        r = post('updateItinerary', {'id': cur['id'], 'fields': fields})
    else:
        r = post('addItinerary', {'item': c})
    if r.get('ok'):
        updated += 1
    else:
        fail += 1
        print('FAIL', key, r.get('error'))
    if (updated + fail) % 10 == 0:
        print(f'  progress {updated + fail}/{len(cleaned)}')

print(f'Done. ok={updated} fail={fail}')
