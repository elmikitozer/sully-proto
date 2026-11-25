import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, ChevronLeft, CornerUpLeft, CornerUpRight, Footprints, Pause, Play, Plane, ShieldCheck, SkipBack, SkipForward, Sparkles } from 'lucide-react'
import MapView, { splitByLevel } from './MapView'
import { findFlight, placeById, places, plan, routeToPlace, starts, STOP_MIN, WALK, type Flight, type Lang, type Plan, type PlaceKind, type StopKind } from './model'
import { t } from './i18n'
import { easeInOut, reducedMotion } from './motion'
import type { Pt } from './router'
import { tabOf, useRoute, type Tab } from './route'
import { load, save } from './storage'
import { DemoPill, KIND_ICON, TabBar, haptic, placeLabel } from './ui'
import Onboarding from './Onboarding'
import { newGateFor, useMyTrip, withGate } from './assistant'
import { nowMs, resetClock, useNow } from './clock'
import AssistantToasts from './AssistantToasts'
import Home, { hhmm } from './screens/Home'
import Explore from './screens/Explore'
import Place, { placeMarkerKind } from './screens/Place'
import MyFlight from './screens/MyFlight'

type StepKind = 'walk' | 'left' | 'right' | 'lift' | 'security' | 'stop' | 'gate'
interface Step { kind: StepKind; text: string; sub?: string; level: number; path: Pt[]; leg: number }
type Marker = { p: Pt; kind: 'start' | 'security' | 'stop' | 'gate'; label?: string }

/** Split a same-level polyline into straight runs: a new run starts at every turn sharper than 30°. */
function runsOf(seg: Pt[]): { pts: Pt[]; m: number; turn: number }[] {
  const runs: { pts: Pt[]; m: number; turn: number }[] = []
  const head = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x)
  for (let i = 1; i < seg.length; i++) {
    const a = seg[i - 1], b = seg[i], m = Math.hypot(b.x - a.x, b.y - a.y)
    if (m < 0.5) continue
    const last = runs[runs.length - 1]
    if (last) {
      const lp = last.pts
      let d = head(a, b) - head(lp[lp.length - 2], lp[lp.length - 1])
      d = Math.atan2(Math.sin(d), Math.cos(d)) // -π..π, > 0 = left (map y points up)
      // Tiny runs (< 8 m) are smoothing noise: fold them into the previous run.
      if (Math.abs(d) < Math.PI / 6 || last.m < 8) { lp.push(b); last.m += m; continue }
      runs.push({ pts: [a, b], m, turn: d })
    } else runs.push({ pts: [a, b], m, turn: 0 })
  }
  return runs
}

/** Nearest named landmark (toilets, info desk, food, security, gate) within 25 m of a point. */
function landmarkNear(p: Pt, lang: Lang): string | undefined {
  let best: { label: string; d: number } | undefined
  for (const q of places) {
    if (q.l !== p.l) continue
    const d = Math.hypot(q.x - p.x, q.y - p.y)
    if (d < 25 && (!best || d < best.d)) best = { label: placeLabel(q, lang), d }
  }
  return best?.label
}

/** Walk + turn + lift steps for one leg, split wherever the path turns or changes level. */
function walkSteps(path: Pt[], target: string, leg: number, lang: Lang): Step[] {
  const out: Step[] = []
  const parts = splitByLevel(path)
  parts.forEach((seg, si) => {
    if (si > 0) out.push({ kind: 'lift', text: t(lang, 'stepLift', { l: seg[0].l }), level: seg[0].l, path: [parts[si - 1][parts[si - 1].length - 1], seg[0]], leg })
    const runs = runsOf(seg).filter((r, _k, all) => r.m >= 3 || all.length === 1)
    runs.forEach((r, k) => {
      const metres = Math.round(r.m / 5) * 5 || 5
      const mins = `≈ ${Math.max(1, Math.round(r.m / WALK / 60))} min`
      const lastRun = k === runs.length - 1
      let text: string
      if (k === 0) text = t(lang, 'stepWalk', { m: metres }) + ' ' + t(lang, 'stepWalkTo', { t: target })
      else {
        const a = Math.abs(r.turn), dirKey = r.turn > 0 ? (a < Math.PI / 3 ? 'bearLeft' : 'turnLeft') : (a < Math.PI / 3 ? 'bearRight' : 'turnRight')
        text = t(lang, 'stepTurn', { d: t(lang, dirKey), m: metres }) + (lastRun ? ' ' + t(lang, 'stepWalkTo', { t: target }) : '')
      }
      const mark = k > 0 ? landmarkNear(r.pts[0], lang) : undefined
      out.push({ kind: k === 0 ? 'walk' : r.turn > 0 ? 'left' : 'right', text, sub: mark ? `${t(lang, 'landmark', { p: mark })} · ${mins}` : mins, level: seg[0].l, path: r.pts, leg })
    })
  })
  return out
}

