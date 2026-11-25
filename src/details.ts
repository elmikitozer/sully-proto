// Details for each place. Names, categories and zones are the airport's own (parisaeroport.fr plan);
// offers, queue times and cleaning times are fictional demo data.
import { Accessibility, Armchair, Baby, BaggageClaim, Banknote, BatteryCharging, BookUser, Briefcase, Bus, CarTaxiFront, Cigarette, Clapperboard, Coffee, Croissant, Cross, Dog, Droplets, Gamepad2, Gem, Gift, Info, Landmark, Languages, Luggage, Newspaper, PackageSearch, ParkingMeter, Plane, PlugZap, Receipt, Sandwich, ScanFace, ShieldCheck, Shirt, ShoppingBasket, Sofa, Soup, Sparkles, Stethoscope, TicketsPlane, Toilet, ToyBrick, TrainFront, Utensils, Watch, Leaf, ShoppingBag, type LucideIcon } from 'lucide-react'
import { flights, waitMin, checkpoints, PASSPORT_MIN, type Lang, type Place } from './model'

type L = { fr: string; en: string }
const hash = (n: number) => { let x = (n + 1) * 2654435761; x = (x ^ (x >>> 13)) >>> 0; return x }

// Food outlets and shops: name and category are real. Typical time spent is our estimate. Offers stay fictional (business-model demo).
interface Type { type: L; icon: LucideIcon; min: number; tone: string }
const FOOD: Record<string, Type> = {
  cafe: { type: { fr: 'Café', en: 'Coffee shop' }, icon: Coffee, min: 10, tone: 'brown' },
  bakery: { type: { fr: 'Boulangerie', en: 'Bakery' }, icon: Croissant, min: 8, tone: 'amber' },
  fast_food: { type: { fr: 'Restauration rapide', en: 'Fast food' }, icon: Sandwich, min: 15, tone: 'orange' },
  restaurant: { type: { fr: 'Restaurant', en: 'Restaurant' }, icon: Soup, min: 35, tone: 'red' },
}
const OTHER_FOOD: Type = { type: { fr: 'Restauration', en: 'Food & drinks' }, icon: Utensils, min: 15, tone: 'orange' }
const SHOP: Record<string, Type> = {
  news: { type: { fr: 'Presse, livres, multimédia', en: 'News, books & tech' }, icon: Newspaper, min: 5, tone: 'red' },
  fashion: { type: { fr: 'Mode et accessoires', en: 'Fashion & accessories' }, icon: Shirt, min: 15, tone: 'plum' },
  dutyfree: { type: { fr: 'Duty free', en: 'Duty free' }, icon: Gift, min: 15, tone: 'rose' },
  gourmet: { type: { fr: 'Gastronomie', en: 'Fine food' }, icon: Gem, min: 8, tone: 'brown' },
  convenience: { type: { fr: 'Supérette', en: 'Convenience store' }, icon: ShoppingBasket, min: 8, tone: 'green' },
  pharmacy: { type: { fr: 'Pharmacie', en: 'Pharmacy' }, icon: Cross, min: 8, tone: 'green' },
  exchange: { type: { fr: 'Bureau de change', en: 'Currency exchange' }, icon: Banknote, min: 8, tone: 'teal' },
  beauty: { type: { fr: 'Beauté', en: 'Beauty' }, icon: Sparkles, min: 10, tone: 'rose' },
  watches: { type: { fr: 'Montres et bijoux', en: 'Watches & jewellery' }, icon: Watch, min: 10, tone: 'violet' },
}
const OTHER_SHOP: Type = { type: { fr: 'Boutique', en: 'Shop' }, icon: ShoppingBag, min: 10, tone: 'plum' }
const SERVICE: Record<string, { label: L; icon: LucideIcon; min?: number }> = {
  baby: { label: { fr: 'Espace bébé', en: 'Baby care room' }, icon: Baby, min: 10 },
  kids: { label: { fr: 'Jeux pour enfants', en: 'Kids’ play area' }, icon: ToyBrick, min: 15 },
  games: { label: { fr: 'Jeux vidéo', en: 'Video games' }, icon: Gamepad2, min: 15 },
  lounge: { label: { fr: 'Salon', en: 'Lounge' }, icon: Sofa, min: 30 },
  atm: { label: { fr: 'Distributeur de billets', en: 'Cash machine' }, icon: Landmark, min: 3 },
  water: { label: { fr: 'Fontaine à eau', en: 'Water fountain' }, icon: Droplets, min: 1 },
  taxrefund: { label: { fr: 'Détaxe', en: 'Tax refund' }, icon: Receipt, min: 10 },
  baggage: { label: { fr: 'Livraison bagages', en: 'Baggage claim' }, icon: BaggageClaim },
  bagservice: { label: { fr: 'Service bagages', en: 'Baggage service' }, icon: Luggage },
  bagwrap: { label: { fr: 'Emballage et pesée des bagages', en: 'Baggage wrapping & weighing' }, icon: Briefcase, min: 5 },
  luggage: { label: { fr: 'Consigne à bagages', en: 'Left luggage' }, icon: Luggage, min: 5 },
  prayer: { label: { fr: 'Espace prière', en: 'Prayer room' }, icon: Leaf, min: 10 },
  smoking: { label: { fr: 'Espace fumeurs', en: 'Smoking area' }, icon: Cigarette, min: 5 },
  charge: { label: { fr: 'Recharge de téléphone', en: 'Phone charging' }, icon: BatteryCharging, min: 15 },
  assist: { label: { fr: 'Espace assistance mobilité', en: 'Mobility assistance point' }, icon: Accessibility },
  medical: { label: { fr: 'Centre médical', en: 'Medical centre' }, icon: Stethoscope },
  lost: { label: { fr: 'Objets trouvés', en: 'Lost property' }, icon: PackageSearch },
  rest: { label: { fr: 'Espace détente', en: 'Rest area' }, icon: Armchair, min: 15 },
  dog: { label: { fr: 'Espace canin', en: 'Dog relief area' }, icon: Dog, min: 5 },
  cinema: { label: { fr: 'Espace cinéma', en: 'Cinema corner' }, icon: Clapperboard, min: 20 },
}
const TRANSPORT: Record<string, { label: L; icon: LucideIcon }> = {
  bus: { label: { fr: 'Bus et navettes', en: 'Buses & shuttles' }, icon: Bus },
  taxi: { label: { fr: 'Taxis et VTC', en: 'Taxis & ride-hailing' }, icon: CarTaxiFront },
  orlyval: { label: { fr: 'Orlyval', en: 'Orlyval' }, icon: TrainFront },
  metro: { label: { fr: 'Métro', en: 'Metro' }, icon: TrainFront },
  dropoff: { label: { fr: 'Dépose-minute', en: 'Drop-off' }, icon: ParkingMeter },
}
const OFFERS: L[] = [
  { fr: '-15 % sur le menu', en: '15% off the set menu' },
  { fr: '2e boisson à -50 %', en: 'Second drink half price' },
]

