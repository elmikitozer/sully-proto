import { useMemo, useState } from 'react'
import { ChevronRight, List, LocateFixed, Map as MapIcon, Navigation, Search, X } from 'lucide-react'
import MapView from '../MapView'
import { PLACE_KINDS, places, starts, walkTimes, type Lang, type Place, type PlaceKind } from '../model'
import { LEVELS } from '../router'
import { t } from '../i18n'
import { CAT_KEY, KindBadge, haptic, placeLabel, placeWhere } from '../ui'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const NO_ROUTES: never[] = []
// Opening view: level 1, main concourse between Orly 3 and Orly 4 (where most places are).
const HOME_VIEW = { l: 1, x: -60, y: -80 }

/** Search in French and English: each word must start a word of the place ("porte 34", "gate 34", "orly 3"). */
function matches(p: Place, words: string[]) {
  if (!words.length) return true
  const toks = norm(`${placeLabel(p, 'fr')} ${placeLabel(p, 'en')} ${placeWhere(p, 'fr')} ${placeWhere(p, 'en')} ${t('fr', CAT_KEY[p.kind])} ${t('en', CAT_KEY[p.kind])}`).split(/[\s·.()]+/)
  return words.every((w) => toks.some((tk) => tk.startsWith(w)))
}

interface Props {
  dir: string; lang: Lang; cat?: PlaceKind; setCat: (c?: PlaceKind) => void; list: boolean; setList: (l: boolean) => void
  start: string; setStart: (s: string) => void; onPlace: (pid: number) => void
}

