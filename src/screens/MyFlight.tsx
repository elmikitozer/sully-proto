import { useState } from 'react'
import { Bell, BellRing, Clock, FastForward, Navigation, PlaneTakeoff, RotateCcw, Shuffle, TicketsPlane, TriangleAlert } from 'lucide-react'
import type { Flight, Lang, Plan } from '../model'
import { t } from '../i18n'
import { haptic } from '../ui'
import { hhmm } from './Home'
import { advanceClock, useNow } from '../clock'
import { milestones, phaseAt, useApiStatus, type MyTrip, type Phase } from '../assistant'

export function phaseText(phase: Phase, lang: Lang, f: Flight, plan: Plan, boardAt: number) {
  const m = milestones(boardAt, plan)
  switch (phase) {
    case 'relax': return t(lang, 'phaseRelax', { t: hhmm(new Date(m.leaveAt)) })
    case 'go': return t(lang, 'phaseGo')
    case 'hurry': return t(lang, 'phaseHurry', { g: f.gate })
    case 'boarding': return t(lang, 'phaseBoarding', { g: f.gate })
    default: return t(lang, 'phaseClosed')
  }
}

export function GateBanner({ lang, trip, plan, onSee, onAck }: { lang: Lang; trip: MyTrip | null; plan: Plan | null; onSee?: () => void; onAck: () => void }) {
  if (!trip?.prevGate || !trip.gate || !plan) return null
  return (
    <section className="banner warn" role="alert">
      <TriangleAlert size={20} aria-hidden />
      <div>
        <b>{t(lang, 'gateChanged', { a: trip.prevGate, b: trip.gate })}</b>
        <span>{t(lang, 'gateChangedBody', { n: plan.totalMin })}</span>
        <div className="banner-actions">
          {onSee && <button onClick={onSee}>{t(lang, 'seeRoute')}</button>}
          <button onClick={onAck}>{t(lang, 'gotIt')}</button>
        </div>
      </div>
    </section>
  )
}

interface Props {
  dir: string; lang: Lang; flight: Flight | null; plan: Plan | null; boardAt: number | null; trip: MyTrip | null
  onGuide: () => void; onAdd: () => void; onGateChange: () => void; onAckGate: () => void; onReset: () => void; ideas: React.ReactNode
}

export default function MyFlight({ dir, lang, flight, plan, boardAt, trip, onGuide, onAdd, onGateChange, onAckGate, onReset, ideas }: Props) {
  const now = useNow(1000)
  const apiAt = useApiStatus()
  const [perm, setPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'))
  if (!flight || !boardAt) return (
    <main className="myflight screen empty" data-dir={dir}>
      <div className="empty-art"><TicketsPlane size={56} strokeWidth={1.5} aria-hidden /></div>
      <h1>{t(lang, 'noFlightTitle')}</h1>
      <p className="muted">{t(lang, 'noFlightBody')}</p>
      <button className="primary" onClick={onAdd}>{t(lang, 'addFlight')}</button>
    </main>
  )
  const left = Math.max(0, boardAt - now)
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000)
  const ms = plan ? milestones(boardAt, plan) : null
  const phase = ms ? phaseAt(now, ms) : null
  const margin = plan ? Math.round(left / 60000) - plan.totalMin : null
  const askNotif = async () => { try { setPerm(await Notification.requestPermission()) } catch { setPerm('denied') } }
  const steps = ms ? [
    { at: ms.leaveAt, label: t(lang, 'msLeave') },
    { at: ms.gateBy, label: t(lang, 'msGate') },
    { at: ms.boardAt, label: t(lang, 'msBoard') },
  ] : []
  return (
    <main className="myflight screen" data-dir={dir}>
      <h1 className="title">{t(lang, 'tabFlight')}</h1>
      <GateBanner lang={lang} trip={trip} plan={plan} onSee={onGuide} onAck={onAckGate} />
      <article className="pass">
        <header className="pass-top">
          <span>{flight.airline}</span><b>{flight.code}</b>
        </header>
        <div className="pass-route">
          <div><b>ORY</b><span>Paris-Orly</span></div>
          <PlaneTakeoff size={26} aria-hidden />
          <div className="r"><b>{flight.iata}</b><span>{flight.city[lang]}</span></div>
        </div>
        <div className="pass-grid">
          <div><span>{t(lang, 'terminal')}</span><b>{flight.terminal.replace('Orly ', '')}</b></div>
          <div><span>{t(lang, 'gate')}</span><b key={flight.gate} className={trip?.prevGate ? 'tick changed' : ''}>{flight.gate}</b></div>
          <div><span>{t(lang, 'boardingTime')}</span><b>{hhmm(new Date(boardAt))}</b></div>
        </div>
        <div className="pass-tear" aria-hidden />
        <div className="pass-count">
          <span>{t(lang, 'boardsIn')}</span><b className="mono">{left > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : '0:00'}</b>
        </div>
      </article>

      {plan && phase && ms && (
        <section className={'card assistant ' + phase}>
          <div className="assistant-head"><span className="pulse" aria-hidden /><b>{t(lang, 'assistant')}</b></div>
          <p className="assistant-now">{phaseText(phase, lang, flight, plan, boardAt)}</p>
          <ol className="milestones">
            {steps.map((s, i) => {
              const done = now >= s.at, next = !done && (i === 0 || now >= steps[i - 1].at)
              return <li key={i} className={done ? 'done' : next ? 'next' : ''}><span className="ms-dot" /><span>{s.label}</span><b>{hhmm(new Date(s.at))}</b></li>
            })}
          </ol>
          <ul className="summary">
            <li><span>{t(lang, 'bestSecurity')}</span><b>{plan.security.name} · {plan.waitMin} min</b></li>
            <li><span>{t(lang, 'timeToGate')}</span><b>{plan.totalMin} min</b></li>
          </ul>
          {margin != null && <p className={(margin >= 10 ? 'ok' : 'warn') + ' marginline'}>{margin >= 0 ? t(lang, 'margin', { n: margin }) : t(lang, 'late', { n: -margin })}</p>}
          {perm !== 'granted'
            ? perm !== 'denied' && <button className="ghost left" onClick={askNotif}><Bell size={16} aria-hidden /> {t(lang, 'notifOn')}</button>
            : <span className="muted small"><BellRing size={14} aria-hidden /> {t(lang, 'notifDone')}</span>}
        </section>
      )}
      <button className="primary" onClick={() => { haptic(); onGuide() }}><Navigation size={18} aria-hidden /> {t(lang, 'guideMe')}</button>
      {ideas}

      <section className="card demotools">
        <h3>{t(lang, 'demoTools')}</h3>
        <p className="hint">{t(lang, 'demoToolsHint')}</p>
        <div className="demobtns">
          <button onClick={() => advanceClock(15)}><FastForward size={16} aria-hidden /> {t(lang, 'plus15')}</button>
          <button onClick={onGateChange}><Shuffle size={16} aria-hidden /> {t(lang, 'simGate')}</button>
          <button onClick={onReset}><RotateCcw size={16} aria-hidden /> {t(lang, 'resetDemo')}</button>
        </div>
        {apiAt && <p className="hint"><Clock size={12} aria-hidden /> {t(lang, 'live', { t: hhmm(new Date(apiAt)) })}</p>}
      </section>
      <button className="ghost" onClick={onAdd}>{t(lang, 'changeFlight')}</button>
    </main>
  )
}
