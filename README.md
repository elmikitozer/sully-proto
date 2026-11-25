# Sully, prototype Orly

Web app React + TypeScript (Vite). Vercel builds it from this repo on every push (`vercel.json`): `main` goes to https://sully-proto.vercel.app, every PR gets a preview link.

```bash
npm ci
npm run dev     # http://localhost:5173
npm run build   # type check + production build in dist/
npm run lint
```

## Code
- `prep_data.py`: turns Baptiste's data (`orly-3d-passation/visualiser/public/orly_*.json`) into `src/data.json`: floor plans of levels -1 to 2, walkable grid (zones minus walls, 1.5 m cells), POIs (security, food, toilets, info, gates), lifts.
- `src/router.ts`: multi-level Dijkstra on the grid, lifts link the levels, path smoothing.
- `src/model.ts`: demo flights, gates (real positions, made-up numbers), security checkpoint choice (walk + simulated queue), optional stop.
- `src/route.ts`: URL of each screen (`/`, `/flight/SL1204?from=m14&stop=toilet`, `/flight/SL1204/go`), browser back button.
- `src/storage.ts`: what the app remembers between visits (language, start point, last trip).
- `src/App.tsx`, `src/MapView.tsx`: Home / Trip / Guidance screens, SVG map, FR/EN.

## Demo data
Gate numbers, flights and security waiting times are made up. The Metro 14 position is approximate. The indoor plan comes from parisaeroport.fr, not from open data.

## Data sources

- Floor plans and lifts: public parisaeroport.fr map, via `prep_data.py`.
- Every point of interest (gates, security checkpoints, passport control, check-in, shops, food outlets, toilets, services, transport), with its official name, category, terminal and public / restricted zone: the airport's public interactive plan (parisaeroport.fr/planpoi), read on 25 Nov 2026 into `data/adp_orly_poi.txt` and built by `tools/build_pois.py` into `src/pois.json`. Not open data: fine for a student prototype, ask ADP before any public launch. No ADP photo or description text is copied.
- Flights, queue times and offers are fictional demo data.
- Photos of named shops and food outlets: Google Places API (New), through `api/photo.ts`. Set `GOOGLE_PLACES_KEY` in the Vercel project; without it the app shows its illustrations.
