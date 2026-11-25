import { useState } from 'react'
import { BadgePercent, Clock3, Footprints, Navigation, QrCode } from 'lucide-react'
import { details, openState, priceText, TAGS } from './details'
import { useNow } from './clock'
import type { Lang, Place } from './model'
import { t } from './i18n'
import { haptic, placeLabel, placeWhere } from './ui'

/** Rich place card: cover, name, open now, live info, features, sponsored offer, directions. */
export default function PlaceInfo({ place, lang, walkMin, fromLabel, onGo, compact }: { place: Place; lang: Lang; walkMin?: number; fromLabel?: string; onGo?: () => void; compact?: boolean }) {
  const d = details(place)
  const now = useNow(30000)
  const os = openState(d, now, lang)
  const [code, setCode] = useState(false)
  const Icon = d.icon
  return (
    <div className={'pinfo' + (compact ? ' compact' : '')}>
      <div className={'cover tone-' + d.tone} aria-hidden>
        <Icon size={compact ? 34 : 52} strokeWidth={1.5} />
        {d.offer && <span className="cover-badge"><BadgePercent size={14} /> {t(lang, 'offer')}</span>}
      </div>
      <div className="pinfo-head">
        <h2 className="sheet-title">{placeLabel(place, lang)}</h2>
        <div className="muted">{[d.name ? d.subtitle[lang] : null, priceText(d.price), placeWhere(place, lang)].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="pinfo-lines">
        {os && <span className={os.open ? 'ok' : 'warn'}><Clock3 size={14} aria-hidden /> {os.text}</span>}
        {d.live && <span className="live"><span className="pulse" aria-hidden /> {d.live[lang]}</span>}
        {walkMin != null && <span><Footprints size={14} aria-hidden /> {walkMin} min{fromLabel ? ` · ${t(lang, 'fromYou', { p: fromLabel })}` : ''}</span>}
      </div>
      {d.tags.length > 0 && (
        <ul className="tags">{d.tags.map((id) => { const T = TAGS[id]; return <li key={id}><T.icon size={14} aria-hidden /> {T.label[lang]}</li> })}</ul>
      )}
      {place.i === 'osm' && place.kind !== 'gate' && <p className="hint src">{t(lang, 'osmNote')}</p>}
      {d.offer && (
        <div className="offer">
          <div className="offer-top"><span className="sponsored">{t(lang, 'sponsored')}</span><b>{d.offer.text[lang]}</b></div>
          {code
            ? <div className="offer-code"><QrCode size={40} aria-hidden /><span><small>{t(lang, 'showAtTill')}</small><b>{d.offer.code}</b></span></div>
            : <button className="offer-btn" onClick={() => { haptic(); setCode(true) }}>{t(lang, 'getOffer')}</button>}
        </div>
      )}
      {onGo && <button className="primary" onClick={() => { haptic(); onGo() }}><Navigation size={18} aria-hidden /> {t(lang, 'directions')}</button>}
    </div>
  )
}
