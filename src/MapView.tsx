import { useMemo, useRef, useState, useEffect } from 'react'
import { data, type Poi, type Pt } from './router'
import { easeInOut, reducedMotion } from './motion'

import { Info, Plane, ShieldCheck, Toilet, Utensils, type LucideIcon } from 'lucide-react'

const ICON: Record<string, LucideIcon> = { restaurant: Utensils, toilet: Toilet, info: Info, security: ShieldCheck, gate: Plane }
/** A Lucide icon centred on (0,0) inside the map's SVG, `s` map units wide. */
const MapIcon = ({ icon: I, s, className }: { icon?: LucideIcon; s: number; className?: string }) =>
  I ? <I x={-s / 2} y={-s / 2} width={s} height={s} strokeWidth={2.4} className={className} aria-hidden /> : null

interface Props {
  level: number
  routes: { path: Pt[]; active: boolean }[]
  markers: { p: Pt | Poi; kind: 'start' | 'security' | 'stop' | 'gate'; label?: string }[]
  dot?: Pt | null
  follow?: boolean
  showPois?: boolean
}

const toD = (pts: number[][]) => 'M' + pts.map((p) => `${p[0]},${-p[1]}`).join('L') + 'Z'

export default function MapView({ level, routes, markers, dot, follow, showPois = true }: Props) {
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
  // In follow mode the camera is centred on the dot every frame; the state only keeps the zoom.
  const shown: View = follow && dot ? { x: dot.x - view.w / 2, y: -dot.y - view.h / 2, w: view.w, h: view.h } : view

  const drag = useRef<{ x: number; y: number; v: View } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const onDown = (e: React.PointerEvent) => { cancelAnimationFrame(anim.current); drag.current = { x: e.clientX, y: e.clientY, v: viewRef.current }; (e.target as Element).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; const el = svgRef.current; if (!d || !el || follow) return
    const r = el.getBoundingClientRect(); const s = Math.max(d.v.w / r.width, d.v.h / r.height)
    setView({ ...d.v, x: d.v.x - (e.clientX - d.x) * s, y: d.v.y - (e.clientY - d.y) * s })
  }
  const onUp = () => { drag.current = null }
  const zoomed = (v: View, k: number) => ({ x: v.x + (v.w * (1 - k)) / 2, y: v.y + (v.h * (1 - k)) / 2, w: v.w * k, h: v.h * k })
  // Buttons glide (occasional); the wheel stays instant (fired many times per second).
  const zoomBtn = (k: number) => animateView(zoomed(viewRef.current, k), 240)
  const zoomWheel = (k: number) => setView(zoomed(viewRef.current, k))
  const refit = () => (follow ? animateView({ ...viewRef.current, ...FOLLOW }, 240) : animateView(fit))
  const sw = Math.max(shown.w, shown.h) / 220

  const pois = showPois ? data.pois.filter((p) => p.l === level && (p.c === 'restaurant' || p.c === 'toilet' || p.c === 'info')) : []

  return (
    <div className="map">
      <svg ref={svgRef} viewBox={`${shown.x} ${shown.y} ${shown.w} ${shown.h}`} preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onWheel={(e) => zoomWheel(e.deltaY > 0 ? 1.15 : 0.87)}>
        <g key={level} className="level">
        <path d={zonesD} className="zones" strokeWidth={sw * 0.3} />
        <path d={wallsD} className="walls" />
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
            <circle r={sw * 4.5} />
          </g>
        )}
        </g>
      </svg>
      <div className="zoom">
        <button onClick={() => zoomBtn(0.7)} aria-label="zoom in">+</button>
        <button onClick={() => zoomBtn(1.4)} aria-label="zoom out">−</button>
        <button onClick={refit} aria-label="fit">⤢</button>
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
