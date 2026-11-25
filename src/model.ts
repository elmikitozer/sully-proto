import { data, dijkstra, nodeOf, pathTo, pathLength, type Poi, type Pt } from './router'

export type Lang = 'fr' | 'en'
export const terminalOf = (x: number, y: number) => (x > -147 ? 'Orly 4' : y > 50 && x < -200 ? 'Orly 1' : x > -397 ? 'Orly 3' : y > -22 ? 'Orly 1' : 'Orly 2')

// --- Named places -----------------------------------------------------------
const withTerminal = (p: Poi): Poi => ({ ...p, terminal: p.terminal ?? terminalOf(p.x, p.y) })
// Gates: real numbers and positions, from the airport's plan.
export const gates: Poi[] = data.pois.filter((p) => p.c === 'gate').map(withTerminal)

// Security checkpoints: the real ones. The plan draws one pictogram per lane type
// (standard, "Accès N° 1" priority lane, reduced mobility); lanes side by side are one checkpoint.
// Waiting times are simulated (a real version would read ADP queue sensors).
export interface Checkpoint extends Poi { id: number; name: string; terminal: string; priority: boolean; assisted: boolean; lanes: Poi[] }
export const checkpoints: Checkpoint[] = (() => {
  const groups: Poi[][] = []
  for (const p of data.pois) {
    if (p.c !== 'security' || p.sub || p.l < 1) continue
    const g = groups.find((q) => q[0].l === p.l && Math.hypot(q[0].x - p.x, q[0].y - p.y) < 30)
    if (g) g.push(p); else groups.push([p])
  }
  const perTerminal: Record<string, number> = {}
  const heads = groups.map((g) => ({ g, head: withTerminal(g.find((p) => !p.name) ?? g[0]) })).sort((a, b) => a.head.x - b.head.x)
  for (const { head } of heads) perTerminal[head.terminal!] = (perTerminal[head.terminal!] ?? 0) + 1
  const seen: Record<string, number> = {}
  return heads.map(({ g, head }, id) => {
    const t = head.terminal!
    seen[t] = (seen[t] ?? 0) + 1
    return { ...head, id, terminal: t, name: perTerminal[t] > 1 ? `${t} · ${String.fromCharCode(64 + seen[t])}` : t, priority: g.some((p) => p.name === 'N1'), assisted: g.some((p) => p.name === 'PHMR'), lanes: g }
  })
})()
export const waitMin = (p: Poi) => [4, 12, 7, 15, 5, 9, 11, 6][(p.id ?? 0) % 8]
/** Passport control desks (border police), departures side. */
export const borders: Poi[] = data.pois.filter((p) => p.c === 'security' && p.sub === 'border' && p.l >= 1).map(withTerminal)

export type StopKind = 'restaurant' | 'toilet' | 'info'
// A stop on the way to the gate is taken after security: only places in the restricted zone.
export const stopPois = (k: StopKind) => data.pois.filter((p) => p.c === k && p.z === 'r' && (k !== 'restaurant' || p.name))

// --- Flights (demo data) ----------------------------------------------------
import { flights, type Flight } from './flights-data'
export { flights, type Flight }
export const findFlight = (q: string) => {
  const n = q.toUpperCase().replace(/\s+/g, '')
  return flights.find((f) => f.code.replace(/\s+/g, '') === n || (n.length >= 3 && f.code.replace(/\s+/g, '').includes(n)))
}

// --- Start points (all on the public side) -----------------------------------------------------------
export interface Start { id: string; label: { fr: string; en: string }; pt: Pt }
export const starts: Start[] = [
  { id: 'm14', label: { fr: 'Métro 14 (Orly 3)', en: 'Metro line 14 (Orly 3)' }, pt: { l: 0, x: -320, y: -95 } },
  { id: 'o1', label: { fr: 'Entrée Orly 1', en: 'Orly 1 entrance' }, pt: { l: 0, x: -520, y: 140 } },
  { id: 'o4', label: { fr: 'Entrée Orly 4', en: 'Orly 4 entrance' }, pt: { l: 0, x: 420, y: 40 } },
]