function buildSteps(p: Plan, lang: Lang, f: Flight, stopKind?: StopKind): Step[] {
  const steps: Step[] = []
  p.legs.forEach((leg, li) => {
    const target = leg.kind === 'toSecurity' ? t(lang, 'security') : leg.kind === 'toStop' ? t(lang, (stopKind + 'Place') as never) : `${t(lang, 'gate')} ${f.gate}`
    steps.push(...walkSteps(leg.path, target, li, lang))
    const end = leg.path[leg.path.length - 1]
    if (leg.kind === 'toSecurity') steps.push({ kind: 'security', text: t(lang, 'stepSecurity', { n: p.security.name! }), sub: t(lang, 'wait', { n: p.waitMin }), level: end.l, path: [end], leg: li })
    if (leg.kind === 'toStop' && stopKind) steps.push({ kind: 'stop', text: t(lang, 'stepStop', { k: t(lang, (stopKind + 'Place') as never) }), sub: `${STOP_MIN[stopKind]} min`, level: end.l, path: [end], leg: li })
    if (leg.kind === 'toGate') steps.push({ kind: 'gate', text: t(lang, 'stepGate', { g: f.gate }), sub: t(lang, 'arrived'), level: end.l, path: [end], leg: li })
  })
  return steps
}

const along = (path: Pt[], frac: number): Pt => {
  if (path.length === 1) return path[0]
  const segs: number[] = []; let total = 0
  for (let i = 1; i < path.length; i++) { const d = path[i].l !== path[i - 1].l ? 0 : Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); segs.push(d); total += d }
  let target = frac * total
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] && segs[i] > 0) { const k = target / segs[i]; const a = path[i], b = path[i + 1]; return { l: a.l, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } }
    target -= segs[i]
  }
  return path[path.length - 1]
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(() => load<Lang>('lang', navigator.language?.startsWith('fr') ? 'fr' : 'en'))
  const setLang = (l: Lang) => { setLangState(l); save('lang', l) }
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const [onboarded, setOnboarded] = useState(() => load('onboarded', false))
  const finishOnboarding = () => { setOnboarded(true); save('onboarded', true) }

  const { route, dir, navigate, back } = useRoute()
  const [query, setQuery] = useState(() => route.code ?? '')
  const [err, setErr] = useState(false)
  const [homeStart, setHomeStartState] = useState(() => load('start', 'm14'))
  const setHomeStart = (s: string) => { setHomeStartState(s); save('start', s) }
  const [trip, setTrip] = useMyTrip()

  // The URL is the source of truth for which flight / place, start point and stop are shown.
  const baseFlight = route.code ? findFlight(route.code) ?? null : null
  // Memoised so the (expensive) route is only recomputed when the flight or its gate really changes.
  const flight = useMemo(() => (baseFlight ? withGate(baseFlight, trip) : null), [baseFlight, trip])
  const place = route.pid != null ? placeById(route.pid) ?? null : null
  const startId = starts.some((s) => s.id === route.from) ? route.from! : homeStart
  const stopKind = route.stop
  const broken = ((route.screen === 'trip' || route.screen === 'nav') && !flight) || ((route.screen === 'place' || route.screen === 'placeNav') && !place)
  const screen = broken ? 'home' : route.screen

  // A link to an unknown flight / place lands on home (with the error for flights).
  useEffect(() => {
    if (!broken) return
    if (route.code) { setErr(true); setQuery(route.code) }
    navigate({ screen: 'home' }, { replace: true })
  }, [broken, route, navigate])
  // The flight you opened becomes "your flight" (home card + My flight tab).
  // Boarding time is fixed the first time the flight is opened, so countdowns survive reloads.
  useEffect(() => {
    if (!baseFlight) return
    if (trip?.code === baseFlight.code && trip.boardAt > nowMs() - 3600000) return
    setTrip({ code: baseFlight.code, boardAt: nowMs() + baseFlight.boardInMin * 60000 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFlight])

  const myBase = trip ? findFlight(trip.code) ?? null : null
  const myFlight = useMemo(() => (myBase ? withGate(myBase, trip) : null), [myBase, trip])
  const boardAt = trip && myFlight ? trip.boardAt : null
  const flightBoardAt = flight && trip?.code === flight.code ? trip.boardAt : flight ? nowMs() + flight.boardInMin * 60000 : 0
  const changeGate = () => { if (!trip || !myFlight) return; const g = newGateFor(myFlight, myFlight.gate); setTrip({ ...trip, gate: g, prevGate: myFlight.gate }) }
  const ackGate = () => trip && setTrip({ ...trip, prevGate: undefined })
  const start = starts.find((s) => s.id === startId)!
  const homeStartPt = starts.find((s) => s.id === homeStart)!.pt
  const thePlan = useMemo(() => (flight ? plan(start.pt, flight, stopKind) : null), [flight, start, stopKind])
  const basePlan = useMemo(() => (flight ? plan(start.pt, flight) : null), [flight, start])
  const myPlan = useMemo(() => (myFlight ? plan(homeStartPt, myFlight) : null), [myFlight, homeStartPt])
  const steps = useMemo(() => (thePlan && flight ? buildSteps(thePlan, lang, flight, stopKind) : []), [thePlan, lang, flight, stopKind])
  const placeRoute = useMemo(() => (place ? routeToPlace(start.pt, place) : null), [place, start])
  const placeSteps = useMemo<Step[]>(() => {
    if (!place || !placeRoute) return []
    const label = placeLabel(place, lang)
    const end = placeRoute.path[placeRoute.path.length - 1]
    return [...walkSteps(placeRoute.path, label, 0, lang), { kind: 'gate', text: t(lang, 'arrivedAt', { p: label }), level: end.l, path: [end], leg: 0 }]
  }, [place, placeRoute, lang])

  const submit = (code?: string, from = homeStart) => {
    const f = findFlight(code ?? query)
    if (!f) { setErr(true); return }
    setErr(false); setQuery(f.code)
    navigate({ screen: 'trip', code: f.code, from })
  }
  const setStopKind = (k?: StopKind) => flight && navigate({ screen: 'trip', code: flight.code, from: startId, stop: k }, { replace: true })
  const onTab = (tab: Tab) => {
    if (tab === tabOf(screen) && (screen === 'home' || screen === 'explore' || screen === 'myflight')) return window.scrollTo({ top: 0, behavior: 'smooth' })
    navigate({ screen: tab })
  }
  const openPlace = (pid: number) => navigate({ screen: 'place', pid, from: homeStart })
  const exploreCat = (cat?: PlaceKind) => navigate({ screen: 'explore', cat }, { replace: screen === 'explore' })
  const guiding = screen === 'nav' || screen === 'placeNav'

  if (!onboarded) return <Onboarding lang={lang} setLang={setLang} onDone={finishOnboarding} />

  return (
    <div className={'app' + (guiding ? ' guiding' : '')}>
      {!guiding && (
        <header className="topbar">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigate({ screen: 'home' }) }}>Sully</a>
          <DemoPill lang={lang} />
          <div className="lang">
            <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
        </header>
      )}
      {screen === 'home' && (
        <Home dir={dir} lang={lang} query={query} setQuery={setQuery} err={err} start={homeStart} setStart={setHomeStart} submit={(c) => submit(c)}
          current={myFlight} boardAt={boardAt} plan={myPlan} trip={trip} onAckGate={ackGate} onContinue={() => myFlight && submit(myFlight.code)} onShortcut={(k) => navigate({ screen: 'explore', cat: k })} />
      )}
      {screen === 'explore' && <Explore dir={dir} lang={lang} cat={route.cat} setCat={exploreCat} start={homeStart} setStart={setHomeStart} onPlace={openPlace} />}
      {screen === 'myflight' && <MyFlight dir={dir} lang={lang} flight={myFlight} plan={myPlan} boardAt={boardAt} trip={trip} onGuide={() => myFlight && submit(myFlight.code)} onAdd={() => navigate({ screen: 'home' })}
        onGateChange={changeGate} onAckGate={ackGate} onReset={() => { resetClock(); if (trip && myBase) setTrip({ code: trip.code, boardAt: nowMs() + myBase.boardInMin * 60000 }) }} />}
      {screen === 'place' && place && placeRoute && (
        <Place dir={dir} lang={lang} place={place} route={placeRoute} startPt={start.pt} startLabel={start.label[lang]}
          onBack={() => back({ screen: 'explore', cat: place.kind })} onStart={() => navigate({ screen: 'placeNav', pid: place.pid, from: startId })}
          onPlace={(pid) => navigate({ screen: 'place', pid, from: startId }, { replace: true })} />
      )}
      {screen === 'placeNav' && place && placeRoute && (
        <Nav dir={dir} lang={lang} legs={[placeRoute.path]} steps={placeSteps} title={placeLabel(place, lang)}
          markers={[{ p: start.pt, kind: 'start' }, { p: place, kind: placeMarkerKind(place), label: place.kind === 'gate' ? place.name : undefined }]}
          onBack={() => back({ screen: 'place', pid: place.pid, from: startId })} />
      )}
      {screen === 'trip' && flight && thePlan && basePlan && (
        <Trip dir={dir} lang={lang} flight={flight} plan={thePlan} base={basePlan} boardAt={flightBoardAt} stopKind={stopKind} setStopKind={setStopKind} startPt={start.pt} startLabel={start.label[lang]}
          onStart={() => navigate({ ...route, screen: 'nav', code: flight.code, from: startId })} onBack={() => back({ screen: 'home' })} />
      )}
      {screen === 'nav' && flight && thePlan && (
        <Nav dir={dir} lang={lang} legs={thePlan.legs.map((l) => l.path)} steps={steps} markers={markersOf(thePlan, start.pt, flight)} title={`${t(lang, 'gate')} ${flight.gate}`}
          onBack={() => back({ ...route, screen: 'trip', code: flight.code, from: startId })} />
      )}
      <AssistantToasts lang={lang} flight={myFlight} plan={myPlan} trip={trip} onOpen={() => navigate({ screen: 'myflight' })} />
      {!guiding && <TabBar tab={tabOf(screen)} lang={lang} onTab={onTab} />}
    </div>
  )
}

