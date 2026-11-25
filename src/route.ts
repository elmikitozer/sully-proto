// URL <-> screen. Every screen has its own address, so reload, share and the
// browser back button all work:
//   /                                  home
//   /flight/SL1204?from=m14&stop=toilet  trip overview
//   /flight/SL1204/go?from=m14           step-by-step guidance
import { useCallback, useEffect, useState } from 'react'
import type { StopKind } from './model'

export type Screen = 'home' | 'trip' | 'nav'
export interface Route { screen: Screen; code?: string; from?: string; stop?: StopKind }

const ORDER: Screen[] = ['home', 'trip', 'nav']
const STOPS: StopKind[] = ['restaurant', 'toilet', 'info']

export function parse(loc: { pathname: string; search: string }): Route {
  const q = new URLSearchParams(loc.search)
  const m = loc.pathname.match(/^\/flight\/([^/]+)(\/go)?\/?$/i)
  if (!m) return { screen: 'home' }
  const stop = q.get('stop') as StopKind | null
  return {
    screen: m[2] ? 'nav' : 'trip',
    code: decodeURIComponent(m[1]).toUpperCase(),
    from: q.get('from') ?? undefined,
    stop: stop && STOPS.includes(stop) ? stop : undefined,
  }
}

export function href(r: Route): string {
  if (r.screen === 'home' || !r.code) return '/'
  const q = new URLSearchParams()
  if (r.from) q.set('from', r.from)
  if (r.stop) q.set('stop', r.stop)
  const qs = q.toString()
  return `/flight/${encodeURIComponent(r.code.replace(/\s+/g, ''))}${r.screen === 'nav' ? '/go' : ''}${qs ? '?' + qs : ''}`
}

export const sameCode = (a?: string, b?: string) => !!a && !!b && a.replace(/\s+/g, '').toUpperCase() === b.replace(/\s+/g, '').toUpperCase()

/** Current route + navigate(). `dir` tells the screen transition which way to slide. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location))
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')

  useEffect(() => {
    const onPop = () => {
      const next = parse(window.location)
      setRoute((prev) => {
        setDir(ORDER.indexOf(next.screen) >= ORDER.indexOf(prev.screen) ? 'fwd' : 'back')
        return next
      })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((next: Route, opts: { replace?: boolean } = {}) => {
    const url = href(next)
    // Entries we push are tagged, so back() knows an in-app page sits behind them.
    if (opts.replace) window.history.replaceState(window.history.state, '', url)
    else window.history.pushState({ sully: true }, '', url)
    setRoute((prev) => {
      if (prev.screen !== next.screen) setDir(ORDER.indexOf(next.screen) >= ORDER.indexOf(prev.screen) ? 'fwd' : 'back')
      return next
    })
    if (!opts.replace) window.scrollTo(0, 0)
  }, [])

  /** In-app back: pop history when we pushed this entry, else go to `parent` (deep link). */
  const back = useCallback((parent: Route) => {
    if (window.history.state?.sully) window.history.back()
    else navigate(parent, { replace: true })
  }, [navigate])

  return { route, dir, navigate, back }
}