// --- Itinerary --------------------------------------------------------------
export const WALK = 1.2 // m/s, relaxed pace with luggage
export type LegKind = 'toSecurity' | 'toPassport' | 'toStop' | 'toGate'
export interface Leg { kind: LegKind; path: Pt[]; metres: number; target: Poi }
export interface Plan { legs: Leg[]; security: Poi; gate: Poi; stop?: Poi; passport?: Poi; walkMin: number; waitMin: number; passportMin: number; stopMin: number; totalMin: number; alternatives: { p: Poi; total: number }[] }

/** Passport control for non-Schengen flights: real desk location, simulated wait. */
export const PASSPORT_MIN = 8
export const STOP_MIN: Record<StopKind, number> = { restaurant: 15, toilet: 5, info: 3 }

export function plan(start: Pt, flight: Flight, stopKind?: StopKind): Plan | null {
  const gate = gates.find((g) => g.name === flight.gate) ?? gates.find((g) => g.terminal === flight.terminal)!
  const s = nodeOf(start), gN = nodeOf(gate)
  if (s < 0 || gN < 0) return null
  const fs = dijkstra(s), fg = dijkstra(gN)
  // Pick the checkpoint minimising walk + queue.
  const scored = checkpoints.filter((p) => p.terminal === gate.terminal).map((p) => {
    const n = nodeOf(p)
    const m = fs.dist[n] + fg.dist[n]
    return { p, n, total: m / WALK / 60 + waitMin(p) }
  }).filter((x) => isFinite(x.total)).sort((a, b) => a.total - b.total)
  if (!scored.length) return null // (checkpoints of the gate's own terminal only)
  const best = scored[0]
  const legs: Leg[] = []
  const p1 = pathTo(fs, best.n)
  legs.push({ kind: 'toSecurity', path: p1, metres: pathLength(p1), target: best.p })
  let at = best.n, fat = dijkstra(at)
  const go = (kind: LegKind, target: Poi) => {
    const n = nodeOf(target), path = pathTo(fat, n)
    legs.push({ kind, path, metres: pathLength(path), target })
    at = n; fat = dijkstra(n)
  }
  // Non-Schengen: through the border police desk of the gate's terminal that adds the least walking.
  let passport: Poi | undefined
  if (flight.nonSchengen) {
    let bd = Infinity
    for (const b of borders) {
      if (b.terminal !== gate.terminal) continue
      const n = nodeOf(b), d = fat.dist[n] + fg.dist[n]
      if (isFinite(d) && d < bd) { bd = d; passport = b }
    }
    if (passport) go('toPassport', passport)
  }
  let stop: Poi | undefined
  if (stopKind) {
    let bd = Infinity
    for (const p of stopPois(stopKind)) {
      const n = nodeOf(p), d = fat.dist[n] + fg.dist[n]
      if (isFinite(d) && d < bd) { bd = d; stop = withTerminal(p) }
    }
    if (stop) go('toStop', stop)
  }
  go('toGate', gate)
  const metres = legs.reduce((a, l) => a + l.metres, 0)
  const lifts = legs.reduce((a, l) => a + l.path.filter((p, i) => i > 0 && p.l !== l.path[i - 1].l).length, 0)
  const walkMin = Math.ceil((metres / WALK + lifts * 45) / 60)
  const w = waitMin(best.p)
  const stopMin = stopKind && stop ? STOP_MIN[stopKind] : 0
  const passportMin = flight.nonSchengen ? PASSPORT_MIN : 0
  return { legs, security: best.p, gate, stop, passport, walkMin, waitMin: w, passportMin, stopMin, totalMin: walkMin + w + passportMin + stopMin, alternatives: scored.slice(1, 3).map((x) => ({ p: x.p, total: Math.round(x.total) })) }
}

