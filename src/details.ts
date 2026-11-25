// Details for each place. Names of shops and food outlets are real (OpenStreetMap);
// offers, queue times and cleaning times are fictional demo data.
// A real version would read the airport's retail database.
import { Accessibility, Armchair, Baby, Banknote, BookOpen, Coffee, Cookie, Croissant, Cross, Gem, Gift, Glasses, Info, Languages, Newspaper, Plane, PlugZap, Sandwich, ShieldCheck, Shirt, ShoppingBasket, Smartphone, Soup, Sparkles, Toilet, TrainFront, Bus, CarTaxiFront, Utensils, Watch, Wine, Leaf, ShoppingBag, type LucideIcon } from 'lucide-react'
import { flights, waitMin, checkpoints, type Lang, type Place } from './model'

type L = { fr: string; en: string }
const hash = (n: number) => { let x = (n + 1) * 2654435761; x = (x ^ (x >>> 13)) >>> 0; return x }

// Food outlets and shops: the NAME, type and (when mapped) opening hours are real, from OpenStreetMap.
// Typical time spent is our estimate. Offers stay fictional (business-model demo).
interface Type { type: L; icon: LucideIcon; min: number; tone: string }
const FOOD: Record<string, Type> = {
  cafe: { type: { fr: 'Café', en: 'Coffee shop' }, icon: Coffee, min: 10, tone: 'brown' },
  bakery: { type: { fr: 'Boulangerie', en: 'Bakery' }, icon: Croissant, min: 8, tone: 'amber' },
  fast_food: { type: { fr: 'Restauration rapide', en: 'Fast food' }, icon: Sandwich, min: 15, tone: 'orange' },
  restaurant: { type: { fr: 'Restaurant', en: 'Restaurant' }, icon: Soup, min: 35, tone: 'red' },
  bar: { type: { fr: 'Bar', en: 'Bar' }, icon: Wine, min: 20, tone: 'plum' },
}
const UNNAMED_FOOD: Type = { type: { fr: 'Restauration', en: 'Food & drinks' }, icon: Utensils, min: 15, tone: 'orange' }
const SHOP: Record<string, Type> = {
  newsagent: { type: { fr: 'Presse et snacks', en: 'News & snacks' }, icon: Newspaper, min: 5, tone: 'red' },
  books: { type: { fr: 'Livres et high-tech', en: 'Books & tech' }, icon: BookOpen, min: 10, tone: 'amber' },
  clothes: { type: { fr: 'Mode', en: 'Fashion' }, icon: Shirt, min: 15, tone: 'plum' },
  bag: { type: { fr: 'Maroquinerie', en: 'Bags' }, icon: ShoppingBag, min: 15, tone: 'plum' },
  gift: { type: { fr: 'Duty free', en: 'Duty free' }, icon: Gift, min: 15, tone: 'rose' },
  department_store: { type: { fr: 'Duty free', en: 'Duty free' }, icon: Gift, min: 15, tone: 'rose' },
  supermarket: { type: { fr: 'Alimentation', en: 'Groceries' }, icon: ShoppingBasket, min: 8, tone: 'green' },
  convenience: { type: { fr: 'Supérette', en: 'Convenience store' }, icon: ShoppingBasket, min: 8, tone: 'green' },
  pastry: { type: { fr: 'Pâtisserie et chocolat', en: 'Pastry & chocolate' }, icon: Cookie, min: 8, tone: 'brown' },
  tea: { type: { fr: 'Thé', en: 'Tea' }, icon: Coffee, min: 8, tone: 'brown' },
  coffee: { type: { fr: 'Café', en: 'Coffee' }, icon: Coffee, min: 8, tone: 'brown' },
  pharmacy: { type: { fr: 'Pharmacie', en: 'Pharmacy' }, icon: Cross, min: 8, tone: 'green' },
  bureau_de_change: { type: { fr: 'Bureau de change', en: 'Currency exchange' }, icon: Banknote, min: 8, tone: 'teal' },
  beauty: { type: { fr: 'Beauté', en: 'Beauty' }, icon: Sparkles, min: 10, tone: 'rose' },
  perfumery: { type: { fr: 'Beauté et lingerie', en: 'Beauty & lingerie' }, icon: Sparkles, min: 10, tone: 'rose' },
  jewelry: { type: { fr: 'Bijoux', en: 'Jewellery' }, icon: Gem, min: 10, tone: 'violet' },
  watches: { type: { fr: 'Montres', en: 'Watches' }, icon: Watch, min: 10, tone: 'violet' },
  optician: { type: { fr: 'Lunettes de soleil', en: 'Sunglasses' }, icon: Glasses, min: 10, tone: 'sky' },
  mobile_phone: { type: { fr: 'Téléphonie', en: 'Mobile phones' }, icon: Smartphone, min: 10, tone: 'blue' },
}
const OTHER_SHOP: Type = { type: { fr: 'Boutique', en: 'Shop' }, icon: ShoppingBag, min: 10, tone: 'plum' }
/** First "HH:MM-HH:MM" range of an OSM opening_hours value (weekday hours in practice). */
const osmHours = (h?: string): [number, number] | undefined => {
  const m = h?.match(/(\d\d):(\d\d)-(\d\d):(\d\d)/)
  return m ? [+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]] : undefined
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
  pmr: { icon: Accessibility, label: { fr: 'Accès PMR', en: 'Step-free' } },
  langs: { icon: Languages, label: { fr: 'FR · EN · ES · AR', en: 'FR · EN · ES · AR' } },
  fast: { icon: Sparkles, label: { fr: 'Coupe-file', en: 'Fast track' } },
}

