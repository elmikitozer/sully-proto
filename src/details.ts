// Demo details for each place: names, opening hours, features, offers.
// ALL FICTIONAL. The ADP plan only gives a pictogram per place (no names,
// no hours). A real version would read the airport's retail database.
import { Accessibility, Armchair, Baby, Beef, Coffee, Croissant, CupSoda, Fish, IceCreamCone, Info, Languages, Pizza, Plane, PlugZap, Salad, Sandwich, ShieldCheck, Soup, Sparkles, Toilet, TrainFront, Bus, CarTaxiFront, Wine, Leaf, ShoppingBag, type LucideIcon } from 'lucide-react'
import { flights, waitMin, checkpoints, type Lang, type Place } from './model'

type L = { fr: string; en: string }
const hash = (n: number) => { let x = (n + 1) * 2654435761; x = (x ^ (x >>> 13)) >>> 0; return x }

interface Food { name: string; type: L; icon: LucideIcon; price: 1 | 2 | 3; min: number; tags: TagId[]; tone: string }
const FOOD: Food[] = [
  { name: 'Café Envol', type: { fr: 'Café', en: 'Coffee shop' }, icon: Coffee, price: 1, min: 10, tags: ['seats', 'usb'], tone: 'brown' },
  { name: 'Boulangerie du Tarmac', type: { fr: 'Boulangerie', en: 'Bakery' }, icon: Croissant, price: 1, min: 8, tags: ['takeaway', 'kids'], tone: 'amber' },
  { name: 'Bistrot Altitude', type: { fr: 'Bistrot', en: 'Bistro' }, icon: Soup, price: 3, min: 35, tags: ['seats', 'veggie'], tone: 'red' },
  { name: 'Escale Sushi', type: { fr: 'Japonais', en: 'Japanese' }, icon: Fish, price: 2, min: 20, tags: ['seats'], tone: 'rose' },
  { name: 'Green Bowl', type: { fr: 'Healthy', en: 'Healthy' }, icon: Salad, price: 2, min: 15, tags: ['veggie', 'takeaway'], tone: 'green' },
  { name: 'Piste Pizza', type: { fr: 'Pizzeria', en: 'Pizza' }, icon: Pizza, price: 2, min: 20, tags: ['kids', 'seats'], tone: 'orange' },
  { name: 'Le Comptoir d’Orly', type: { fr: 'Brasserie', en: 'Brasserie' }, icon: Beef, price: 3, min: 40, tags: ['seats', 'kids'], tone: 'red' },
  { name: 'Bar Terminal', type: { fr: 'Bar à vin', en: 'Wine bar' }, icon: Wine, price: 2, min: 20, tags: ['seats', 'usb'], tone: 'plum' },
  { name: 'Le Petit Sandwich', type: { fr: 'Sandwicherie', en: 'Sandwiches' }, icon: Sandwich, price: 1, min: 8, tags: ['takeaway'], tone: 'amber' },
  { name: 'Glacier Nuage', type: { fr: 'Glacier', en: 'Ice cream' }, icon: IceCreamCone, price: 1, min: 8, tags: ['kids', 'takeaway'], tone: 'sky' },
  { name: 'Juice Lab', type: { fr: 'Jus & smoothies', en: 'Juice bar' }, icon: CupSoda, price: 1, min: 6, tags: ['veggie', 'takeaway'], tone: 'green' },
]
const OFFERS: L[] = [
  { fr: '-15 % sur le menu', en: '15% off the set menu' },
  { fr: 'Café offert avec une viennoiserie', en: 'Free coffee with a pastry' },
  { fr: '2e boisson à -50 %', en: 'Second drink half price' },
  { fr: 'Menu enfant offert', en: 'Free kids’ menu' },
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
      const f = FOOD[h % FOOD.length]
      const early = h % 3 === 0
      d = { name: f.name, subtitle: f.type, icon: f.icon, tone: f.tone, hours: [early ? 300 : 360, h % 5 === 0 ? 1290 : 1350], price: f.price, stayMin: f.min, tags: f.tags,
        offer: h % 4 === 1 ? { text: OFFERS[(h >>> 3) % OFFERS.length], code: `SULLY-${(p.pid * 37 % 9000) + 1000}` } : undefined }
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