type TagId = 'seats' | 'usb' | 'takeaway' | 'kids' | 'veggie' | 'baby' | 'pmr' | 'langs' | 'fast'
export const TAGS: Record<TagId, { icon: LucideIcon; label: L }> = {
  seats: { icon: Armchair, label: { fr: 'Places assises', en: 'Seating' } },
  usb: { icon: PlugZap, label: { fr: 'Prises', en: 'Power outlets' } },
  takeaway: { icon: ShoppingBag, label: { fr: 'À emporter', en: 'Takeaway' } },
  kids: { icon: Baby, label: { fr: 'Menu enfant', en: 'Kids’ menu' } },
  veggie: { icon: Leaf, label: { fr: 'Végétarien', en: 'Vegetarian' } },
  baby: { icon: Baby, label: { fr: 'Table à langer', en: 'Baby changing' } },
  pmr: { icon: Accessibility, label: { fr: 'File dédiée mobilité réduite', en: 'Reduced-mobility lane' } },
  langs: { icon: Languages, label: { fr: 'FR · EN · ES · AR', en: 'FR · EN · ES · AR' } },
  fast: { icon: Sparkles, label: { fr: 'Accès N° 1 (file prioritaire)', en: 'Accès N° 1 (priority lane)' } },
}

export interface Details {
  name?: string
  /** Localised name for places the airport does not name (services, passport control…). */
  title?: L
  subtitle: L
  icon: LucideIcon
  tone: string
  hours?: [number, number] // minutes after midnight
  price?: number
  stayMin: number // typical time spent there
  tags: TagId[]
  live?: L // live-ish line ("cleaned 12 min ago", "wait 7 min")
  offer?: { text: L; code: string }
}

