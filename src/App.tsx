import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { splitByLevel } from './MapView'
import { findFlight, flights, plan, starts, STOP_MIN, WALK, type Flight, type Lang, type Plan, type StopKind } from './model'
import { t } from './i18n'
import { easeInOut, reducedMotion } from './motion'
import type { Pt } from './router'
import { useRoute } from './route'
import { load, save } from './storage'

interface Step { kind: 'walk' | 'lift' | 'security' | 'stop' | 'gate'; text: string; sub?: string; level: number; path: Pt[]; leg: number }

const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

function buildSteps(p: Plan, lang: Lang, f: Flight, stopKind?: StopKind): Step[] {
  const steps: Step[] = []
  p.legs.forEach((leg, li) => {
    const target = leg.kind === 'toSecurity' ? t(lang, 'security') : leg.kind === 'toStop' ? t(lang, (stopKind + 'Place') as never) : `${t(lang, 'gate')} ${f.gate}`
    const parts = splitByLevel(leg.path)
    parts.forEach((seg, si) => {
      if (si > 0) steps.push({ kind: 'lift', text: t(lang, 'stepLift', { l: seg[0].l }), level: seg[0].l, path: [parts[si - 1][parts[si - 1].length - 1], seg[0]], leg: li })
      let m = 0
      for (let i = 1; i < seg.length; i++) m += Math.hypot(seg[i].x - seg[i - 1].x, seg[i].y - seg[i - 1].y)
      if (m < 3) return
      steps.push({ kind: 'walk', text: t(lang, 'stepWalk', { m: Math.round(m / 5) * 5 || 5 }) + ' ' + t(lang, 'stepWalkTo', { t: target }), sub: `≈ ${Math.max(1, Math.round(m / WALK / 60))} min`, level: seg[0].l, path: seg, leg: li })
    })
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

  const { route, dir, navigate, back } = useRoute()
  const [query, setQuery] = useState(() => route.code ?? '')
  const [err, setErr] = useState(false)
  const [homeStart, setHomeStart] = useState(() => load('start', 'm14'))
  const [lastTrip, setLastTrip] = useState(() => load<{ code: string; from: string } | null>('lastTrip', null))
  const [now] = useState(() => new Date())

  // The URL is the source of truth for which flight, start point and stop are shown.
  const flight = route.code ? findFlight(route.code) ?? null : null
  const startId = starts.some((s) => s.id === route.from) ? route.from! : homeStart
  const stopKind = route.stop
  const screen = route.screen !== 'home' && !flight ? 'home' : route.screen

  // A link to an unknown flight lands on home with the error shown.
  useEffect(() => {
    if (route.screen !== 'home' && !flight) { setErr(true); setQuery(route.code ?? ''); navigate({ screen: 'home' }, { replace: true }) }
  }, [route, flight, navigate])
  // Remember the trip in progress so home can offer to resume it.
  useEffect(() => {
    if (!flight) return
    const t = { code: flight.code, from: startId }
    setLastTrip(t); save('lastTrip', t)
  }, [flight, startId])

  const start = starts.find((s) => s.id === startId)!
  const thePlan = useMemo(() => (flight ? plan(start.pt, flight, stopKind) : null), [flight, start, stopKind])
  const basePlan = useMemo(() => (flight ? plan(start.pt, flight) : null), [flight, start])
  const steps = useMemo(() => (thePlan && flight ? buildSteps(thePlan, lang, flight, stopKind) : []), [thePlan, lang, flight, stopKind])

  const submit = (code?: string, from = homeStart) => {
    const f = findFlight(code ?? query)
    if (!f) { setErr(true); return }
    setErr(false); setQuery(f.code)
    navigate({ screen: 'trip', code: f.code, from })
  }
  const setStopKind = (k?: StopKind) => flight && navigate({ screen: 'trip', code: flight.code, from: startId, stop: k }, { replace: true })
  const resume = lastTrip && findFlight(lastTrip.code)

  return (
    <div className="app">
      <header>
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigate({ screen: 'home' }) }}>Sully</a>
        <div className="lang">
          <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
      </header>
      {screen === 'home' && (
        <main className="home screen" data-dir={dir}>
          <h1>{t(lang, 'tagline')}</h1>
          <label className="field">
            <span>{t(lang, 'flightLabel')}</span>
            <input value={query} placeholder={t(lang, 'flightPh')} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoCapitalize="characters" />
          </label>
          {err && <p className="err" role="alert">{t(lang, 'notFound')}</p>}
          <label className="field">
            <span>{t(lang, 'from')}</span>
            <select value={homeStart} onChange={(e) => { setHomeStart(e.target.value); save('start', e.target.value) }}>
              {starts.map((s) => <option key={s.id} value={s.id}>{s.label[lang]}</option>)}
            </select>
          </label>
          <button className="primary" onClick={() => submit()}>{t(lang, 'go')}</button>
          {resume && (
            <button className="resume" onClick={() => submit(resume.code, lastTrip.from)}>
              <span>{t(lang, 'resume')}</span><b>{resume.code} · {resume.city[lang]}</b><em>{resume.terminal}</em>
            </button>
          )}
          <h2>{t(lang, 'demoFlights')}</h2>
          <ul className="flights">
            {flights.map((f) => (
              <li key={f.code}><button onClick={() => submit(f.code)}>
                <b>{f.code}</b><span>{f.city[lang]}</span><em>{f.terminal}</em>
              </button></li>
            ))}
          </ul>
          <p className="note">{t(lang, 'demoNote')}</p>
        </main>
      )}
      {screen === 'trip' && flight && thePlan && basePlan && (
        <Trip dir={dir} lang={lang} flight={flight} plan={thePlan} base={basePlan} now={now} stopKind={stopKind} setStopKind={setStopKind} startPt={start.pt} onStart={() => navigate({ ...route, screen: 'nav', code: flight.code, from: startId })} onBack={() => back({ screen: 'home' })} />
      )}
      {screen === 'nav' && flight && thePlan && (
        <Nav dir={dir} lang={lang} plan={thePlan} steps={steps} startPt={start.pt} flight={flight} onBack={() => back({ ...route, screen: 'trip', code: flight.code, from: startId })} />
      )}
    </div>
  )
}

