// Watches the clock and pops an in-app banner (plus a system notification when
// allowed) each time the assistant's advice changes, or the gate changes.
import { useEffect, useRef, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { milestones, notify, phaseAt, type MyTrip, type Phase } from './assistant'
import { useNow } from './clock'
import type { Flight, Lang, Plan } from './model'
import { phaseText } from './screens/MyFlight'
import { t } from './i18n'

export default function AssistantToasts({ lang, flight, plan, trip, onOpen }: { lang: Lang; flight: Flight | null; plan: Plan | null; trip: MyTrip | null; onOpen: () => void }) {
  const now = useNow(1000)
  const phase: Phase | null = flight && plan && trip ? phaseAt(now, milestones(trip.boardAt, plan)) : null
  const last = useRef<{ code?: string; phase: Phase | null; gate?: string }>({ code: trip?.code, phase, gate: flight?.gate })
  const [toast, setToast] = useState<{ title: string; body: string; id: number } | null>(null)

  useEffect(() => {
    const prev = last.current
    last.current = { code: trip?.code, phase, gate: flight?.gate }
    if (!flight || !plan || !trip || prev.code !== trip.code) return // new flight: no alert for the initial state
    let title = '', body = ''
    if (prev.gate && prev.gate !== flight.gate) { title = t(lang, 'gateChanged', { a: prev.gate, b: flight.gate }); body = t(lang, 'gateChangedBody', { n: plan.totalMin }) }
    else if (prev.phase !== phase && phase) { title = `${flight.code} · ${t(lang, 'assistant')}`; body = phaseText(phase, lang, flight, plan, trip.boardAt) }
    if (!title) return
    setToast({ title, body, id: Date.now() })
    notify(title, body)
    try { navigator.vibrate?.([30, 60, 30]) } catch { /* no vibration */ }
  }, [phase, flight, plan, trip, lang])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast])

  if (!toast) return null
  return (
    <div key={toast.id} className="toast" role="status" aria-live="assertive">
      <button className="toast-body" onClick={() => { setToast(null); onOpen() }}>
        <span className="toast-ico"><BellRing size={18} aria-hidden /></span>
        <span><b>{toast.title}</b><span>{toast.body}</span></span>
      </button>
      <button className="toast-x" onClick={() => setToast(null)} aria-label={t(lang, 'gotIt')}><X size={16} /></button>
    </div>
  )
}
