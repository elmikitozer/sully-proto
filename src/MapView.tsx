import { useMemo, useRef, useState, useEffect } from 'react'
import { data, type Poi, type Pt } from './router'
import { easeInOut, reducedMotion } from './motion'

import { ArrowUpDown, Bus, Info, Maximize2, Minus, Plane, Plus, ShieldCheck, ShoppingBag, Toilet, Utensils, type LucideIcon } from 'lucide-react'
import { terminalLabels, type Place } from './model'
import { details } from './details'
import { t } from './i18n'

const ICON: Record<string, LucideIcon> = { shop: ShoppingBag, restaurant: Utensils, toilet: Toilet, info: Info, security: ShieldCheck, gate: Plane, transport: Bus, lift: ArrowUpDown }
/** A Lucide icon centred on (0,0) inside the map's SVG, `s` map units wide. */
const MapIcon = ({ icon: I, s, className }: { icon?: LucideIcon; s: number; className?: string }) =>
  I ? <I x={-s / 2} y={-s / 2} width={s} height={s} strokeWidth={2.4} className={className} aria-hidden /> : null

interface Props {
  level: number
  routes: { path: Pt[]; active: boolean }[]
  markers: { p: Pt | Poi; kind: 'start' | 'security' | 'stop' | 'gate'; label?: string }[]
  dot?: Pt | null
  /** Walking direction in radians (map coordinates, y up), drawn as a cone on the dot. */
  heading?: number
  follow?: boolean
  showPois?: boolean
  /** Free exploration: every place as a coloured pin, tap to select. */
  browse?: { places: Place[]; selected?: number; label: (p: Place) => string; onSelect: (pid?: number) => void }
  /** Glide the camera to centre this point (and zoom in if far out). Change `key` to re-trigger. */
  focus?: { p: Pt; key: string | number; w?: number; lift?: number } | null
}

// Which pins win when several overlap (lower = kept first).
const PRIO: Record<string, number> = { security: 0, info: 1, toilet: 2, restaurant: 3, shop: 4, gate: 5, transport: 6 }

const toD = (pts: number[][]) => 'M' + pts.map((p) => `${p[0]},${-p[1]}`).join('L') + 'Z'

