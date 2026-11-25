import { data, dijkstra, nodeOf, pathTo, pathLength, type Poi, type Pt } from './router'

export type Lang = 'fr' | 'en'
export const terminalOf = (x: number, y: number) => (x > -147 ? 'Orly 4' : x > -397 ? 'Orly 3' : y > -22 ? 'Orly 1' : 'Orly 2')

// --- Named places -----------------------------------------------------------
// Gate POSITIONS come from the ADP plan (boarding pictograms, level 1).
// Gate NUMBERS are placeholders: the public plan does not carry them.
const GATE_BASE: Record<string, number> = { 'Orly 1': 10, 'Orly 2': 20, 'Orly 3': 30, 'Orly 4': 50 }
export const gates: Poi[] = (() => {
  const g = data.pois.filter((p) => p.c === 'gate').map((p) => ({ ...p, terminal: terminalOf(p.x, p.y) }))
  const out: Poi[] = []
  for (const t of Object.keys(GATE_BASE)) {
    const list = g.filter((p) => p.terminal === t).sort((a, b) => (t === 'Orly 1' ? b.y - a.y : a.x - b.x))
    list.forEach((p, i) => out.push({ ...p, name: String(GATE_BASE[t] + i) }))
  }
  return out
})()

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
export const stopPois = (k: StopKind) => data.pois.filter((p) => p.c === k && (p.l === 1 || p.l === 2))

// --- Flights (demo data) ----------------------------------------------------
export interface Flight { code: string; airline: string; city: { fr: string; en: string }; iata: string; terminal: string; gate: string; boardInMin: number }
export const flights: Flight[] = [
  { code: 'SL 1204', airline: 'Sully Air', city: { fr: 'Barcelone', en: 'Barcelona' }, iata: 'BCN', terminal: 'Orly 4', gate: '57', boardInMin: 70 },
  { code: 'SL 3310', airline: 'Sully Air', city: { fr: 'Nice', en: 'Nice' }, iata: 'NCE', terminal: 'Orly 2', gate: '24', boardInMin: 55 },
  { code: 'SL 0815', airline: 'Sully Air', city: { fr: 'Lisbonne', en: 'Lisbon' }, iata: 'LIS', terminal: 'Orly 3', gate: '35', boardInMin: 45 },
  { code: 'SL 2077', airline: 'Sully Air', city: { fr: 'Marrakech', en: 'Marrakesh' }, iata: 'RAK', terminal: 'Orly 1', gate: '14', boardInMin: 90 },
  { code: 'SL 0412', airline: 'Sully Air', city: { fr: 'Rome', en: 'Rome' }, iata: 'FCO', terminal: 'Orly 4', gate: '68', boardInMin: 35 },
]
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
export type PlaceKind = 'toilet' | 'restaurant' | 'info' | 'gate' | 'security'
export const PLACE_KINDS: PlaceKind[] = ['toilet', 'restaurant', 'info', 'gate', 'security']
export interface Place extends Poi { pid: number; kind: PlaceKind; terminal: string }

/** Every searchable place. `pid` is the index in data.pois, stable across builds of the same data. */
export const places: Place[] = data.pois.flatMap((p, pid) => {
  if (!PLACE_KINDS.includes(p.c as PlaceKind)) return []
  const kind = p.c as PlaceKind
  const named = kind === 'gate' ? gates.find((g) => g.x === p.x && g.y === p.y && g.l === p.l)?.name
    : kind === 'security' ? checkpoints.find((g) => g.x === p.x && g.y === p.y && g.l === p.l)?.name : undefined
  return [{ ...p, pid, kind, name: named, terminal: terminalOf(p.x, p.y) }]
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
    if (isFinite(d)) out.set(p.pid, Math.max(1, Math.round(d / WALK / 60)))
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
