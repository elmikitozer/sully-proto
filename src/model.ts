import { data, dijkstra, nodeOf, pathTo, pathLength, type Poi, type Pt } from './router'

export type Lang = 'fr' | 'en'
export const terminalOf = (x: number, y: number) => (x > -147 ? 'Orly 4' : y > 50 && x < -200 ? 'Orly 1' : x > -397 ? 'Orly 3' : y > -22 ? 'Orly 1' : 'Orly 2')

// --- Named places -----------------------------------------------------------
// Gate positions and numbers come from OpenStreetMap (real Orly gate numbers).
export const gates: Poi[] = data.pois.filter((p) => p.c === 'gate').map((p) => ({ ...p, terminal: terminalOf(p.x, p.y) }))

// Security checkpoints = security pictograms on the departures level.
// Waiting times are simulated (a real version would read ADP queue sensors).
export const checkpoints: Poi[] = (() => {
  const s = data.pois.filter((p) => p.c === 'security' && p.l === 1).map((p) => ({ ...p, terminal: terminalOf(p.x, p.y) }))
  const count: Record<string, number> = {}
  return s.sort((a, b) => a.x - b.x).map((p, i) => {
    const t = p.terminal!
    count[t] = (count[t] ?? 0) + 1
    return { ...p, id: i, name: `${t} · ${String.fromCharCode(64 + count[t])}` }
  })
})()
export const waitMin = (p: Poi) => [4, 12, 7, 15, 5, 9, 11, 6][(p.id ?? 0) % 8]

export type StopKind = 'restaurant' | 'toilet' | 'info'
export const stopPois = (k: StopKind) => data.pois.filter((p) => p.c === k && (p.l === 1 || p.l === 2) && (k !== 'restaurant' || p.name))

// --- Flights (demo data) ----------------------------------------------------
import { flights, type Flight } from './flights-data'
export { flights, type Flight }
export const findFlight = (q: string) => {
  const n = q.toUpperCase().replace(/\s+/g, '')
  return flights.find((f) => f.code.replace(/\s+/g, '') === n || (n.length >= 3 && f.code.replace(/\s+/g, '').includes(n)))
}

// --- Start points -----------------------------------------------------------
export interface Start { id: string; label: { fr: string; en: string }; pt: Pt }
export const starts: Start[] = [
  { id: 'm14', label: { fr: 'Métro 14 / Orlyval', en: 'Metro line 14 / Orlyval' }, pt: { l: 0, x: -73, y: -22 } },
  { id: 'o1', label: { fr: 'Entrée Orly 1', en: 'Orly 1 entrance' }, pt: { l: 0, x: -520, y: 140 } },
  { id: 'o4', label: { fr: 'Entrée Orly 4', en: 'Orly 4 entrance' }, pt: { l: 0, x: 420, y: 40 } },
]

// --- Itinerary --------------------------------------------------------------
export const WALK = 1.2 // m/s, relaxed pace with luggage
export type LegKind = 'toSecurity' | 'toStop' | 'toGate'
export interface Leg { kind: LegKind; path: Pt[]; metres: number; target: Poi }
export interface Plan { legs: Leg[]; security: Poi; gate: Poi; stop?: Poi; walkMin: number; waitMin: number; stopMin: number; totalMin: number; alternatives: { p: Poi; total: number }[] }

export const STOP_MIN: Record<StopKind, number> = { restaurant: 15, toilet: 5, info: 3 }

