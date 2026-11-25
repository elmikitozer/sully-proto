import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import PlaceInfo from '../PlaceInfo'
import MapView from '../MapView'
import { places, walkTimes, type Lang, type Place as P, type PlaceRoute } from '../model'
import type { Pt } from '../router'
import { t } from '../i18n'
import { KindBadge, placeLabel, placeWhere } from '../ui'

export const placeMarkerKind = (p: P) => (p.kind === 'gate' ? 'gate' : p.kind === 'security' ? 'security' : 'stop') as 'gate' | 'security' | 'stop'

interface Props { dir: string; lang: Lang; place: P; route: PlaceRoute; startPt: Pt; startLabel: string; onBack: () => void; onStart: () => void; onPlace: (pid: number) => void }

export default function Place({ dir, lang, place, route, startPt, startLabel, onBack, onStart, onPlace }: Props) {
  const times = useMemo(() => walkTimes(startPt), [startPt])
  const alts = useMemo(() => places.filter((p) => p.kind === place.kind && p.pid !== place.pid && times.has(p.pid))
    .sort((a, b) => times.get(a.pid)! - times.get(b.pid)!).slice(0, 3), [place, times, startPt])
  return (
    <main className="detail screen" data-dir={dir}>
      <div className="detail-map">
        <MapView level={place.l} routes={[{ path: route.path, active: true }]} markers={[{ p: startPt, kind: 'start' }, { p: place, kind: placeMarkerKind(place), label: place.kind === 'gate' ? place.name : undefined }]} />
        <button className="fab back-fab" onClick={onBack} aria-label={t(lang, 'back')}><ChevronLeft size={22} /></button>
      </div>
      <section className="sheet">
        <div className="grab" aria-hidden />
        <PlaceInfo place={place} lang={lang} walkMin={route.walkMin} queue={route.queueMin != null ? { min: route.queueMin, name: route.via ?? '' } : undefined} fromLabel={`${startLabel} · ${Math.round(route.metres / 10) * 10} m`} onGo={onStart} />
        {alts.length > 0 && <>
          <h3 className="sub-h">{t(lang, 'nearbyAlt')}</h3>
          <ul className="places compact">
            {alts.map((p) => (
              <li key={p.pid}><button onClick={() => onPlace(p.pid)}>
                <KindBadge kind={p.kind} size={16} />
                <span className="pl-main"><b>{placeLabel(p, lang)}</b><span>{placeWhere(p, lang)}</span></span>
                <span className="pl-min">{times.get(p.pid)}<small> min</small></span>
              </button></li>
            ))}
          </ul>
        </>}
      </section>
    </main>
  )
}