function markersOf(p: Plan, startPt: Pt, f: Flight) {
  const m: { p: Pt; kind: 'start' | 'security' | 'stop' | 'gate'; label?: string }[] = [
    { p: startPt, kind: 'start' }, { p: p.security, kind: 'security' }, { p: p.gate, kind: 'gate', label: f.gate },
  ]
  if (p.stop) m.push({ p: p.stop, kind: 'stop' })
  return m
}

function LevelTabs({ levels, level, setLevel, lang }: { levels: number[]; level: number; setLevel: (l: number) => void; lang: Lang }) {
  return (
    <div className="levels">
      {levels.map((l) => <button key={l} className={l === level ? 'on' : ''} onClick={() => setLevel(l)}>{t(lang, 'level')} {l}</button>)}
    </div>
  )
}

function Trip({ dir, lang, flight, plan: p, base, now, stopKind, setStopKind, startPt, onStart, onBack }: {
  dir: string; lang: Lang; flight: Flight; plan: Plan; base: Plan; now: Date; stopKind?: StopKind; setStopKind: (k?: StopKind) => void; startPt: Pt; onStart: () => void; onBack: () => void
}) {
  const levels = [...new Set(p.legs.flatMap((l) => l.path.map((q) => q.l)))].sort((a, b) => a - b)
  const [level, setLevel] = useState(p.gate.l)
  const board = new Date(now.getTime() + flight.boardInMin * 60000)
  const margin = flight.boardInMin - p.totalMin
  return (
    <main className="trip screen" data-dir={dir}>
      <button className="back" onClick={onBack}>← {t(lang, 'back')}</button>
      <section className="card flight">
        <div><b>{flight.code}</b> · {flight.city[lang]}</div>
        <div className="big">{flight.terminal} · {t(lang, 'gate')} {flight.gate}</div>
        <div>{t(lang, 'boarding')} {hhmm(board)} ({t(lang, 'inMin', { n: flight.boardInMin })})</div>
        <div key={margin} className={(margin >= 10 ? 'ok' : 'warn') + ' tick'}>{margin >= 0 ? t(lang, 'margin', { n: margin }) : t(lang, 'late', { n: -margin })}</div>
      </section>
      <div className="mapwrap">
        <MapView level={level} routes={p.legs.map((l) => ({ path: l.path, active: true }))} markers={markersOf(p, startPt, flight)} />
        <LevelTabs levels={levels} level={level} setLevel={setLevel} lang={lang} />
      </div>
      <section className="card">
        <h3>{t(lang, 'route')} · {t(lang, 'total')} <span key={p.totalMin} className="tick">{p.totalMin} min</span></h3>
        <ul className="summary">
          <li><span>🚶 {t(lang, 'walk')}</span><b>{p.walkMin} min</b></li>
          <li><span>⛨ {t(lang, 'security')} {p.security.name}</span><b>{p.waitMin} min</b></li>
          {p.stop && <li><span>★ {t(lang, (stopKind + 'Place') as never)}</span><b>{p.stopMin} min</b></li>}
        </ul>
        <p className="hint">{t(lang, 'wait', { n: p.waitMin })}. {t(lang, 'chosenBecause')}{p.alternatives[0] ? ` ${t(lang, 'other')} : ${p.alternatives[0].p.name} (${p.alternatives[0].total} min).` : ''}</p>
      </section>
      <section className="card">
        <h3>{t(lang, 'addStop')}</h3>
        <div className="chips">
          <button className={!stopKind ? 'on' : ''} onClick={() => setStopKind(undefined)}>{t(lang, 'none')}</button>
          {(['restaurant', 'toilet', 'info'] as StopKind[]).map((k) => {
            return <button key={k} className={stopKind === k ? 'on' : ''} onClick={() => setStopKind(k)}>{t(lang, k)}{stopKind === k ? ` ${t(lang, 'stopAdds', { n: p.totalMin - base.totalMin })}` : ''}</button>
          })}
        </div>
      </section>
      <button className="primary sticky" onClick={onStart}>{t(lang, 'start')}</button>
    </main>
  )
}

