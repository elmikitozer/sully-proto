import { ArrowRight, Search } from 'lucide-react'
import { flights, starts, type Flight, type Lang } from '../model'
import { t } from '../i18n'
import { KindBadge, CAT_KEY, haptic } from '../ui'
import type { PlaceKind } from '../model'

export const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

interface Props {
  dir: string; lang: Lang; query: string; setQuery: (q: string) => void; err: boolean
  start: string; setStart: (s: string) => void; submit: (code?: string) => void
  current: Flight | null; boardAt: Date | null; onContinue: () => void; onShortcut: (k: PlaceKind) => void
}

export default function Home({ dir, lang, query, setQuery, err, start, setStart, submit, current, boardAt, onContinue, onShortcut }: Props) {
  const mins = boardAt ? Math.max(0, Math.round((boardAt.getTime() - Date.now()) / 60000)) : 0
  return (
    <main className="home screen" data-dir={dir}>
      {current && boardAt ? (
        <button className="hero" onClick={() => { haptic(); onContinue() }}>
          <span className="hero-label">{t(lang, 'yourFlight')}</span>
          <span className="hero-row"><b>{current.code}</b><span>{current.city[lang]}</span></span>
          <span className="hero-big">{current.terminal} · {t(lang, 'gate')} {current.gate}</span>
          <span className="hero-row sub"><span>{t(lang, 'boardsIn')} <b>{mins} min</b> · {hhmm(boardAt)}</span></span>
          <span className="hero-cta">{t(lang, 'continueGate')} <ArrowRight size={18} aria-hidden /></span>
        </button>
      ) : (
        <h1>{t(lang, 'tagline')}</h1>
      )}

      <section className="card search">
        <label className="field">
          <span>{t(lang, 'flightLabel')}</span>
          <span className="inputicon">
            <Search size={18} aria-hidden />
            <input value={query} placeholder={t(lang, 'flightPh')} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoCapitalize="characters" enterKeyHint="go" />
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