export function plan(start: Pt, flight: Flight, stopKind?: StopKind): Plan | null {
  const gate = gates.find((g) => g.name === flight.gate) ?? gates.find((g) => g.terminal === flight.terminal)!
  const s = nodeOf(start), gN = nodeOf(gate)
  if (s < 0 || gN < 0) return null
  const fs = dijkstra(s), fg = dijkstra(gN)
  // Pick the checkpoint minimising walk + queue.
  const scored = checkpoints.map((p) => {
    const n = nodeOf(p)
    const m = fs.dist[n] + fg.dist[n]
    return { p, n, total: m / WALK / 60 + waitMin(p) }
  }).filter((x) => isFinite(x.total)).sort((a, b) => a.total - b.total)
  if (!scored.length) return null
  const best = scored[0]
  const fsec = dijkstra(best.n)
  const legs: Leg[] = []
  const p1 = pathTo(fs, best.n)
  legs.push({ kind: 'toSecurity', path: p1, metres: pathLength(p1), target: best.p })
  let stop: Poi | undefined
  if (stopKind) {
    let bestS: { p: Poi; n: number; d: number } | null = null
    for (const p of stopPois(stopKind)) {
      const n = nodeOf(p); const d = fsec.dist[n] + fg.dist[n]
      if (isFinite(d) && (!bestS || d < bestS.d)) bestS = { p, n, d }
    }
    if (bestS) {
      stop = { ...bestS.p, terminal: terminalOf(bestS.p.x, bestS.p.y) }
      const a = pathTo(fsec, bestS.n)
      legs.push({ kind: 'toStop', path: a, metres: pathLength(a), target: stop })
      const fst = dijkstra(bestS.n)
      const b = pathTo(fst, gN)
      legs.push({ kind: 'toGate', path: b, metres: pathLength(b), target: gate })
    }
  }
  if (!stop) { const b = pathTo(fsec, gN); legs.push({ kind: 'toGate', path: b, metres: pathLength(b), target: gate }) }
  const metres = legs.reduce((a, l) => a + l.metres, 0)
  const lifts = legs.reduce((a, l) => a + l.path.filter((p, i) => i > 0 && p.l !== l.path[i - 1].l).length, 0)
  const walkMin = Math.ceil((metres / WALK + lifts * 45) / 60)
  const w = waitMin(best.p)
  const stopMin = stopKind && stop ? STOP_MIN[stopKind] : 0
  return { legs, security: best.p, gate, stop, walkMin, waitMin: w, stopMin, totalMin: walkMin + w + stopMin, alternatives: scored.slice(1, 3).map((x) => ({ p: x.p, total: Math.round(x.total) })) }
}

// --- Explore: any place, with walking time ------------------------------------
export type PlaceKind = 'toilet' | 'restaurant' | 'shop' | 'info' | 'gate' | 'security' | 'transport'
export const PLACE_KINDS: PlaceKind[] = ['restaurant', 'shop', 'toilet', 'gate', 'info', 'security', 'transport']
export interface Place extends Poi { pid: number; kind: PlaceKind; terminal: string }

/** Every searchable place. `pid` is the index in data.pois, stable across builds of the same data. */
export const places: Place[] = data.pois.flatMap((p, pid) => {
  if (!PLACE_KINDS.includes(p.c as PlaceKind)) return []
  if (p.c === 'restaurant' && !p.name) return [] // food pictogram with no known name: hidden until we have real data
  const kind = p.c as PlaceKind
  const named = kind === 'security' ? checkpoints.find((g) => g.x === p.x && g.y === p.y && g.l === p.l)?.name : p.name
  return [{ ...p, pid, kind, name: named, terminal: terminalOf(p.x, p.y) }]
})
/** Where to write each terminal's name on the map: centre of its gates. */
export const terminalLabels = ['Orly 1', 'Orly 2', 'Orly 3', 'Orly 4'].map((name) => {
  const g = gates.filter((p) => p.terminal === name)
  return { name, x: g.reduce((a, p) => a + p.x, 0) / g.length, y: g.reduce((a, p) => a + p.y, 0) / g.length }
})
export const placeById = (pid: number) => places.find((p) => p.pid === pid)

const fieldCache = new Map<string, ReturnType<typeof dijkstra>>()
const fieldFrom = (pt: Pt) => {
  const k = `${pt.l}:${pt.x}:${pt.y}`
  let f = fieldCache.get(k)
  if (!f) { f = dijkstra(nodeOf(pt)); fieldCache.set(k, f) }
  return f
}
/** Walking minutes from `from` to every place (one Dijkstra, cached per start point). */
export function walkTimes(from: Pt): Map<number, number> {
  const f = fieldFrom(from)
  const out = new Map<number, number>()
  for (const p of places) {
    const d = f.dist[nodeOf(p)]
    if (isFinite(d)) out.set(p.pid, Math.max(1, Math.ceil(d / WALK / 60))) // ceil, like routeToPlace
  }
  return out
}
export interface PlaceRoute { path: Pt[]; metres: number; walkMin: number }
export function routeToPlace(from: Pt, place: Place): PlaceRoute | null {
  const f = fieldFrom(from)
  const n = nodeOf(place)
  if (!isFinite(f.dist[n])) return null
  const path = pathTo(f, n)
  const metres = pathLength(path)
  const lifts = path.filter((p, i) => i > 0 && p.l !== path[i - 1].l).length
  return { path, metres, walkMin: Math.max(1, Math.ceil((metres / WALK + lifts * 45) / 60)) }
}
