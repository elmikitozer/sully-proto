import { Navigation, PlaneTakeoff, TicketsPlane } from 'lucide-react'
import type { Flight, Lang, Plan } from '../model'
import { t } from '../i18n'
import { haptic } from '../ui'
import { hhmm } from './Home'

interface Props { dir: string; lang: Lang; flight: Flight | null; plan: Plan | null; boardAt: Date | null; onGuide: () => void; onAdd: () => void }

export default function MyFlight({ dir, lang, flight, plan, boardAt, onGuide, onAdd }: Props) {
  if (!flight || !boardAt) return (
    <main className="myflight screen empty" data-dir={dir}>
      <div className="empty-art"><TicketsPlane size={56} strokeWidth={1.5} aria-hidden /></div>
      <h1>{t(lang, 'noFlightTitle')}</h1>
      <p className="muted">{t(lang, 'noFlightBody')}</p>
      <button className="primary" onClick={onAdd}>{t(lang, 'addFlight')}</button>
    </main>
  )
  const mins = Math.max(0, Math.round((boardAt.getTime() - Date.now()) / 60000))
  const margin = plan ? flight.boardInMin - plan.totalMin : null
  return (
    <main className="myflight screen" data-dir={dir}>
      <h1 className="title">{t(lang, 'tabFlight')}</h1>
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
          <div><span>{t(lang, 'gate')}</span><b>{flight.gate}</b></div>
          <div><span>{t(lang, 'boardingTime')}</span><b>{hhmm(boardAt)}</b></div>
        </div>
        <div className="pass-tear" aria-hidden />
        <div className="pass-count">
          <span>{t(lang, 'boardsIn')}</span><b>{mins} min</b>
        </div>
      </article>
      {plan && <section className="card">
        <ul className="summary">
          <li><span>{t(lang, 'bestSecurity')}</span><b>{plan.security.name} · {plan.waitMin} min</b></li>
          <li><span>{t(lang, 'timeToGate')}</span><b>{plan.totalMin} min</b></li>
        </ul>
        {margin != null && <p className={(margin >= 10 ? 'ok' : 'warn') + ' marginline'}>{margin >= 0 ? t(lang, 'margin', { n: margin }) : t(lang, 'late', { n: -margin })}</p>}
      </section>}
      <button className="primary" onClick={() => { haptic(); onGuide() }}><Navigation size={18} aria-hidden /> {t(lang, 'guideMe')}</button>
      <button className="ghost" onClick={onAdd}>{t(lang, 'changeFlight')}</button>
    </main>
  )
}
