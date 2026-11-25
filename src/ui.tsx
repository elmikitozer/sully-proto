import { useState } from 'react'
import { Bus, Compass, Info, Navigation, Plane, ShieldCheck, TicketsPlane, Toilet, Utensils, type LucideIcon } from 'lucide-react'
import type { Lang, Place, PlaceKind } from './model'
import { t, type Key } from './i18n'
import type { Tab } from './route'
import { details } from './details'

export const KIND_ICON: Record<PlaceKind | 'stop', LucideIcon> = { toilet: Toilet, restaurant: Utensils, info: Info, gate: Plane, security: ShieldCheck, transport: Bus, stop: Utensils }
export const CAT_KEY: Record<PlaceKind, Key> = { toilet: 'catToilet', restaurant: 'catRestaurant', info: 'catInfo', gate: 'catGate', security: 'catSecurity', transport: 'catTransport' }
const NAME_KEY: Record<PlaceKind, Key> = { toilet: 'nameToilet', restaurant: 'nameRestaurant', info: 'nameInfo', gate: 'nameGate', security: 'nameSecurity', transport: 'nameTransport' }

export const placeLabel = (p: Place, lang: Lang) => {
  const d = details(p) // demo names for food outlets, transport type
  if (d.name) return d.name
  if (p.kind === 'transport') return d.subtitle[lang]
  return t(lang, NAME_KEY[p.kind], { n: p.name ?? '' }).trim()
}
export const placeWhere = (p: Place, lang: Lang) => `${p.terminal} · ${t(lang, 'levelShort', { l: p.l })}`

/** Light tap feedback where the browser supports it (Android); silent elsewhere. */
export const haptic = () => { try { navigator.vibrate?.(8) } catch { /* not supported */ } }

export function TabBar({ tab, lang, onTab }: { tab: Tab; lang: Lang; onTab: (t: Tab) => void }) {
  const items: { id: Tab; icon: LucideIcon; label: Key }[] = [
    { id: 'home', icon: Navigation, label: 'tabTrip' },
    { id: 'explore', icon: Compass, label: 'tabExplore' },
    { id: 'myflight', icon: TicketsPlane, label: 'tabFlight' },
  ]
  return (
    <nav className="tabbar" aria-label="Sully">
      {items.map(({ id, icon: Icon, label }) => (
        <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => { haptic(); onTab(id) }}>
          <Icon size={22} strokeWidth={tab === id ? 2.4 : 1.8} aria-hidden />
          <span>{t(lang, label)}</span>
        </button>
      ))}
    </nav>
  )
}

/** "Demo" pill: tap to read what is simulated. Keeps fake data honest. */
export function DemoPill({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="demopill-wrap">
      <button className="demopill" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{t(lang, 'demo')}</button>
      {open && <span className="demopop" role="note" onClick={() => setOpen(false)}>{t(lang, 'demoNote')}</span>}
    </span>
  )
}

export function KindBadge({ kind, size = 20, icon }: { kind: PlaceKind; size?: number; icon?: LucideIcon }) {
  const Icon = icon ?? KIND_ICON[kind]
  return <span className={'kind ' + kind}><Icon size={size} strokeWidth={2.2} aria-hidden /></span>
}
