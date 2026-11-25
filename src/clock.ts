// App clock. In demo mode the presenter can jump ahead in time ("+15 min")
// to show the reminders firing, without waiting for real minutes to pass.
import { useEffect, useState } from 'react'
import { load, save } from './storage'

let offsetMs = load('clockOffset', 0)
const subs = new Set<() => void>()

export const nowMs = () => Date.now() + offsetMs
export function advanceClock(min: number) { offsetMs += min * 60000; save('clockOffset', offsetMs); subs.forEach((f) => f()) }
export function resetClock() { offsetMs = 0; save('clockOffset', 0); subs.forEach((f) => f()) }

/** Current (demo) time, refreshed every `everyMs` and whenever the clock jumps. */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const tick = () => setNow(nowMs())
    const id = window.setInterval(tick, everyMs)
    subs.add(tick)
    return () => { clearInterval(id); subs.delete(tick) }
  }, [everyMs])
  return now
}
