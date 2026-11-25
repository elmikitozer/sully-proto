import { useState } from 'react'
import { Bus, ConciergeBell, Compass, Info, Navigation, Plane, ShieldCheck, ShoppingBag, TicketsPlane, Toilet, Utensils, type LucideIcon } from 'lucide-react'
import { zoneOf, type Lang, type Place, type PlaceKind } from './model'
import { t, type Key } from './i18n'
import type { Tab } from './route'
import { details } from './details'

export const KIND_ICON: Record<PlaceKind | 'stop', LucideIcon> = { toilet: Toilet, restaurant: Utensils, shop: ShoppingBag, info: Info, gate: Plane, security: ShieldCheck, checkin: TicketsPlane, service: ConciergeBell, transport: Bus, stop: Utensils }
export const CAT_KEY: Record<PlaceKind, Key> = { toilet: 'catToilet', restaurant: 'catRestaurant', shop: 'catShop', info: 'catInfo', gate: 'catGate', security: 'catSecurity', checkin: 'catCheckin', service: 'catService', transport: 'catTransport' }
const NAME_KEY: Record<PlaceKind, Key> = { toilet: 'nameToilet', restaurant: 'nameRestaurant', shop: 'nameShop', info: 'nameInfo', gate: 'nameGate', security: 'nameSecurity', checkin: 'catCheckin', service: 'catService', transport: 'nameTransport' }

export const placeLabel = (p: Place, lang: Lang) => {
  const d = details(p) // demo names for food outlets, transport type
  if (d.name) return d.name
  if (d.title) return d.title[lang]
  if (p.kind === 'transport') return d.subtitle[lang]
  return t(lang, NAME_KEY[p.kind], { n: p.name ?? '' }).trim()
}
export const placeWhere = (p: Place, lang: Lang) => `${p.terminal} · ${t(lang, 'levelShort', { l: p.l })}${zoneOf(p) === 'airside' ? ` · ${t(lang, 'zoneShort')}` : ''}`

/** Light tap feedback where the browser supports it (Android); silent elsewhere. */
export const haptic = () => { try { navigator.vibrate?.(8) } catch { /* not supported */ } }

export function TabBar({ tab, lang, onTab }: { tab: Tab; lang: Lang; onTab: (t: Tab) => void }) {
  const items: { id: Tab; href: string; icon: LucideIcon; label: Key }[] = [
    { id: 'home', href: '/', icon: Navigation, label: 'tabTrip' },
    { id: 'explore', href: '/explore', icon: Compass, label: 'tabExplore' },
    { id: 'myflight', href: '/my-flight', icon: TicketsPlane, label: 'tabFlight' },
  ]
  return (
    <nav className="tabbar" aria-label="Sully">
      {items.map(({ id, href, icon: Icon, label }) => (
        // Real links (open in a new tab, long-press preview); a plain tap stays in the app.
        <a key={id} href={href} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined}
          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); haptic(); onTab(id) }}>
          <Icon size={22} strokeWidth={tab === id ? 2.4 : 1.8} aria-hidden />
          <span>{t(lang, label)}</span>
        </a>
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