// --- Explore: any place, with walking time ------------------------------------
export type PlaceKind = 'toilet' | 'restaurant' | 'shop' | 'info' | 'gate' | 'security' | 'checkin' | 'service' | 'transport'
export const PLACE_KINDS: PlaceKind[] = ['restaurant', 'shop', 'toilet', 'gate', 'security', 'checkin', 'service', 'info', 'transport']
export interface Place extends Poi { pid: number; kind: PlaceKind; terminal: string }

/** Every searchable place. `pid` is the index in data.pois, stable across builds of the same data. */
export const places: Place[] = data.pois.flatMap((p, pid) => {
  if (!PLACE_KINDS.includes(p.c as PlaceKind)) return []
  const kind = p.c as PlaceKind
  let name = p.name
  if (kind === 'security' && !p.sub) {
    // One entry per checkpoint, not one per lane pictogram.
    const cp = checkpoints.find((g) => g.x === p.x && g.y === p.y && g.l === p.l)
    if (!cp) return []
    name = cp.name
  }
  return [{ ...p, pid, kind, name, terminal: p.terminal ?? terminalOf(p.x, p.y) }]
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
/** Which side of security a place is on, as given by the airport's plan. A checkpoint is the border itself. */
export type Zone = 'public' | 'airside'
export const zoneOf = (p: Poi): Zone | undefined =>
  p.c === 'gate' ? 'airside' : p.c === 'security' && !p.sub ? undefined : p.z === 'r' ? 'airside' : p.z === 'p' ? 'public' : undefined
/** Checkpoint used to go between `from` and a place on the other side of security, with its queue. */
export function gateQueue(from: Pt, to: Pt & { terminal?: string }): { cp: Checkpoint; wait: number } | null {
  const f = fieldFrom(from)
  let best: { cp: Checkpoint; wait: number; t: number } | null = null
  const own = checkpoints.filter((cp) => cp.terminal === to.terminal)
  for (const cp of own.length ? own : checkpoints) {
    const d = f.dist[nodeOf(cp)]; if (!isFinite(d)) continue
    const t = (d + Math.hypot(cp.x - to.x, cp.y - to.y) + (cp.l === to.l ? 0 : 60)) / WALK / 60 + waitMin(cp)
    if (!best || t < best.t) best = { cp, wait: waitMin(cp), t }
  }
  return best
}
/**
 * Walking minutes from `from` to every place (one Dijkstra, cached per start point).
 * `fromZone` is the side of security `from` is on: reaching a place on the other side adds the security queue.
 */
export function walkTimes(from: Pt, fromZone: Zone = 'public'): Map<number, number> {
  const f = fieldFrom(from)
  const out = new Map<number, number>()
  for (const p of places) {
    const d = f.dist[nodeOf(p)]
    if (!isFinite(d)) continue
    const z = zoneOf(p)
    out.set(p.pid, Math.max(1, Math.ceil(d / WALK / 60)) + (z && z !== fromZone ? gateQueue(from, p)?.wait ?? 0 : 0)) // ceil, like routeToPlace
  }
  return out
}
export interface PlaceRoute { path: Pt[]; metres: number; walkMin: number; queueMin?: number; via?: string }
/** Route from a public start point to a place. Anything in the restricted zone is reached through a checkpoint. */
export function routeToPlace(from: Pt, place: Place): PlaceRoute | null {
  const f = fieldFrom(from)
  const n = nodeOf(place)
  if (!isFinite(f.dist[n])) return null
  const q = zoneOf(place) === 'airside' ? gateQueue(from, place) : null
  const path = q ? [...pathTo(f, nodeOf(q.cp)), ...pathTo(dijkstra(nodeOf(q.cp)), n).slice(1)] : pathTo(f, n)
  if (!path.length) return null
  const metres = pathLength(path)
  const lifts = path.filter((p, i) => i > 0 && p.l !== path[i - 1].l).length
  return { path, metres, walkMin: Math.max(1, Math.ceil((metres / WALK + lifts * 45) / 60)) + (q?.wait ?? 0), queueMin: q?.wait, via: q?.cp.name }
}