function markersOf(p: Plan, startPt: Pt, f: Flight): Marker[] {
  const m: Marker[] = [{ p: startPt, kind: 'start' }, { p: p.security, kind: 'security' }, { p: p.gate, kind: 'gate', label: f.gate }]
  if (p.stop) m.push({ p: p.stop, kind: 'stop' })
  return m
}

function LevelTabs({ levels, level, setLevel, lang }: { levels: number[]; level: number; setLevel: (l: number) => void; lang: Lang }) {
  return (
    <div className="levels" role="tablist" aria-label={t(lang, 'level')}>
      {levels.map((l) => <button key={l} role="tab" aria-selected={l === level} className={l === level ? 'on' : ''} onClick={() => setLevel(l)}>{t(lang, 'levelShort', { l })}</button>)}
    </div>
  )
}

function Trip({ dir, lang, flight, plan: p, base, boardAt, stopKind, setStopKind, startPt, startLabel, onStart, onBack }: {
  dir: string; lang: Lang; flight: Flight; plan: Plan; base: Plan; boardAt: number; stopKind?: StopKind; setStopKind: (k?: StopKind) => void; startPt: Pt; startLabel: string; onStart: () => void; onBack: () => void
}) {
  const levels = [...new Set(p.legs.flatMap((l) => l.path.map((q) => q.l)))].sort((a, b) => a - b)
  const [level, setLevel] = useState(p.gate.l)
  const now = useNow(30000)
  const board = new Date(boardAt)
  const inMin = Math.max(0, Math.round((boardAt - now) / 60000))
  const margin = inMin - p.totalMin
  const StopIcon = stopKind ? KIND_ICON[stopKind] : Sparkles
  return (
    <main className="detail screen" data-dir={dir}>
      <div className="detail-map">
        <MapView level={level} routes={p.legs.map((l) => ({ path: l.path, active: true }))} markers={markersOf(p, startPt, flight)} />
        <LevelTabs levels={levels} level={level} setLevel={setLevel} lang={lang} />
        <button className="fab back-fab" onClick={onBack} aria-label={t(lang, 'back')}><ChevronLeft size={22} /></button>
      </div>
      <section className="sheet">
        <div className="grab" aria-hidden />
        <div className="trip-head">
          <div>
            <div className="muted">{flight.code} · {flight.city[lang]}</div>
            <h2 className="sheet-title">{flight.terminal} · {t(lang, 'gate')} {flight.gate}</h2>
            <div className="muted">{t(lang, 'boarding')} {hhmm(board)} ({t(lang, 'inMin', { n: inMin })})</div>
          </div>
          <div className="total"><b key={p.totalMin} className="tick">{p.totalMin}</b><span>min</span></div>
        </div>
        <div key={margin} className={(margin >= 10 ? 'ok' : 'warn') + ' tick marginline'}>{margin >= 0 ? t(lang, 'margin', { n: margin }) : t(lang, 'late', { n: -margin })}</div>
        <ol className="timeline">
          <li><span className="tl-dot start" /><div><b>{startLabel}</b></div></li>
          <li><span className="tl-ico"><Footprints size={14} /></span><div className="muted">{t(lang, 'walk')} · {p.walkMin} min</div></li>
          <li><span className="tl-dot security"><ShieldCheck size={12} /></span><div><b>{t(lang, 'security')} {p.security.name}</b><div className="muted">{t(lang, 'wait', { n: p.waitMin })}</div></div></li>
          {p.stop && stopKind && <li><span className="tl-dot stop"><StopIcon size={12} /></span><div><b>{t(lang, STOP_NAME[stopKind])}</b><div className="muted">{p.stopMin} min</div></div></li>}
          <li><span className="tl-dot gate"><Plane size={12} /></span><div><b>{t(lang, 'gate')} {flight.gate}</b></div></li>
        </ol>
        <p className="hint">{t(lang, 'chosenBecause')}{p.alternatives[0] ? ` ${t(lang, 'other')} : ${p.alternatives[0].p.name} (${p.alternatives[0].total} min).` : ''}</p>
        <h3 className="sub-h">{t(lang, 'addStop')}</h3>
        <div className="chips">
          <button className={!stopKind ? 'on' : ''} onClick={() => setStopKind(undefined)}>{t(lang, 'none')}</button>
          {(['restaurant', 'toilet', 'info'] as StopKind[]).map((k) => (
            <button key={k} className={stopKind === k ? 'on' : ''} onClick={() => setStopKind(k)}>{t(lang, k)}{stopKind === k ? ` ${t(lang, 'stopAdds', { n: p.totalMin - base.totalMin })}` : ''}</button>
          ))}
        </div>
        <button className="primary sticky" onClick={() => { haptic(); onStart() }}>{t(lang, 'start')}</button>
      </section>
    </main>
  )
}

