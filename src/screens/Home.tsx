import { ArrowUpRight, Search } from 'lucide-react'
import { flights, starts, type Flight, type Lang, type Plan } from '../model'
import { useNow } from '../clock'
import { milestones, phaseAt, type MyTrip } from '../assistant'
import { GateBanner, phaseText } from './MyFlight'
import { t } from '../i18n'
import { KindBadge, CAT_KEY, haptic } from '../ui'
import type { PlaceKind } from '../model'

export const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

interface Props {
  dir: string; lang: Lang; query: string; setQuery: (q: string) => void; err: boolean
  start: string; setStart: (s: string) => void; submit: (code?: string) => void
  current: Flight | null; boardAt: number | null; plan: Plan | null; trip: MyTrip | null; onAckGate: () => void; ideas: React.ReactNode; onContinue: () => void; onShortcut: (k: PlaceKind) => void
}

export default function Home({ dir, lang, query, setQuery, err, start, setStart, submit, current, boardAt, plan, trip, onAckGate, ideas, onContinue, onShortcut }: Props) {
  const now = useNow(5000)
  const mins = boardAt ? Math.max(0, Math.round((boardAt - now) / 60000)) : 0
  const phase = boardAt && plan ? phaseAt(now, milestones(boardAt, plan)) : null
  return (
    <main className="home screen" data-dir={dir}>
      <GateBanner lang={lang} trip={trip} plan={plan} onSee={onContinue} onAck={onAckGate} />
      {current && boardAt ? (
        <button className="hero" aria-label={t(lang, 'continueGate')} onClick={() => { haptic(); onContinue() }}>
          <span className="sign-top"><b translate="no">{current.code}</b><span>{current.city[lang]}</span><span className="sign-time">{hhmm(new Date(boardAt))}</span></span>
          <span className="sign-main">
            <span className="sign-gate"><small>{t(lang, 'gate')}</small><b>{current.gate}</b></span>
            <span className="sign-info"><b>{current.terminal}</b><span>{t(lang, 'boardsIn')} <b>{mins} min</b></span></span>
            <ArrowUpRight className="sign-arrow" size={36} strokeWidth={2.5} aria-hidden />
          </span>
          {phase && plan && <span className={'hero-phase ' + phase}><span className="pulse" aria-hidden />{phaseText(phase, lang, current, plan, boardAt)}</span>}
        </button>
      ) : (
        <h1>{t(lang, 'tagline')}</h1>
      )}

      {ideas}
      <section className="card search">
        <label className="field">
          <span>{t(lang, 'flightLabel')}</span>
          <span className="inputicon">
            <Search size={18} aria-hidden />
            <input value={query} placeholder={t(lang, 'flightPh')} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoCapitalize="characters" enterKeyHint="go" name="flight" autoComplete="off" spellCheck={false} />
          </span>
        </label>
        {err && <p className="err" role="alert">{t(lang, 'notFound')}</p>}
        <label className="field">
          <span>{t(lang, 'from')}</span>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            {starts.map((s) => <option key={s.id} value={s.id}>{s.label[lang]}</option>)}
          </select>
        </label>
        <button className="primary" onClick={() => { haptic(); submit() }}>{t(lang, 'go')}</button>
      </section>

      <h2>{t(lang, 'needs')}</h2>
      <div className="shortcuts">
        {(['toilet', 'restaurant', 'info'] as PlaceKind[]).map((k) => (
          <button key={k} onClick={() => onShortcut(k)}><KindBadge kind={k} size={22} /><span>{t(lang, CAT_KEY[k])}</span></button>
        ))}
      </div>

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
  )
}
