// Shared motion tokens. Curves mirror --ease-out / --ease-in-out in index.css.

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Cubic-bezier solver (same maths as CSS), so JS-driven motion uses the exact CSS curves.
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x
      if (Math.abs(e) < 1e-5) break
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0, hi = 1
    for (let i = 0; i < 20 && Math.abs(sx(t) - x) > 1e-5; i++) {
      if (sx(t) < x) lo = t; else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}

export const easeOut = bezier(0.23, 1, 0.32, 1)
export const easeInOut = bezier(0.77, 0, 0.175, 1)