const STOP_NAME = { restaurant: 'nameRestaurant', toilet: 'nameToilet', info: 'nameInfo' } as const
const STEP_ICON: Record<StepKind, typeof Footprints> = { walk: Footprints, left: CornerUpLeft, right: CornerUpRight, lift: ArrowUpDown, security: ShieldCheck, stop: Sparkles, gate: Plane }

function Nav({ dir, lang, legs, steps, markers, title, onBack }: { dir: string; lang: Lang; legs: Pt[][]; steps: Step[]; markers: Marker[]; title: string; onBack: () => void }) {
  const [i, setI] = useState(0)
  const [frac, setFrac] = useState(0)
  const [playing, setPlaying] = useState(true)
  const step = steps[i]
  const target = along(step.path, frac)
  // Prev/Next: glide the dot (and the camera following it) to the new step instead of teleporting.
  const [hop, setHop] = useState<{ from: Pt; k: number } | null>(null)
  useEffect(() => {
    if (!hop || hop.k >= 1) return
    const t0 = performance.now() - hop.k * 360
    let raf = requestAnimationFrame(function tick(now) {
      const k = Math.min(1, (now - t0) / 360)
      setHop((h) => (h ? { ...h, k } : h))
      if (k < 1) raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hop?.from])
  // Heading of the walker, for the direction cone on the dot (kept when standing still).
  const headingRef = useRef(0)
  const ahead = along(step.path, Math.min(1, frac + 0.04))
  if (Math.hypot(ahead.x - target.x, ahead.y - target.y) > 0.2) headingRef.current = Math.atan2(ahead.y - target.y, ahead.x - target.x)
  const e = hop ? easeInOut(hop.k) : 1
  const dot = hop && hop.k < 1 && hop.from.l === target.l ? { l: target.l, x: hop.from.x + (target.x - hop.from.x) * e, y: hop.from.y + (target.y - hop.from.y) * e } : target
  // Smooth simulation: advance the dot every animation frame (constant speed, ~9 m per demo second).
  const fracRef = useRef(0)
  fracRef.current = frac
  useEffect(() => {
    if (!playing) return
    const len = step.path.length > 1 ? step.path.reduce((a, q, k) => a + (k ? Math.hypot(q.x - step.path[k - 1].x, q.y - step.path[k - 1].y) : 0), 0) : 20
    const perSec = 9 / Math.max(len, 12)
    let raf = 0, pause = 0, last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      const nf = Math.min(1, fracRef.current + dt * perSec)
      fracRef.current = nf; setFrac(nf)
      if (nf < 1) { raf = requestAnimationFrame(tick); return }
      if (i < steps.length - 1) pause = window.setTimeout(() => { setI((x) => Math.min(x + 1, steps.length - 1)); setFrac(0) }, step.kind === 'walk' || step.kind === 'left' || step.kind === 'right' ? 300 : 1400)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(pause) }
  }, [playing, i, step, steps.length])
  const remainingM = steps.slice(i).reduce((a, s) => a + (s.kind === 'walk' || s.kind === 'left' || s.kind === 'right' ? s.path.reduce((b, q, k) => b + (k ? Math.hypot(q.x - s.path[k - 1].x, q.y - s.path[k - 1].y) : 0), 0) : 0), 0)
  const go = (d: number) => { haptic(); if (!reducedMotion()) setHop({ from: dot, k: 0 }); setI((x) => Math.max(0, Math.min(steps.length - 1, x + d))); setFrac(0) }
  const Icon = STEP_ICON[step.kind]
  const done = i === steps.length - 1
  return (
    <main className="nav screen" data-dir={dir}>
      <div className="mapwrap full">
        <MapView level={dot.l} routes={legs.map((path, k) => ({ path, active: k >= step.leg }))} markers={markers} dot={dot} heading={headingRef.current} follow />
        <div className="navtop">
          <button className="fab" onClick={onBack} aria-label={t(lang, 'back')}><ChevronLeft size={22} /></button>
          <div className="navpill"><b>{title}</b><span>{Math.ceil(remainingM / WALK / 60)} {t(lang, 'left')}</span></div>
          <div key={dot.l} className="navpill lvl tick">{t(lang, 'levelShort', { l: dot.l })}</div>
        </div>
      </div>
      <section className={'stepcard ' + step.kind + (done ? ' done' : '')} aria-live="polite">
        <div className="progress" aria-hidden><span style={{ width: `${((i + frac) / steps.length) * 100}%` }} /></div>
        <div key={i} className="stepbody">
          <span className={'stepicon ' + step.kind}><Icon size={22} aria-hidden /></span>
          <div>
            <div className="stepn">{i + 1}/{steps.length}</div>
            <div className="steptext">{step.text}</div>
            {step.sub && <div className="stepsub">{step.sub}</div>}
          </div>
        </div>
        <div className="stepbtns">
          <button onClick={() => go(-1)} disabled={i === 0} aria-label={t(lang, 'prev')}><SkipBack size={18} /></button>
          <button className="play" onClick={() => setPlaying((x) => !x)}>{playing ? <Pause size={18} /> : <Play size={18} />} {playing ? t(lang, 'pause') : t(lang, 'simulate')}</button>
          <button onClick={() => go(1)} disabled={done} aria-label={t(lang, 'next')}><SkipForward size={18} /></button>
        </div>
      </section>
    </main>
  )
}
