import { useEffect, useState } from 'react'
import { BadgePercent, Clock3, DoorOpen, Footprints, Navigation, QrCode, ShieldCheck } from 'lucide-react'
import { details, openState, priceText, TAGS } from './details'
import { useNow } from './clock'
import { zoneOf, type Lang, type Place } from './model'
import { t } from './i18n'
import { haptic, placeLabel, placeWhere } from './ui'

interface Photo { url: string; by: string | null }
const photoCache = new Map<string, Photo | null>()
/** Real photo of a named outlet (Google Places, via /api/photo). null = none, keep the illustration. */
function usePhoto(place: Place): Photo | null {
  const id = place.osm && place.name && (place.kind === 'shop' || place.kind === 'restaurant') ? place.osm : undefined
  const [photo, setPhoto] = useState<Photo | null>(id ? photoCache.get(id) ?? null : null)
  useEffect(() => {
    setPhoto(id ? photoCache.get(id) ?? null : null)
    if (!id || photoCache.has(id)) return
    let live = true
    fetch(`/api/photo?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Photo>) : null))
      .then((p) => { const v = p && typeof p.url === 'string' ? p : null; photoCache.set(id, v); if (live) setPhoto(v) })
      .catch(() => { photoCache.set(id, null) })
    return () => { live = false }
  }, [id])
  return photo
}

/** Rich place card: cover, name, open now, live info, features, sponsored offer, directions. */
export default function PlaceInfo({ place, lang, walkMin, queue, fromLabel, onGo, compact }: { place: Place; lang: Lang; walkMin?: number; queue?: { min: number; name: string }; fromLabel?: string; onGo?: () => void; compact?: boolean }) {
  const d = details(place)
  const now = useNow(30000)
  const os = openState(d, now, lang)
  const [code, setCode] = useState(false)
  const Icon = d.icon
  const photo = usePhoto(place)
  const [broken, setBroken] = useState<string | null>(null)
  const img = photo && broken !== photo.url ? photo : null
  return (
    <div className={'pinfo' + (compact ? ' compact' : '')}>
      <div className={'cover tone-' + d.tone + (img ? ' has-photo' : '')} aria-hidden={!img}>
        {img
          ? <><img src={img.url} alt={placeLabel(place, lang)} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(img.url)} /><span className="cover-credit">{t(lang, 'photoBy', { a: img.by ?? 'Google' })}</span></>
          : <Icon size={compact ? 34 : 52} strokeWidth={1.5} />}
        {d.offer && <span className="cover-badge"><BadgePercent size={14} /> {t(lang, 'offer')}</span>}
      </div>
      <div className="pinfo-head">
        <h2 className="sheet-title">{placeLabel(place, lang)}</h2>
        <div className="muted">{[d.name ? d.subtitle[lang] : null, priceText(d.price), placeWhere(place, lang)].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="pinfo-lines">
        {os && <span className={os.open ? 'ok' : 'warn'}><Clock3 size={14} aria-hidden /> {os.text}</span>}
        {d.live && <span className="live"><span className="pulse" aria-hidden /> {d.live[lang]}</span>}
        {zoneOf(place) === 'airside' && <span><ShieldCheck size={14} aria-hidden /> {t(lang, 'zoneAirside')}</span>}
        {zoneOf(place) === 'public' && <span><DoorOpen size={14} aria-hidden /> {t(lang, 'zonePublic')}</span>}
        {walkMin != null && <span><Footprints size={14} aria-hidden /> {walkMin} min{fromLabel ? ` · ${t(lang, 'fromYou', { p: fromLabel })}` : ''}{queue ? ` · ${t(lang, 'queueIncl', { n: queue.min, s: queue.name })}` : ''}</span>}
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
