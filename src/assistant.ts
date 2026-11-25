// Flight assistant: from boarding time and the planned route, decide what the
// passenger should do now, and when the next reminder fires.
import { useEffect, useState } from 'react'
import { gates, type Flight, type Plan } from './model'
import { load, save } from './storage'

export type Phase = 'relax' | 'go' | 'hurry' | 'boarding' | 'closed'
export const BUFFER_MIN = 15 // arrive at the gate this long before boarding

export interface Milestones { leaveAt: number; gateBy: number; boardAt: number; closeAt: number }
export function milestones(boardAt: number, plan: Plan): Milestones {
  const gateBy = boardAt - BUFFER_MIN * 60000
  // Leave 10 min earlier than strictly needed: queues vary, and it gives the 'go' advice a real window.
  return { leaveAt: gateBy - (plan.totalMin + 10) * 60000, gateBy, boardAt, closeAt: boardAt + 20 * 60000 }
}
export function phaseAt(now: number, m: Milestones): Phase {
  if (now >= m.closeAt) return 'closed'
  if (now >= m.boardAt) return 'boarding'
  if (now >= m.gateBy - 5 * 60000) return 'hurry'
  if (now >= m.leaveAt) return 'go'
  return 'relax'
}

// --- "My flight": code, boarding time (fixed once, survives reloads), gate changes ---
export interface MyTrip { code: string; boardAt: number; gate?: string; prevGate?: string }

export function useMyTrip() {
  const [trip, setTripState] = useState<MyTrip | null>(() => load<MyTrip | null>('myTrip', null))
  const setTrip = (t: MyTrip | null) => { setTripState(t); save('myTrip', t ?? undefined) }
  return [trip, setTrip] as const
}

/** The flight with its live gate (after a simulated gate change). */
export const withGate = (f: Flight, trip: MyTrip | null): Flight => (trip && trip.code === f.code && trip.gate ? { ...f, gate: trip.gate } : f)

/** Pick another gate in the same terminal, far enough to matter. */
export function newGateFor(f: Flight, current: string): string {
  const here = gates.find((g) => g.name === current)
  const list = gates.filter((g) => g.terminal === f.terminal && g.name !== current)
  if (!list.length || !here) return current
  list.sort((a, b) => Math.hypot(b.x - here.x, b.y - here.y) - Math.hypot(a.x - here.x, a.y - here.y))
  return list[Math.min(2, list.length - 1)].name!
}

/** Browser notification when the phase changes (only if the user allowed it). */
export function notify(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, tag: 'sully-phase' })
  } catch { /* some mobile browsers only allow notifications from a service worker */ }
}

/** Fetch the mock API once to show a "live" badge; the app works without it. */
export function useApiStatus() {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/flights').then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j?.updatedAt) setUpdatedAt(j.updatedAt) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return updatedAt
}
