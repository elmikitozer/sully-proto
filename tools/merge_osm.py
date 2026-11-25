"""Turn data/osm_orly.csv (OpenStreetMap, ODbL) into src/osm.json.

The CSV is the output of this Overpass query over Paris-Orly (25 Nov 2026):
  [out:csv(::type,::id,::lat,::lon,name,shop,amenity,cuisine,level,opening_hours,ref,aeroway;true;"|")];
  (nwr["shop"](48.720,2.350,48.737,2.385);
   nwr["amenity"~"restaurant|cafe|fast_food|bar|pharmacy|bureau_de_change|toilets|lounge|food_court|atm|bank"](same bbox);
   nwr["aeroway"="gate"](same bbox););out center;
Output: { drop: [indices of pictogram POIs replaced by OSM data], add: [POIs] }.
Run from the repo root: python3 tools/merge_osm.py
"""
import base64, csv, json, math, re
import numpy as np
from scipy import ndimage

D = json.load(open('src/data.json'))
pj, RES, W, H = D['proj'], D['res'], D['W'], D['H']
def pr(lat, lon): return ((lon - pj['lon0']) * pj['mx'], (lat - pj['lat0']) * pj['my'])
dist = {}
for lv, L in D['levels'].items():
    g = np.unpackbits(np.frombuffer(base64.b64decode(L['grid']), np.uint8))[:W * H].reshape(H, W).astype(bool)
    dist[int(lv)] = ndimage.distance_transform_edt(~g) * RES
def off(l, x, y):
    ix, iy = int((x - D['minx']) / RES), int((y - D['miny']) / RES)
    return dist[l][iy, ix] if 0 <= ix < W and 0 <= iy < H else 1e9

FOOD_AMENITY = {'cafe', 'fast_food', 'restaurant', 'bar'}
FOOD_SHOP = {'bakery'}
SKIP_SHOP = {'travel_agency', 'bicycle', 'ticket', 'convenience'}  # airline desks, fuel station, mis-tagged ATM
KEEP_CONVENIENCE = {'Carrefour City'}
CLOSED = {'Tie Rack'}  # chain no longer trading
RENAME = {'Exprime Duty Free': 'Extime Duty Free', 'extime Duty free': 'Extime Duty Free', 'RELAY': 'Relay',
          'BuY Paris Duty Free': 'Buy Paris Duty Free', 'Ladurée Orly Ouest': 'Ladurée', 'Pharmacie Orly Ouest': 'Pharmacie Orly'}

add = []
for r in csv.DictReader(open('data/osm_orly.csv'), delimiter='|'):
    x, y = pr(float(r['@lat']), float(r['@lon']))
    name = RENAME.get(r['name'], r['name'])
    if r['aeroway'] == 'gate':
        if not r['ref']: continue
        k, name, sub = 'gate', r['ref'].split(';')[0], ''
    elif r['amenity'] in FOOD_AMENITY or r['shop'] in FOOD_SHOP:
        if not name: continue
        k, sub = 'restaurant', (r['shop'] or r['amenity'])
    elif r['amenity'] in ('pharmacy', 'bureau_de_change'):
        k, sub = 'shop', r['amenity']
    elif r['shop'] and (r['shop'] not in SKIP_SHOP or name in KEEP_CONVENIENCE) and r['amenity'] != 'fuel':
        if not name or name in CLOSED or (name == 'Nespresso' and r['shop'] == 'pastry'): continue
        k, sub = 'shop', r['shop']
    else:
        continue
    # Level: the mapped one if we can walk there, otherwise the closest walkable floor (departures first).
    lv = [int(r['level'])] if re.fullmatch(r'-?\d', r['level']) else []
    l = min(lv + [1, 0, 2], key=lambda c: (off(c, x, y) > 12, lv[:1] != [c], off(c, x, y)))
    if off(l, x, y) > 25: continue  # not inside the mapped terminals (remote stands, car parks)
    add.append({'c': k, 'l': l, 'x': round(x, 1), 'y': round(y, 1), 'i': 'osm', 'name': name, 'sub': sub, 'h': r['opening_hours'], 'osm': f"{r['@type']}/{r['@id']}"})

# Same name mapped twice (node + way, or two entrances): keep the first with a level.
out = []
for p in add:
    if any(q['c'] == p['c'] and q['name'].lower().replace("d'", '') == p['name'].lower().replace("d'", '') and math.hypot(q['x'] - p['x'], q['y'] - p['y']) < (15 if p['c'] == 'gate' else 30) for q in out): continue
    if p['c'] == 'gate' and any(q['c'] == 'gate' and q['name'] == p['name'] for q in out): continue
    out.append(p)
for p in out:
    if not p['h']: del p['h']
    if not p['sub']: del p['sub']

# Pictograms replaced: every gate (OSM has the real numbers), and food pictograms sitting on a named OSM outlet.
drop = []
for i, p in enumerate(D['pois']):
    if p['c'] == 'gate': drop.append(i)
    elif p['c'] == 'restaurant' and any(q['c'] == 'restaurant' and math.hypot(q['x'] - p['x'], q['y'] - p['y']) < 22 for q in out): drop.append(i)
json.dump({'source': 'OpenStreetMap contributors (ODbL), fetched 2026-11-25', 'drop': drop, 'add': out}, open('src/osm.json', 'w'), ensure_ascii=False, separators=(',', ':'))
import collections
print(collections.Counter((p['c'], p['l']) for p in out), 'drop', len(drop), collections.Counter(D['pois'][i]['c'] for i in drop))
for p in out:
    if p['c'] != 'gate': print(p['c'], p['l'], p['name'], p.get('sub'), p.get('h', ''), round(off(p['l'], p['x'], p['y'])))
print(sorted(p['name'] for p in out if p['c'] == 'gate'))
