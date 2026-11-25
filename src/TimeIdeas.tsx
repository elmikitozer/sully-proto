// "I have 40 minutes, what can I do?" Suggestions that fit in the spare time
// before the passenger must head to the gate, from the interview needs
// (sit down and eat, coffee, kids, toilets, ask someone).
import { useMemo, useState } from 'react'
import { ChevronRight, Coffee, Info, Sandwich, ShoppingBag, Soup, Toilet, type LucideIcon } from 'lucide-react'
import { places, walkTimes, type Lang, type Place } from './model'
import type { Pt } from './router'
import { details, openState } from './details'
import { useNow } from './clock'
import { BUFFER_MIN } from './assistant'
import { t, type Key } from './i18n'
import { placeLabel, placeWhere } from './ui'

interface Idea { id: Key; icon: LucideIcon; pick: (p: Place) => boolean; tone: string }
const IDEAS: Idea[] = [
  { id: 'ideaMeal', icon: Soup, tone: 'red', pick: (p) => p.kind === 'restaurant' && p.sub === 'restaurant' },
  { id: 'ideaQuick', icon: Sandwich, tone: 'amber', pick: (p) => p.kind === 'restaurant' && (p.sub === 'fast_food' || p.sub === 'bakery') },
  { id: 'ideaCoffee', icon: Coffee, tone: 'brown', pick: (p) => p.kind === 'restaurant' && p.sub === 'cafe' },
  { id: 'ideaShop', icon: ShoppingBag, tone: 'plum', pick: (p) => p.kind === 'shop' },
  { id: 'ideaToilet', icon: Toilet, tone: 'teal', pick: (p) => p.kind === 'toilet' },
  { id: 'ideaInfo', icon: Info, tone: 'violet', pick: (p) => p.kind === 'info' },
]

export default function TimeIdeas({ lang, boardAt, totalMin, from, gate, onPlace }: { lang: Lang; boardAt: number; totalMin: number; from: Pt; gate: Pt; onPlace: (pid: number) => void }) {
  const now = useNow(15000)
  const free = Math.floor((boardAt - now) / 60000) - totalMin - BUFFER_MIN
  const [what, setWhat] = useState<number | null>(null) // "what if I had…" override
  const minutes = what ?? Math.max(0, free)
  const fromT = useMemo(() => walkTimes(from), [from])
  const gateT = useMemo(() => walkTimes(gate), [gate])
  const direct = useMemo(() => { let best = Infinity; for (const p of places) if (p.kind === 'gate' && Math.hypot(p.x - gate.x, p.y - gate.y) < 1) best = fromT.get(p.pid) ?? best; return isFinite(best) ? best : 0 }, [fromT, gate])
  const list = useMemo(() => IDEAS.map((idea) => {
    let best: { p: Place; detour: number; stay: number } | null = null
    for (const p of places) {
      if (!idea.pick(p)) continue
      const a = fromT.get(p.pid), b = gateT.get(p.pid); if (a == null || b == null) continue
      const d = details(p); const os = openState(d, now, lang); if (os && !os.open) continue
      const detour = Math.max(0, a + b - direct), stay = d.stayMin
      if (!best || detour + stay < best.detour + best.stay) best = { p, detour, stay }
    }
    return best && best.detour + best.stay <= minutes ? { idea, ...best } : null
  }).filter(Boolean) as { idea: Idea; p: Place; detour: number; stay: number }[], [fromT, gateT, direct, minutes, now, lang])

  return (
    <section className="card ideas">
      <div className="ideas-head">
        <div><h3>{t(lang, 'ideasTitle', { n: minutes })}</h3><p className="hint">{t(lang, 'ideasSub')}</p></div>
      </div>
      {list.length === 0 ? <p className="muted">{t(lang, 'ideasNone')}</p> : (
        <ul className="idealist">
          {list.slice(0, 4).map(({ idea, p, detour, stay }) => (
            <li key={idea.id}><button onClick={() => onPlace(p.pid)}>
              <span className={'idea-ico tone-' + idea.tone}><idea.icon size={20} aria-hidden /></span>
              <span className="pl-main"><b>{t(lang, idea.id)} · {placeLabel(p, lang)}</b><span>{t(lang, 'ideasDetour', { s: stay, d: detour })} · {placeWhere(p, lang)}</span></span>
              <ChevronRight size={18} className="chev" aria-hidden />
            </button></li>
          ))}
        </ul>
      )}
      <div className="ideas-if">
        <span className="hint">{t(lang, 'ideasIf')}</span>
        {[15, 30, 60].map((m) => <button key={m} className={what === m ? 'on' : ''} onClick={() => setWhat(what === m ? null : m)}>{m} min</button>)}
      </div>
    </section>
  )
}
