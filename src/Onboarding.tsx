import { useState } from 'react'
import { Navigation, Plane, Timer, type LucideIcon } from 'lucide-react'
import type { Lang } from './model'
import { t, type Key } from './i18n'
import { haptic } from './ui'

const SLIDES: { icon: LucideIcon; title: Key; body: Key; tone: string }[] = [
  { icon: Plane, title: 'onb1Title', body: 'onb1Body', tone: 'blue' },
  { icon: Timer, title: 'onb2Title', body: 'onb2Body', tone: 'amber' },
  { icon: Navigation, title: 'onb3Title', body: 'onb3Body', tone: 'green' },
]

export default function Onboarding({ lang, setLang, onDone }: { lang: Lang; setLang: (l: Lang) => void; onDone: () => void }) {
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Sully">
      <div className="onb-top">
        <span className="brand">Sully</span>
        <div className="lang">
          <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>
      <div key={i} className="onb-slide">
        <div className={'onb-art ' + s.tone}><s.icon size={64} strokeWidth={1.6} aria-hidden /></div>
        <h1>{t(lang, s.title)}</h1>
        <p>{t(lang, s.body)}</p>
      </div>
      <div className="onb-dots" aria-hidden>{SLIDES.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</div>
      <div className="onb-actions">
        {!last && <button className="ghost" onClick={onDone}>{t(lang, 'onbSkip')}</button>}
        <button className="primary" onClick={() => { haptic(); if (last) onDone(); else setI(i + 1) }}>{t(lang, last ? 'onbStart' : 'onbNext')}</button>
      </div>
    </div>
  )
}
