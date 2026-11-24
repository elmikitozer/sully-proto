# Sully — prototype 2D Orly

Web app React + TypeScript (Vite). `npm ci && npm run dev`, build en un seul fichier HTML : `npm run build`.

- `prep_data.py` : transforme les données du dossier de Baptiste (`orly-3d-passation/visualiser/public/orly_*.json`) en `src/data.json` : plans des niveaux -1 à 2, grille marchable (zones moins murs, pas de 1,5 m), POI (sûreté, restauration, toilettes, info, portes), ascenseurs.
- `src/router.ts` : Dijkstra multi-niveaux sur la grille, ascenseurs comme liens entre niveaux, lissage du tracé.
- `src/model.ts` : vols de démo, portes (positions réelles, numéros fictifs), choix du contrôle de sûreté (marche + attente simulée), arrêt optionnel.
- `src/App.tsx`, `src/MapView.tsx` : écrans Accueil / Parcours / Navigation, carte SVG, FR/EN.

Limites : numéros de porte, vols et temps d'attente fictifs ; position du Métro 14 approximative ; plan intérieur issu de parisaeroport.fr (pas de l'open data).