export default function Explore(props: Props) {
  const { dir, lang, cat, setCat, list, setList } = props
  const [q, setQ] = useState('')
  const from = starts.find((s) => s.id === props.start)!
  const times = useMemo(() => walkTimes(from.pt), [from])
  const words = norm(q).split(/\s+/).filter(Boolean)
  const shown = useMemo(() => places.filter((p) => (!cat || p.kind === cat) && times.has(p.pid) && matches(p, words)), [cat, times, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const chips = (
    <div className="chips scroll">
      <button className={!cat ? 'on' : ''} onClick={() => setCat(undefined)}>{t(lang, 'all')}</button>
      {PLACE_KINDS.map((k) => <button key={k} className={(cat === k ? 'on ' : '') + 'k-' + k} onClick={() => setCat(cat === k ? undefined : k)}><KindBadge kind={k} size={14} />{t(lang, CAT_KEY[k])}</button>)}
    </div>
  )
  const toggle = (
    <div className="viewtoggle" role="tablist">
      <button role="tab" aria-selected={!list} className={!list ? 'on' : ''} onClick={() => setList(false)}><MapIcon size={16} aria-hidden /> {t(lang, 'viewMap')}</button>
      <button role="tab" aria-selected={list} className={list ? 'on' : ''} onClick={() => setList(true)}><List size={16} aria-hidden /> {t(lang, 'viewList')}</button>
    </div>
  )

  if (!list) return <ExploreMap {...props} q={q} setQ={setQ} shown={shown} times={times} chips={chips} toggle={toggle} fromLabel={from.label[lang]} fromPt={from.pt} />

  const sorted = [...shown].sort((a, b) => times.get(a.pid)! - times.get(b.pid)!)
  return (
    <main className="explore screen" data-dir={dir}>
      <div className="explore-head"><h1 className="title">{t(lang, 'exploreTitle')}</h1>{toggle}</div>
      <label className="inputicon big">
        <Search size={18} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, 'explorePh')} aria-label={t(lang, 'exploreTitle')} enterKeyHint="search" />
        {q && <button className="clear" onClick={() => setQ('')} aria-label="clear"><X size={16} /></button>}
      </label>
      {chips}
      <label className="field inline">
        <span>{t(lang, 'from')}</span>
        <select value={props.start} onChange={(e) => props.setStart(e.target.value)}>
          {starts.map((s) => <option key={s.id} value={s.id}>{s.label[lang]}</option>)}
        </select>
      </label>
      <p className="hint">{sorted.length ? t(lang, 'results', { n: sorted.length }) : t(lang, 'noResults')}</p>
      <ul className="places">
        {sorted.slice(0, 60).map((p) => (
          <li key={p.pid}>
            <button onClick={() => props.onPlace(p.pid)}>
              <KindBadge kind={p.kind} />
              <span className="pl-main"><b>{placeLabel(p, lang)}</b><span>{placeWhere(p, lang)}</span></span>
              <span className="pl-min">{times.get(p.pid)}<small> min</small></span>
              <ChevronRight size={18} className="chev" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

/** Free map: every place as a pin, level switcher, search, tap a pin for its card. No route until you ask. */
function ExploreMap({ dir, lang, q, setQ, shown, times, chips, toggle, fromLabel, fromPt, onPlace }: Props & {
  q: string; setQ: (q: string) => void; shown: Place[]; times: Map<number, number>; chips: React.ReactNode; toggle: React.ReactNode; fromLabel: string; fromPt: Place | { l: number; x: number; y: number }
}) {
  const [level, setLevel] = useState(1)
  const [sel, setSel] = useState<number | undefined>()
  const [focus, setFocus] = useState<{ p: { l: number; x: number; y: number }; key: number; w?: number; lift?: number } | null>(() => ({ p: HOME_VIEW, key: 0, w: 420 }))
  const [searching, setSearching] = useState(false)
  const selected = sel != null ? places.find((p) => p.pid === sel) : undefined
  const onLevel = shown.filter((p) => p.l === level).length
  const pick = (p: Place) => { haptic(); setSel(p.pid); setLevel(p.l); setFocus({ p, key: Date.now(), w: 200, lift: 0.08 }); setSearching(false) }
  const suggestions = q ? [...shown].sort((a, b) => times.get(a.pid)! - times.get(b.pid)!).slice(0, 6) : []
  return (
    <main className="explore screen mapmode" data-dir={dir}>
      <div className="xmap">
        <MapView level={level} routes={NO_ROUTES} markers={fromPt.l === level ? [{ p: fromPt, kind: 'start' }] : []} showPois={false} focus={focus}
          browse={{ places: shown, selected: sel, label: (p) => placeLabel(p, lang), onSelect: (pid) => { setSel(pid); setSearching(false); const p = pid != null && places.find((x) => x.pid === pid); if (p) setFocus({ p, key: Date.now(), w: 10000, lift: 0.08 }) } }} />
        <div className="xtop">
          <label className="inputicon big floating">
            <Search size={18} aria-hidden />
            <input value={q} onFocus={() => setSearching(true)} onChange={(e) => { setQ(e.target.value); setSearching(true) }} placeholder={t(lang, 'searchMap')} aria-label={t(lang, 'searchMap')} enterKeyHint="search"
              onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) pick(suggestions[0]) }} />
            {q && <button className="clear" onClick={() => { setQ(''); setSearching(false) }} aria-label="clear"><X size={16} /></button>}
          </label>
          {searching && suggestions.length > 0 && (
            <ul className="suggest">
              {suggestions.map((p) => (
                <li key={p.pid}><button onClick={() => pick(p)}>
                  <KindBadge kind={p.kind} size={16} />
                  <span className="pl-main"><b>{placeLabel(p, lang)}</b><span>{placeWhere(p, lang)}</span></span>
                  <span className="pl-min">{times.get(p.pid)}<small> min</small></span>
                </button></li>
              ))}
            </ul>
          )}
          {chips}
        </div>
        <div className="xside">
          {toggle}
        </div>
        <div className="xlevels" role="tablist" aria-label={t(lang, 'level')}>
          {[...LEVELS].reverse().map((l) => (
            <button key={l} role="tab" aria-selected={l === level} className={l === level ? 'on' : ''} onClick={() => { setLevel(l); setSel(undefined) }}>{l}</button>
          ))}
        </div>
        <button className="fab xlocate" aria-label={fromLabel} onClick={() => { setLevel(fromPt.l); setFocus({ p: fromPt, key: Date.now(), w: 260 }) }}><LocateFixed size={20} /></button>
        <div className="xlevelname">{t(lang, 'levelName', { l: level })} · {t(lang, 'placesHere', { n: onLevel })}</div>
        {selected && (
          <section key={selected.pid} className="xcard">
            <button className="xcard-x" onClick={() => setSel(undefined)} aria-label={t(lang, 'gotIt')}><X size={18} /></button>
            <div className="place-head">
              <KindBadge kind={selected.kind} size={22} />
              <div><h2 className="sheet-title">{placeLabel(selected, lang)}</h2><div className="muted">{placeWhere(selected, lang)}</div></div>
            </div>
            <p className="muted">{times.get(selected.pid)} min · {t(lang, 'fromYou', { p: fromLabel })}</p>
            <button className="primary" onClick={() => onPlace(selected.pid)}><Navigation size={18} aria-hidden /> {t(lang, 'directions')}</button>
          </section>
        )}
      </div>
    </main>
  )
}