const cache = new Map<number, Details>()
export function details(p: Place): Details {
  const hit = cache.get(p.pid); if (hit) return hit
  const h = hash(p.pid)
  let d: Details
  switch (p.kind) {
    case 'restaurant': {
      const f = FOOD[p.sub ?? ''] ?? OTHER_FOOD
      d = { name: p.name, subtitle: f.type, icon: f.icon, tone: f.tone, stayMin: f.min, tags: [],
        offer: h % 4 === 1 ? { text: OFFERS[(h >>> 3) % OFFERS.length], code: `SULLY-${(p.pid * 37 % 9000) + 1000}` } : undefined }
      break
    }
    case 'shop': {
      const f = SHOP[p.sub ?? ''] ?? OTHER_SHOP
      d = { name: p.name, subtitle: f.type, icon: f.icon, tone: f.tone, stayMin: f.min, tags: [],
        offer: h % 5 === 2 && p.sub !== 'pharmacy' && p.sub !== 'exchange' ? { text: { fr: '-10 % dès 30 € d’achat', en: '10% off from €30' }, code: `SULLY-${(p.pid * 37 % 9000) + 1000}` } : undefined }
      break
    }
    case 'toilet':
      d = { subtitle: { fr: 'Sanitaires', en: 'Restrooms' }, icon: Toilet, tone: 'teal', stayMin: 5, tags: [],
        live: { fr: `Nettoyées il y a ${5 + (h % 25)} min (démo)`, en: `Cleaned ${5 + (h % 25)} min ago (demo)` } }
      break
    case 'info':
      d = p.sub === 'kiosk'
        ? { title: { fr: 'Borne d’information', en: 'Information kiosk' }, subtitle: { fr: 'Borne d’orientation en libre-service', en: 'Self-service wayfinding kiosk' }, icon: Info, tone: 'violet', stayMin: 3, tags: [] }
        : { title: { fr: 'Point information', en: 'Information desk' }, subtitle: { fr: 'Accueil et information', en: 'Help & information' }, icon: Info, tone: 'violet', stayMin: 5, tags: ['langs'] }
      break
    case 'security': {
      if (p.sub) {
        const parafe = p.sub === 'parafe'
        d = { title: parafe ? { fr: 'Passeports · sas PARAFE', en: 'Passports · PARAFE e-gates' } : { fr: 'Contrôle des passeports', en: 'Passport control' },
          subtitle: parafe ? { fr: 'Contrôle automatisé, passeport biométrique', en: 'Automated check, biometric passport' } : { fr: 'Police aux frontières · vols hors Schengen', en: 'Border police · non-Schengen flights' },
          icon: parafe ? ScanFace : BookUser, tone: 'red', stayMin: PASSPORT_MIN, tags: [],
          live: { fr: `Attente estimée ${PASSPORT_MIN} min`, en: `Estimated wait ${PASSPORT_MIN} min` } }
        break
      }
      const cp = checkpoints.find((c) => c.x === p.x && c.y === p.y && c.l === p.l)
      const w = cp ? waitMin(cp) : 6
      d = { subtitle: { fr: 'Contrôle de sûreté', en: 'Security check' }, icon: ShieldCheck, tone: 'red', stayMin: w, tags: [...(cp?.priority ? ['fast' as const] : []), ...(cp?.assisted ? ['pmr' as const] : [])],
        live: { fr: `Attente estimée ${w} min`, en: `Estimated wait ${w} min` } }
      break
    }
    case 'gate': {
      const f = flights.find((x) => x.gate === p.name)
      d = { subtitle: { fr: 'Porte d’embarquement', en: 'Boarding gate' }, icon: Plane, tone: 'green', stayMin: 0, tags: [],
        live: f ? { fr: `${f.code} vers ${f.city.fr}`, en: `${f.code} to ${f.city.en}` } : { fr: 'Pas de vol de démo à cette porte', en: 'No demo flight at this gate' } }
      break
    }
    case 'checkin':
      d = { title: p.name === 'kiosk' ? { fr: 'Bornes d’enregistrement', en: 'Check-in kiosks' } : { fr: `Enregistrement ${p.name ?? ''}`.trim(), en: `Check-in ${p.name ?? ''}`.trim() },
        subtitle: { fr: 'Enregistrement et dépôt des bagages', en: 'Check-in and bag drop' }, icon: TicketsPlane, tone: 'blue', stayMin: 10, tags: [] }
      break
    case 'service': {
      const sv = SERVICE[p.sub ?? ''] ?? { label: { fr: 'Service', en: 'Service' }, icon: Info }
      d = { name: p.name, title: p.name ? undefined : sv.label, subtitle: sv.label, icon: sv.icon, tone: 'sky', stayMin: sv.min ?? 0, tags: [] }
      break
    }
    default: {
      const tr = TRANSPORT[p.sub ?? ''] ?? TRANSPORT.bus
      d = { name: p.name, subtitle: tr.label, icon: tr.icon, tone: 'blue', stayMin: 0, tags: [] }
    }
  }
  cache.set(p.pid, d)
  return d
}

const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/** Open now? And the line to show ("Open · closes 22:30"). */
export function openState(d: Details, now: number, lang: Lang): { open: boolean; text: string } | null {
  if (!d.hours) return null
  const [o, c] = d.hours
  if (o === 0 && c === 1440) return { open: true, text: lang === 'fr' ? 'Ouvert 24 h/24' : 'Open 24 hours' }
  const t = new Date(now), m = t.getHours() * 60 + t.getMinutes()
  const open = m >= o && m < c
  return open
    ? { open, text: lang === 'fr' ? `Ouvert · ferme à ${hm(c)}` : `Open · closes ${hm(c)}` }
    : { open, text: lang === 'fr' ? `Fermé · ouvre à ${hm(o)}` : `Closed · opens ${hm(o)}` }
}
export const priceText = (n?: number) => (n ? '€'.repeat(n) : '')
