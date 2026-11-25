import { useMemo, useState } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import { PLACE_KINDS, places, starts, walkTimes, type Lang, type PlaceKind } from '../model'
import { t } from '../i18n'
import { CAT_KEY, KindBadge, placeLabel, placeWhere } from '../ui'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Props { dir: string; lang: Lang; cat?: PlaceKind; setCat: (c?: PlaceKind) => void; start: string; setStart: (s: string) => void; onPlace: (pid: number) => void }

export default function Explore({ dir, lang, cat, setCat, start, setStart, onPlace }: Props) {
  const [q, setQ] = useState('')
  const from = starts.find((s) => s.id === start)!.pt
  const times = useMemo(() => walkTimes(from), [from])
  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    return places
      .filter((p) => (!cat || p.kind === cat) && times.has(p.pid))
      .map((p) => ({ p, min: times.get(p.pid)!, label: placeLabel(p, lang), where: placeWhere(p, lang) }))
      // Each word must start a word of the place, in French or English ("porte 34", "gate 34", "orly 3").
      .filter((x) => {
        const toks = norm(`${placeLabel(x.p, 'fr')} ${placeLabel(x.p, 'en')} ${placeWhere(x.p, 'fr')} ${placeWhere(x.p, 'en')} ${t('fr', CAT_KEY[x.p.kind])} ${t('en', CAT_KEY[x.p.kind])}`).split(/[\s·.]+/)
        return words.every((w) => toks.some((tk) => tk.startsWith(w)))
      })
      .sort((a, b) => a.min - b.min)
  }, [q, cat, times, lang])
  return (
    <main className="explore screen" data-dir={dir}>
      <h1 className="title">{t(lang, 'exploreTitle')}</h1>
      <label className="inputicon big">
        <Search size={18} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, 'explorePh')} aria-label={t(lang, 'exploreTitle')} enterKeyHint="search" />
        {q && <button className="clear" onClick={() => setQ('')} aria-label="clear"><X size={16} /></button>}
      </label>
      <div className="chips scroll">
        <button className={!cat ? 'on' : ''} onClick={() => setCat(undefined)}>{t(lang, 'all')}</button>
        {PLACE_KINDS.map((k) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{t(lang, CAT_KEY[k])}</button>)}
      </div>
      <label className="field inline">
        <span>{t(lang, 'from')}</span>
        <select value={start} onChange={(e) => setStart(e.target.value)}>
          {starts.map((s) => <option key={s.id} value={s.id}>{s.label[lang]}</option>)}
        </select>
      </label>
      <p className="hint">{list.length ? t(lang, 'results', { n: list.length }) : t(lang, 'noResults')}</p>
      <ul className="places">
        {list.slice(0, 60).map(({ p, min, label, where }) => (
          <li key={p.pid}>
            <button onClick={() => onPlace(p.pid)}>
              <KindBadge kind={p.kind} />
              <span className="pl-main"><b>{label}</b><span>{where}</span></span>
              <span className="pl-min">{min}<small> min</small></span>
              <ChevronRight size={18} className="chev" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