export interface Details {
  name?: string
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

const TRANSPORT: { label: L; icon: LucideIcon }[] = [
  { label: { fr: 'Bus et navettes', en: 'Buses & shuttles' }, icon: Bus },
  { label: { fr: 'Taxis', en: 'Taxis' }, icon: CarTaxiFront },
  { label: { fr: 'Métro 14 · Orlyval', en: 'Metro 14 · Orlyval' }, icon: TrainFront },
]

const cache = new Map<number, Details>()
export function details(p: Place): Details {
  const hit = cache.get(p.pid); if (hit) return hit
  const h = hash(p.pid)
  let d: Details
  switch (p.kind) {
    case 'restaurant': {
      const f = (p.name && FOOD[p.sub ?? '']) || UNNAMED_FOOD
      d = { name: p.name, subtitle: f.type, icon: f.icon, tone: f.tone, hours: osmHours(p.h), stayMin: f.min, tags: [],
        offer: p.name && h % 4 === 1 ? { text: OFFERS[(h >>> 3) % OFFERS.length], code: `SULLY-${(p.pid * 37 % 9000) + 1000}` } : undefined }
      break
    }
    case 'shop': {
      const f = SHOP[p.sub ?? ''] ?? OTHER_SHOP
      d = { name: p.name, subtitle: f.type, icon: f.icon, tone: f.tone, hours: osmHours(p.h), stayMin: f.min, tags: [],
        offer: h % 5 === 2 ? { text: { fr: '-10 % dès 30 € d’achat', en: '10% off from €30' }, code: `SULLY-${(p.pid * 37 % 9000) + 1000}` } : undefined }
      break
    }
    case 'toilet':
      d = { subtitle: { fr: 'Sanitaires', en: 'Restrooms' }, icon: Toilet, tone: 'teal', hours: [0, 1440], stayMin: 5, tags: h % 2 ? ['pmr', 'baby'] : ['pmr'],
        live: { fr: `Nettoyées il y a ${5 + (h % 25)} min`, en: `Cleaned ${5 + (h % 25)} min ago` } }
      break
    case 'info':
      d = { subtitle: { fr: 'Accueil et information', en: 'Help & information' }, icon: Info, tone: 'violet', hours: [300, 1410], stayMin: 5, tags: ['langs', 'pmr'] }
      break
    case 'security': {
      const cp = checkpoints.find((c) => c.x === p.x && c.y === p.y && c.l === p.l)
      const w = cp ? waitMin(cp) : 6
      d = { subtitle: { fr: 'Contrôle de sûreté', en: 'Security check' }, icon: ShieldCheck, tone: 'red', hours: [270, 1380], stayMin: w, tags: h % 3 === 0 ? ['fast', 'pmr'] : ['pmr'],
        live: { fr: `Attente estimée ${w} min`, en: `Estimated wait ${w} min` } }
      break
    }
    case 'gate': {
      const f = flights.find((x) => x.gate === p.name)
      d = { subtitle: { fr: 'Porte d’embarquement', en: 'Boarding gate' }, icon: Plane, tone: 'green', stayMin: 0, tags: ['seats', 'usb'],
        live: f ? { fr: `${f.code} vers ${f.city.fr}`, en: `${f.code} to ${f.city.en}` } : { fr: 'Pas de vol de démo à cette porte', en: 'No demo flight at this gate' } }
      break
    }
    default: {
      const tr = TRANSPORT[h % TRANSPORT.length]
      d = { name: undefined, subtitle: tr.label, icon: tr.icon, tone: 'blue', stayMin: 0, tags: ['pmr'] }
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
