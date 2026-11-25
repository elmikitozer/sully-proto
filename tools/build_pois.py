"""Build src/pois.json from data/adp_orly_poi.txt.

Source: the public Paris-Orly interactive plan (parisaeroport.fr/planpoi), read on 25 Nov 2026:
position of every point of interest (POIs.json) and, for each, its official name, category,
terminal and zone ("Zone publique" / "Zone réservée") from the plan's own detail panel.
File format: a DICT block (name|category|terminal|p or r) then ROWS (level,dlon,dlat,dict index;
offsets in 1e-6 degrees from lon 2.366, lat 48.7285).
Run from the repo root: python3 tools/build_pois.py
"""
import json, math, re, collections

D = json.load(open('src/data.json'))
pj = D['proj']
txt = open('data/adp_orly_poi.txt', encoding='utf-8').read()
d, r = txt.split('\nROWS\n')
dic = [x.split('|') for x in d.split('\n')[1:]]

FOOD = {'Boulangerie': 'bakery', 'Coffee Shop': 'cafe', 'Brasserie': 'restaurant', 'Fast Food': 'fast_food', 'Cuisine de chef': 'restaurant',
        'Sain & Gourmand': 'fast_food', 'Spécialités italiennes': 'restaurant'}
SHOP = {'Gastronomie': 'gourmet', 'Beauté, Alcool, Gastronomie, Tabac, Multimédia et Mode': 'dutyfree', 'Beauté': 'beauty',
        'Divertissement, Presse, Multimédia': 'news', 'Horlogerie, Bijouterie': 'watches', 'Luxe, Mode, Accessoires': 'fashion',
        'Santé, Détente, Supérette': 'convenience', 'Pharmacie': 'pharmacy', 'Change': 'exchange', 'Change, Détaxe': 'exchange'}
TRANSPORT = {'Bus': 'bus', 'Taxi': 'taxi', 'ORLYVAL': 'orlyval', 'Transports en commun': 'metro', 'Navette Hôtels': 'bus', 'Dépose minute': 'dropoff'}
SERVICE = {'Table à langer': 'baby', 'Repos pour les tout petits': 'baby', 'Jeux pour enfants': 'kids', 'Jeux Vidéos': 'games', 'Salons': 'lounge',
           'Distributeur de billets': 'atm', 'Distributeur de billets multidevises': 'atm', 'Distribution eau fraîche': 'water',
           'Point Détaxe': 'taxrefund', 'Détaxe': 'taxrefund', 'Livraison bagages': 'baggage', 'Services Bagages': 'bagservice',
           'Emballage des bagages, pesée des bagages et accessoires de voyage': 'bagwrap', 'Espace Prière': 'prayer', 'Espace fumeurs': 'smoking',
           'Rechargement de smartphone': 'charge', 'Espace ASSISTANCE MOBILITÉ': 'assist', 'Centre médical et urgences': 'medical',
           'Objets trouvés': 'lost', 'Espace Détente': 'rest', 'Consigne, vente, location': 'luggage', 'Espace canin': 'dog', 'Espace cinéma': 'cinema'}
# Names kept as written by the airport only for these (brands, lounges, numbered things).
out = []
for row in r.split(';'):
    lv, dx, dy, k = row.split(',')
    if int(k) < 0 or lv not in ('-1', '0', '1', '2'): continue
    t, s, term, z = dic[int(k)]
    if z not in 'pr': continue
    x, y = int(dx) * 1e-6 * pj['mx'], int(dy) * 1e-6 * pj['my']
    name, sub = t, None
    if s == "Portes d'embarquement":
        m = re.fullmatch(r'Porte ([A-F])0?(\d+)', t)
        if not m: continue
        c, name = 'gate', f'{m.group(1)}{int(m.group(2)):02d}'
    elif s == 'Contrôles Sûreté': c, name = 'security', ('PHMR' if 'PHMR' in t else 'N1' if 'Accès' in t else '')
    elif s.startswith('Contrôle frontière'): c, sub, name = 'security', ('parafe' if 'PARAFE' in s else 'border'), ''
    elif s == 'Enregistrement':
        m = re.search(r'(\d+)( HF)?$', t)
        c, name = 'checkin', (m.group(1) + (' HF' if m.group(2) else '') if m else ('' if 'Borne' not in t else 'kiosk'))
    elif s in FOOD: c, sub = 'restaurant', FOOD[s]
    elif s in SHOP: c, sub = 'shop', SHOP[s]
    elif s == 'Services Pratiques' and t == 'Toilettes': c, name = 'toilet', ''
    elif s in ('Information et Orientation', 'Information Transports'): c, sub, name = 'info', ('kiosk' if 'Borne' in t else 'desk'), ''
    elif s in TRANSPORT: c, sub = 'transport', TRANSPORT[s]
    elif s in SERVICE: c, sub = 'service', SERVICE[s]; name = t if sub in ('lounge', 'baggage', 'taxrefund') else ''
    else: continue
    p = {'c': c, 'l': int(lv), 'x': round(x, 1), 'y': round(y, 1), 'i': 'adp', 'z': z}
    if name: p['name'] = re.sub(r'\s+', ' ', name).replace('Starbucks Coffee', 'Starbucks')
    if sub: p['sub'] = sub
    if term in '1234': p['terminal'] = 'Orly ' + term
    out.append(p)

# The plan lists some points twice (two pictograms for one place): keep one.
ded = []
for p in out:
    near = 4 if p['c'] in ('gate', 'restaurant', 'shop') else 3
    if any(q['c'] == p['c'] and q['l'] == p['l'] and q.get('name') == p.get('name') and q.get('sub') == p.get('sub') and math.hypot(q['x'] - p['x'], q['y'] - p['y']) < near for q in ded): continue
    if p['c'] == 'gate' and any(q['c'] == 'gate' and q['name'] == p['name'] for q in ded): continue
    ded.append(p)
json.dump({'source': 'parisaeroport.fr interactive plan, read 2026-11-25', 'pois': ded}, open('src/pois.json', 'w'), ensure_ascii=False, separators=(',', ':'))

rows = []
for i, p in enumerate(ded):
    if p['c'] in ('shop', 'restaurant') and p.get('name'):
        lat, lon = pj['lat0'] + p['y'] / pj['my'], pj['lon0'] + p['x'] / pj['mx']
        rows.append(f"  a{i}: {{ n: {json.dumps(p['name'], ensure_ascii=False)}, lat: {lat:.6f}, lon: {lon:.6f} }},")
open('src/photo-places.ts', 'w').write('// Generated by tools/build_pois.py. Do not edit.\nexport const PHOTO_PLACES: Record<string, { n: string; lat: number; lon: number }> = {\n' + '\n'.join(rows) + '\n}\n')
print(len(ded), collections.Counter((p['c'], p['z']) for p in ded))
print(sorted(set(p['name'] for p in ded if p['c'] in ('restaurant', 'shop'))))
print(sorted(p['name'] for p in ded if p['c'] == 'gate'))
print({p['name']: p.get('terminal') for p in ded if p['c'] == 'gate' and p['name'] in ('A17', 'C16', 'D17', 'F26', 'F09')})