function Nav({ dir, lang, plan: p, steps, startPt, flight, onBack }: { dir: string; lang: Lang; plan: Plan; steps: Step[]; startPt: Pt; flight: Flight; onBack: () => void }) {
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
      if (i < steps.length - 1) pause = window.setTimeout(() => { setI((x) => Math.min(x + 1, steps.length - 1)); setFrac(0) }, step.kind === 'walk' ? 300 : 1400)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(pause) }
  }, [playing, i, step, steps.length])
  const remainingM = steps.slice(i).reduce((a, s) => a + (s.kind === 'walk' ? s.path.reduce((b, q, k) => b + (k ? Math.hypot(q.x - s.path[k - 1].x, q.y - s.path[k - 1].y) : 0), 0) : 0), 0)
  const go = (d: number) => { if (!reducedMotion()) setHop({ from: dot, k: 0 }); setI((x) => Math.max(0, Math.min(steps.length - 1, x + d))); setFrac(0) }
  return (
    <main className="nav screen" data-dir={dir}>
      <div className="navtop">
        <button className="back" onClick={onBack}>←</button>
        <div><b>{t(lang, 'gate')} {flight.gate}</b> · {Math.ceil(remainingM / WALK / 60)} {t(lang, 'left')}</div>
        <div key={dot.l} className="lvl tick">{t(lang, 'level')} {dot.l}</div>
      </div>
      <div className="mapwrap full">
        <MapView level={dot.l} routes={p.legs.map((l, k) => ({ path: l.path, active: k >= step.leg }))} markers={markersOf(p, startPt, flight)} dot={dot} follow />
      </div>
      <section className={'stepcard ' + step.kind}>
        <div key={i} className="stepbody">
          <div className="stepn">{i + 1}/{steps.length}</div>
          <div className="steptext">{step.text}</div>
          {step.sub && <div className="stepsub">{step.sub}</div>}
        </div>
        <div className="stepbtns">
          <button onClick={() => go(-1)} disabled={i === 0}>{t(lang, 'prev')}</button>
          <button onClick={() => setPlaying((x) => !x)}>{playing ? t(lang, 'pause') : t(lang, 'simulate')}</button>
          <button onClick={() => go(1)} disabled={i === steps.length - 1}>{t(lang, 'next')}</button>
        </div>
      </section>
    </main>
  )
}