export default function MapView({ level, routes, markers, dot, heading, follow, showPois = true, browse, focus }: Props) {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr' // App keeps <html lang> in sync
  const lv = data.levels[String(level)]
  const zonesD = useMemo(() => lv.zones.map(toD).join(''), [lv])
  const wallsD = useMemo(() => lv.walls.map(toD).join(''), [lv])
  const onLevel = routes.flatMap((r, ri) => splitByLevel(r.path).filter((s) => s[0].l === level).map((s) => ({ s, ri, active: r.active, d: 'M' + s.map((p) => `${p.x},${-p.y}`).join('L') })))

  // Fit box: active route on this level, else whole level
  const fit = useMemo(() => {
    const pts = onLevel.filter((r) => r.active).flatMap((r) => r.s)
    const src = pts.length ? pts : lv.zones.flat().map((p) => ({ x: p[0], y: p[1] }))
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const p of src) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
    const pad = 40
    return { x: x0 - pad, y: -y1 - pad, w: Math.max(120, x1 - x0 + 2 * pad), h: Math.max(120, y1 - y0 + 2 * pad) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, routes])

  type View = typeof fit
  const FOLLOW = { w: 180, h: 260 }
  const [view, setViewState] = useState<View>(() => (follow ? { x: 0, y: 0, ...FOLLOW } : fit))
  const viewRef = useRef(view)
  const anim = useRef(0)
  const setView = (v: View) => { cancelAnimationFrame(anim.current); viewRef.current = v; setViewState(v) }
  // Camera move: interpolate the viewBox with the strong ease-in-out (on-screen movement).
  const animateView = (to: View, ms = 420) => {
    cancelAnimationFrame(anim.current)
    const from = viewRef.current
    if (reducedMotion()) { setView(to); return }
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = easeInOut(Math.min(1, (now - t0) / ms))
      const v = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, w: from.w + (to.w - from.w) * k, h: from.h + (to.h - from.h) * k }
      viewRef.current = v; setViewState(v)
      if (k < 1) anim.current = requestAnimationFrame(tick)
    }
    anim.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(anim.current), [])
  // Re-fit when the route changes. Same level: glide there. New level: cut (the level crossfade covers it).
  const lastLevel = useRef(level)
  useEffect(() => {
    if (follow) return
    if (lastLevel.current !== level) { lastLevel.current = level; setView(fit) } else animateView(fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, follow])
  // Focus: centre a point (search result, selected pin, "my position").
  useEffect(() => {
    if (!focus) return
    const v = viewRef.current, r = svgRef.current?.getBoundingClientRect()
    const w = Math.min(v.w, focus.w ?? 260), h = r && r.width ? (r.height / r.width) * w : (v.h / v.w) * w // match the screen's shape
    const to = { x: focus.p.x - w / 2, y: -focus.p.y - h / 2 + (focus.lift ?? 0) * h, w, h } // lift: show the point above centre (room for a card)
    if (focus.p.l !== level) setView(to); else animateView(to, 380)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key])
  // In follow mode the camera is centred on the dot every frame; the state only keeps the zoom.
  const shown: View = follow && dot ? { x: dot.x - view.w / 2, y: -dot.y - view.h / 2, w: view.w, h: view.h } : view

  // One finger (or mouse) pans; two fingers pinch-zoom around their midpoint.
  const drag = useRef<{ x: number; y: number; v: View } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; v: View; cx: number; cy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pinchStart = () => {
    const [a, b] = [...pointers.current.values()]
    const el = svgRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), v: viewRef.current, cx: ((a.x + b.x) / 2 - r.left) / r.width, cy: ((a.y + b.y) / 2 - r.top) / r.height }
    drag.current = null
  }
  // A tap (no drag) on the map selects the nearest pin in browse mode.
  const tap = useRef<{ x: number; y: number; t: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(anim.current)
    tap.current = pointers.current.size === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 2) pinchStart()
    else drag.current = { x: e.clientX, y: e.clientY, v: viewRef.current }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (p && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const k = Math.min(4, Math.max(0.25, p.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))))
      const w = p.v.w * k, h = p.v.h * k
      setView({ x: p.v.x + (p.v.w - w) * p.cx, y: p.v.y + (p.v.h - h) * p.cy, w, h })
      return
    }
    const d = drag.current; const el = svgRef.current; if (!d || !el || follow) return
    const r = el.getBoundingClientRect(); const s = Math.max(d.v.w / r.width, d.v.h / r.height)
    setView({ ...d.v, x: d.v.x - (e.clientX - d.x) * s, y: d.v.y - (e.clientY - d.y) * s })
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const tp = tap.current; tap.current = null
    if (browse && tp && pointers.current.size === 0 && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 8 && performance.now() - tp.t < 500) {
      const el = svgRef.current!, r = el.getBoundingClientRect(), v = shownRef.current
      const s = Math.max(v.w / r.width, v.h / r.height)
      const mx = v.x + (e.clientX - r.left - (r.width - v.w / s) / 2) * s
      const my = -(v.y + (e.clientY - r.top - (r.height - v.h / s) / 2) * s)
      // Visible pins first (22 px tap radius), then the small dots (12 px).
      let best: Place | undefined, bd = 22 * s
      for (const p of visRef.current?.shown ?? []) { const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = p } }
      if (!best) { bd = 12 * s; for (const p of visRef.current?.hidden ?? []) { const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = p } } }
      browse.onSelect(best?.pid)
    }
    if (pointers.current.size < 2) pinch.current = null
    const rest = [...pointers.current.values()][0]
    drag.current = rest ? { x: rest.x, y: rest.y, v: viewRef.current } : null
  }
  const zoomed = (v: View, k: number) => ({ x: v.x + (v.w * (1 - k)) / 2, y: v.y + (v.h * (1 - k)) / 2, w: v.w * k, h: v.h * k })
  // Buttons glide (occasional); the wheel stays instant (fired many times per second).
  const zoomBtn = (k: number) => animateView(zoomed(viewRef.current, k), 240)
  const zoomWheel = (k: number) => setView(zoomed(viewRef.current, k))
  const refit = () => (follow ? animateView({ ...viewRef.current, ...FOLLOW }, 240) : animateView(fit))
  const sw = Math.max(shown.w, shown.h) / 220
  const shownRef = useRef(shown); shownRef.current = shown
  // Map units per screen pixel: pins keep a constant size on screen whatever the zoom or the frame's shape.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = svgRef.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: r.width, h: r.height }) })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const upp = size && size.w ? Math.max(shown.w / size.w, shown.h / size.h) : sw * 0.55
  const close = upp < 0.7 // zoomed in enough for names
  // Declutter like a real map: pins that would overlap a more important one shrink to a small dot until you zoom in.
  const zoomStep = Math.round(Math.log2(upp) * 6)
  const vis = useMemo(() => {
    if (!browse) return null
    const R = upp > 1.6 ? 7 : 9 // px
    const minD = R * 2.15 * upp
    const list = browse.places.filter((p) => p.l === level)
      .sort((a, b) => (PRIO[a.kind] - PRIO[b.kind]) || (details(b).offer ? 1 : 0) - (details(a).offer ? 1 : 0) || a.pid - b.pid)
    const sel = list.find((p) => p.pid === browse.selected)
    const out: Place[] = sel ? [sel] : [], hidden: Place[] = []
    for (const p of list) {
      if (p === sel) continue
      if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < minD)) hidden.push(p); else out.push(p)
    }
    return { R, shown: out.reverse(), hidden } // reversed: most important drawn last (on top)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browse?.places, browse?.selected, level, zoomStep])
  const visRef = useRef(vis); visRef.current = vis

  const pois = showPois ? data.pois.filter((p) => p.l === level && (p.c === 'restaurant' || p.c === 'toilet' || p.c === 'info')) : []

  return (
    <div className="map">
      <svg ref={svgRef} role="img" aria-label={t(lang, 'mapLabel', { l: level })} viewBox={`${shown.x} ${shown.y} ${shown.w} ${shown.h}`} preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onWheel={(e) => zoomWheel(e.deltaY > 0 ? 1.15 : 0.87)}>
        <g key={level} className="level">
        <path d={zonesD} className="zones" strokeWidth={sw * 0.3} />
        <path d={wallsD} className="walls" strokeWidth={sw * 0.25} />
        {terminalLabels.map((tl) => (
          <text key={tl.name} x={tl.x} y={-tl.y} className="tlabel" fontSize={sw * (close ? 7 : 8)}>{tl.name}</text>
        ))}
        {browse && close && data.pois.filter((p) => p.l === level && p.c === 'lift').map((p, i) => (
          <g key={'l' + i} transform={`translate(${p.x},${-p.y})`} className="liftpin"><rect x={-upp * 6} y={-upp * 6} width={upp * 12} height={upp * 12} rx={upp * 3} /><MapIcon icon={ICON.lift} s={upp * 9} /></g>
        ))}
        {vis && vis.hidden.map((p) => (
          <circle key={'h' + p.pid} cx={p.x} cy={-p.y} r={upp * 2} className={'pin-mini pin ' + p.kind} />
        ))}
        {browse && vis && vis.shown.map((p) => {
          const sel = p.pid === browse.selected
          const R = vis.R * upp, u = upp * 2.3
          return (
            <g key={p.pid} transform={`translate(${p.x},${-p.y})`} className={'pin ' + p.kind + (sel ? ' sel' : '')}>
              {sel ? <>
                <path d={`M0,0 C${-u * 2},${-u * 5} ${-u * 7},${-u * 7} ${-u * 7},${-u * 12} A${u * 7},${u * 7} 0 1 1 ${u * 7},${-u * 12} C${u * 7},${-u * 7} ${u * 2},${-u * 5} 0,0 Z`} className="pin-drop" strokeWidth={upp * 1.5} />
                <g transform={`translate(0,${-u * 12})`}><MapIcon icon={ICON[p.kind]} s={u * 7} className="pin-ico" /></g>
              </> : <>
                <circle r={R} className="pin-dot" strokeWidth={upp * 1.5} />
                <MapIcon icon={ICON[p.kind]} s={R * 1.15} className="pin-ico" />
                {details(p).offer && <circle cx={R * 0.75} cy={-R * 0.75} r={upp * 3} className="pin-offer" strokeWidth={upp} />}
              </>}
              {(upp < 0.7 || sel) && <text className="pin-label" x={sel ? u * 9 : R + upp * 4} y={sel ? -u * 10.5 : upp * 4} fontSize={upp * (sel ? 13 : 11)} strokeWidth={upp * 3}>{browse.label(p)}</text>}
            </g>
          )
        })}
        {pois.map((p, i) => (
          <g key={i} transform={`translate(${p.x},${-p.y})`} className="poi">
            <circle r={sw * 3.2} />
            <MapIcon icon={ICON[p.c]} s={sw * 3.6} className="poi-ico" />
          </g>
        ))}
        {onLevel.filter((r) => !r.active).map((r) => (
          <path key={'o' + r.ri + r.d} d={r.d} className="route other" strokeWidth={sw * 2.2} />
        ))}
        {onLevel.filter((r) => r.active).map((r) => (
          <g key={'a' + r.ri + r.d} className="draw">
            <path d={r.d} pathLength={1} className="route casing" strokeWidth={sw * 4.4} />
            <path d={r.d} pathLength={1} className="route active" strokeWidth={sw * 2.6} />
          </g>
        ))}
        {markers.filter((m) => m.p.l === level).map((m, i) => (
          <g key={'m' + i} transform={`translate(${m.p.x},${-m.p.y})`} className={'marker ' + m.kind}>
            <g className="pop">
              <circle r={sw * 6} />
              {m.kind === 'start' ? <circle r={sw * 2.2} className="start-core" /> : <MapIcon icon={m.kind === 'security' ? ICON.security : m.kind === 'gate' ? ICON.gate : ICON[(m.p as Poi).c] ?? Utensils} s={sw * 6} className="marker-ico" />}
              {m.label && <text className="mlabel" fontSize={sw * 5} y={-sw * 9}>{m.label}</text>}
            </g>
          </g>
        ))}
        {dot && dot.l === level && (
          <g transform={`translate(${dot.x},${-dot.y})`} className="dot">
            <circle r={sw * 9} className="halo" />
            <circle r={sw * 9} className="ripple" />
            {heading != null && <path className="cone" d={`M0,0 L${sw * 14},${-sw * 6} A${sw * 15},${sw * 15} 0 0 1 ${sw * 14},${sw * 6} Z`} transform={`rotate(${(-heading * 180) / Math.PI})`} />}
            <circle r={sw * 4.5} />
          </g>
        )}
        </g>
      </svg>
      <div className="zoom">
        <button onClick={() => zoomBtn(0.7)} aria-label={t(lang, 'zoomIn')}><Plus size={18} /></button>
        <button onClick={() => zoomBtn(1.4)} aria-label={t(lang, 'zoomOut')}><Minus size={18} /></button>
        <button onClick={refit} aria-label={t(lang, 'fit')}><Maximize2 size={16} /></button>
      </div>
    </div>
  )
}

export function splitByLevel(path: Pt[]): Pt[][] {
  const out: Pt[][] = []
  for (const p of path) {
    const last = out[out.length - 1]
    if (last && last[0].l === p.l) last.push(p)
    else out.push([p])
  }
  return out
}
