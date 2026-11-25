// Multi-level grid router over the Orly floor plans (data from Baptiste's pipeline).
import raw from './data.json'
import adp from './pois.json'

export type Cat = 'security' | 'restaurant' | 'toilet' | 'info' | 'gate' | 'transport' | 'lift' | 'shop' | 'checkin' | 'service'
export interface Poi { c: Cat; l: number; x: number; y: number; i: string; id?: number; name?: string; terminal?: string; sub?: string; /** Zone given by the airport's plan: p = public, r = restricted (after security). */ z?: 'p' | 'r' }
interface Lift { s: string; l: number; x: number; y: number; serves: number[] }
interface LevelData { grid: string; zones: number[][][]; walls: number[][][] }
interface Data { res: number; minx: number; miny: number; W: number; H: number; levels: Record<string, LevelData>; pois: Poi[]; lifts: Lift[] }

export const data = raw as unknown as Data
// Points of interest come from the airport's own interactive plan (see tools/build_pois.py):
// official names, categories, terminal and public / restricted zone. Only the lifts stay from the floor-plan pipeline.
data.pois = (adp.pois as Poi[]).concat(data.pois.filter((p) => p.c === 'lift'))
export const LEVELS = [-1, 0, 1, 2]
const { W, H, res, minx, miny } = data
const N = W * H
const L = LEVELS.length

function decode(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(N)
  for (let i = 0; i < N; i++) out[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1
  return out
}
const walk: Uint8Array[] = LEVELS.map((lv) => decode(data.levels[String(lv)].grid))

export const toCell = (x: number, y: number) => {
  const cx = Math.min(W - 1, Math.max(0, Math.floor((x - minx) / res)))
  const cy = Math.min(H - 1, Math.max(0, Math.floor((y - miny) / res)))
  return cy * W + cx
}
export const cellXY = (c: number) => ({ x: minx + ((c % W) + 0.5) * res, y: miny + (Math.floor(c / W) + 0.5) * res })
const li = (lv: number) => LEVELS.indexOf(lv)

/** Nearest walkable cell on a level (spiral search). */
export function snap(lv: number, x: number, y: number): number {
  const g = walk[li(lv)]
  const c0 = toCell(x, y)
  if (g[c0]) return li(lv) * N + c0
  const cx = c0 % W, cy = Math.floor(c0 / W)
  for (let r = 1; r < 40; r++) {
    let best = -1, bd = 1e9
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const c = ny * W + nx
      if (g[c] && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = c }
    }
    if (best >= 0) return li(lv) * N + best
  }
  return -1
}

// Lift links between levels: same shaft, levels it serves.
const LIFT_COST = 35 // metres-equivalent (wait + ride)
const links = new Map<number, number[]>()
{
  const byShaft = new Map<string, Lift[]>()
  for (const l of data.lifts) { if (!LEVELS.includes(l.l)) continue; const a = byShaft.get(l.s) ?? []; a.push(l); byShaft.set(l.s, a) }
  for (const arr of byShaft.values()) {
    for (const a of arr) for (const b of arr) {
      if (a === b || a.l === b.l) continue
      if (!a.serves.includes(b.l) || !b.serves.includes(a.l)) continue
      const na = snap(a.l, a.x, a.y), nb = snap(b.l, b.x, b.y)
      if (na < 0 || nb < 0) continue
      const arrA = links.get(na) ?? []; if (!arrA.includes(nb)) arrA.push(nb); links.set(na, arrA)
    }
  }
}

// Binary heap Dijkstra over all levels.
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1]
const DC = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2].map((v) => v * res)

export interface Field { dist: Float64Array; prev: Int32Array }
const cache = new Map<number, Field>()
export function dijkstra(src: number): Field {
  const hit = cache.get(src); if (hit) return hit
  const T = N * L
  const dist = new Float64Array(T).fill(Infinity)
  const prev = new Int32Array(T).fill(-1)
  const heapN: number[] = [], heapD: number[] = []
  const push = (n: number, d: number) => {
    heapN.push(n); heapD.push(d); let i = heapN.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (heapD[p] <= d) break; heapN[i] = heapN[p]; heapD[i] = heapD[p]; i = p }
    heapN[i] = n; heapD[i] = d
  }
  const pop = () => {
    const n = heapN[0], d = heapD[0]; const ln = heapN.pop()!, ld = heapD.pop()!
    if (heapN.length) { let i = 0; const len = heapN.length
      for (;;) { let c = 2 * i + 1; if (c >= len) break; if (c + 1 < len && heapD[c + 1] < heapD[c]) c++; if (heapD[c] >= ld) break; heapN[i] = heapN[c]; heapD[i] = heapD[c]; i = c }
      heapN[i] = ln; heapD[i] = ld }
    return [n, d]
  }
  dist[src] = 0; push(src, 0)
  while (heapN.length) {
    const [n, d] = pop()
    if (d > dist[n]) continue
    const lvl = Math.floor(n / N), c = n - lvl * N, g = walk[lvl]
    const cx = c % W, cy = (c - cx) / W
    for (let k = 0; k < 8; k++) {
      const nx = cx + DX[k], ny = cy + DY[k]
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const nc = ny * W + nx
      if (!g[nc]) continue
      const nn = lvl * N + nc, nd = d + DC[k]
      if (nd < dist[nn]) { dist[nn] = nd; prev[nn] = n; push(nn, nd) }
    }
    const lk = links.get(n)
    if (lk) for (const nn of lk) { const nd = d + LIFT_COST; if (nd < dist[nn]) { dist[nn] = nd; prev[nn] = n; push(nn, nd) } }
  }
  const f = { dist, prev }
  cache.set(src, f)
  return f
}

export interface Pt { l: number; x: number; y: number }
export const nodePt = (n: number): Pt => { const lvl = Math.floor(n / N); return { l: LEVELS[lvl], ...cellXY(n - lvl * N) } }
export const nodeOf = (p: Pt) => snap(p.l, p.x, p.y)

/** Path from field source to target, as points (source first). */
export function pathTo(f: Field, target: number): Pt[] {
  if (!isFinite(f.dist[target])) return []
  const out: number[] = []
  for (let n = target; n >= 0; n = f.prev[n]) out.push(n)
  out.reverse()
  return smooth(out.map(nodePt))
}

function los(l: number, a: Pt, b: Pt) {
  const g = walk[li(l)]; const d = Math.hypot(b.x - a.x, b.y - a.y); const steps = Math.ceil(d / (res / 2))
  for (let i = 1; i < steps; i++) { const t = i / steps; if (!g[toCell(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)]) return false }
  return true
}
function smooth(p: Pt[]): Pt[] {
  if (p.length < 3) return p
  const out: Pt[] = [p[0]]
  let i = 0
  while (i < p.length - 1) {
    let j = p.length - 1
    // level change: always keep lift endpoints
    for (let k = i + 1; k < p.length; k++) if (p[k].l !== p[i].l) { j = k - 1; break }
    if (j === i) { out.push(p[i + 1]); i++; continue }
    while (j > i + 1 && !los(p[i].l, p[i], p[j])) j--
    out.push(p[j]); i = j
  }
  return out
}

export const pathLength = (p: Pt[]) => {
  let d = 0
  for (let i = 1; i < p.length; i++) d += p[i].l !== p[i - 1].l ? 0 : Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
  return d
}
