#!/usr/bin/env python3
"""Set sensible times on itinerary items currently missing one, picked so the
order matches the original spreadsheet position. Run after apply_cleaned.py."""
import json, os, sys, urllib.request

URL = os.environ.get('SHEETS_API_URL')
PASSCODE = os.environ.get('PASSCODE')
if not URL or not PASSCODE:
    print('Set SHEETS_API_URL and PASSCODE', file=sys.stderr); sys.exit(1)

# (day_num, position) -> time string. Times use "H:MMAM/PM" for crisp parsing.
TIMES = {
    (2, 5):  '9:30PM',     # Drop luggage at Airbnb
    (2, 6):  '10:30PM',    # Supper + buy breakfast

    (3, 11): '11:00PM',    # Back to hotel

    (4, 8):  '7:00PM',     # Lawson run for breakfast
    (4, 9):  '8:00PM',     # Check in @ Airbnb

    (5, 2):  '6:00AM',     # Back to hotel, sleep, check out by 10AM
    (5, 3):  '10:30AM',    # 山中湖交流广场 photo stop
    (5, 4):  '11:00AM',    # Light breakfast @ W.HALE / NOAH
    (5, 5):  '12:00PM',    # Nagaike Water Park
    (5, 6):  '1:00PM',     # Lunch @ THE PARK
    (5, 7):  '2:30PM',     # 白鳥浜
    (5, 8):  '3:30PM',     # Drive to Kawaguchiko
    (5, 9):  '4:30PM',     # Check in @ Airbnb
    (5, 10): '6:30PM',     # Sunset @ Oishi Park
    (5, 11): '8:00PM',     # Dinner @ MIZUNOKAZE

    (6, 2):  '6:30AM',     # BYOB
    (6, 3):  '9:00AM',     # Maple Corridor
    (6, 4):  '10:00AM',    # Memorial Park
    (6, 5):  '10:30AM',    # Bridge
    (6, 6):  '11:30AM',    # ramen
    (6, 7):  '12:30PM',    # Lawson Fujikawaguchiko
    (6, 8):  '1:00PM',     # OGINO
    (6, 9):  '1:30PM',     # Ohagiya Motomochi
    (6, 10): '2:00PM',     # Fujisan Shokupan
    (6, 11): '3:00PM',     # Late lunch
    (6, 13): '7:00PM',     # Drop luggage in Tokyo
    (6, 15): '8:30PM',     # Dinner @ Tendon Itsuki
    (6, 16): '10:00PM',    # Back to Airbnb

    (7, 8):  '7:45PM',     # Foodshow
    (7, 9):  '8:30PM',     # Dinner Ikushika
    (7, 10): '10:00PM',    # Don Quijote
    (7, 11): '10:30PM',    # Tokyo Tower night
    (7, 12): '11:30PM',    # Back to Airbnb
    (7, 13): '11:45PM',    # Packing

    (8, 4):  '11:00PM',    # Cost (admin row, sort to end)
    (8, 5):  '11:30PM',    # IDP (admin row, sort to end)
}

req = urllib.request.Request(URL + '?action=itinerary&passcode=' + PASSCODE)
with urllib.request.urlopen(req, timeout=30) as r:
    items = json.loads(r.read())['data']

by_key = {(c.get('day_num'), c.get('position')): c for c in items}

def post(payload):
    body = json.dumps({'action': 'updateItinerary', 'passcode': PASSCODE, 'actor': 'm1', **payload}).encode()
    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'text/plain;charset=utf-8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

ok, fail = 0, 0
for key, t in TIMES.items():
    cur = by_key.get(key)
    if not cur:
        print('skip (not found):', key)
        continue
    r = post({'id': cur['id'], 'fields': {'time': t}})
    if r.get('ok'):
        ok += 1
    else:
        fail += 1
        print('FAIL', key, r.get('error'))
    if (ok + fail) % 10 == 0:
        print(f'  progress {ok + fail}/{len(TIMES)}')

print(f'Done. ok={ok} fail={fail}')
