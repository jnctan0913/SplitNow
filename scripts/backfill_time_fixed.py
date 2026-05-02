#!/usr/bin/env python3
"""Mark which itinerary items had original (xlsx) times vs filled-in arbitrary
times. Items I filled get time_fixed=false; everything else gets time_fixed=true."""
import json, os, sys, urllib.request

URL = os.environ.get('SHEETS_API_URL')
PASSCODE = os.environ.get('PASSCODE')
if not URL or not PASSCODE:
    print('Set SHEETS_API_URL and PASSCODE', file=sys.stderr); sys.exit(1)

# (day, position) keys for items where the xlsx time column was empty and we
# filled in a sensible wallclock. These should NOT show a time pill in the list.
UNFIXED = {
    (2, 5), (2, 6),
    (3, 11),
    (4, 8), (4, 9),
    (5, 2), (5, 3), (5, 4), (5, 5), (5, 6), (5, 7), (5, 8), (5, 9), (5, 10), (5, 11),
    (6, 2), (6, 3), (6, 4), (6, 5), (6, 6), (6, 7), (6, 8), (6, 9), (6, 10), (6, 11),
    (6, 13), (6, 15), (6, 16),
    (7, 8), (7, 9), (7, 10), (7, 11), (7, 12), (7, 13),
    (8, 4), (8, 5),
}

with urllib.request.urlopen(URL + '?action=itinerary&passcode=' + PASSCODE, timeout=30) as r:
    items = json.loads(r.read())['data']

def post(payload):
    body = json.dumps({'action': 'updateItinerary', 'passcode': PASSCODE, 'actor': 'm1', **payload}).encode()
    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'text/plain;charset=utf-8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

ok, fail = 0, 0
for it in items:
    if it.get('deleted_at'): continue
    key = (it.get('day_num'), it.get('position'))
    fixed = key not in UNFIXED
    r = post({'id': it['id'], 'fields': {'time_fixed': fixed}})
    if r.get('ok'):
        ok += 1
    else:
        fail += 1
        print('FAIL', key, r.get('error'))
    if (ok + fail) % 15 == 0:
        print(f'  progress {ok + fail}/{len(items)}')

print(f'Done. ok={ok} fail={fail}')
