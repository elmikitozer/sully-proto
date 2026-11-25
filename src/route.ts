// URL <-> screen. Every screen has its own address, so reload, share and the
// browser back button all work:
//   /                                    home (Trip tab)
//   /explore?c=toilet                    Explore tab
//   /my-flight                           My flight tab
//   /flight/SL1204?from=m14&stop=toilet  trip overview
//   /flight/SL1204/go?from=m14           step-by-step guidance to the gate
//   /place/123?from=m14                  one place, with its route
//   /place/123/go?from=m14               guidance to that place
import { useCallback, useEffect, useState } from 'react'
import type { PlaceKind, StopKind } from './model'

export type Screen = 'home' | 'explore' | 'myflight' | 'trip' | 'nav' | 'place' | 'placeNav'
export type Tab = 'home' | 'explore' | 'myflight'
export interface Route { screen: Screen; code?: string; pid?: number; from?: string; stop?: StopKind; cat?: PlaceKind }

// Depth drives the slide direction: tabs are level 0, details 1, guidance 2.
const DEPTH: Record<Screen, number> = { home: 0, explore: 0, myflight: 0, trip: 1, place: 1, nav: 2, placeNav: 2 }
const STOPS: StopKind[] = ['restaurant', 'toilet', 'info']
const CATS: PlaceKind[] = ['toilet', 'restaurant', 'info', 'gate', 'security']

export const tabOf = (s: Screen): Tab => (s === 'explore' || s === 'place' || s === 'placeNav' ? 'explore' : s === 'myflight' ? 'myflight' : 'home')

export function parse(loc: { pathname: string; search: string }): Route {
  const q = new URLSearchParams(loc.search)
  const from = q.get('from') ?? undefined
  const path = loc.pathname.replace(/\/+$/, '') || '/'
  if (path === '/explore') {
    const c = q.get('c') as PlaceKind | null
    return { screen: 'explore', from, cat: c && CATS.includes(c) ? c : undefined }
  }
  if (path === '/my-flight') return { screen: 'myflight' }
  const pl = path.match(/^\/place\/(\d+)(\/go)?$/)
  if (pl) return { screen: pl[2] ? 'placeNav' : 'place', pid: Number(pl[1]), from }
  const m = path.match(/^\/flight\/([^/]+)(\/go)?$/i)
  if (!m) return { screen: 'home' }
  const stop = q.get('stop') as StopKind | null
  return {
    screen: m[2] ? 'nav' : 'trip',
    code: decodeURIComponent(m[1]).toUpperCase(),
    from,
    stop: stop && STOPS.includes(stop) ? stop : undefined,
  }
}

export function href(r: Route): string {
  const q = new URLSearchParams()
  if (r.from && r.screen !== 'myflight' && r.screen !== 'home') q.set('from', r.from)
  if (r.stop && (r.screen === 'trip' || r.screen === 'nav')) q.set('stop', r.stop)
  if (r.cat && r.screen === 'explore') q.set('c', r.cat)
  const qs = q.toString() ? '?' + q.toString() : ''
  switch (r.screen) {
    case 'explore': return '/explore' + qs
    case 'myflight': return '/my-flight'
    case 'place': case 'placeNav': return r.pid == null ? '/explore' : `/place/${r.pid}${r.screen === 'placeNav' ? '/go' : ''}${qs}`
    case 'trip': case 'nav': return r.code ? `/flight/${encodeURIComponent(r.code.replace(/\s+/g, ''))}${r.screen === 'nav' ? '/go' : ''}${qs}` : '/'
    default: return '/'
  }
}

/** Current route + navigate(). `dir` tells the screen transition which way to slide. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location))
  const [dir, setDir] = useState<'fwd' | 'back' | 'tab'>('fwd')
  const dirOf = (a: Screen, b: Screen) => (DEPTH[a] === 0 && DEPTH[b] === 0 ? 'tab' : DEPTH[b] >= DEPTH[a] ? 'fwd' : 'back')

  useEffect(() => {
    const onPop = () => {
      const next = parse(window.location)
      setRoute((prev) => { setDir(dirOf(prev.screen, next.screen)); return next })
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
      if (prev.screen !== next.screen) setDir(dirOf(prev.screen, next.screen))
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
