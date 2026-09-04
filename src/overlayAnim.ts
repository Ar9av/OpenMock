import type { AnimStyle, Overlay } from './types'

export interface OverlayTransform {
  opacity: number
  /** Offsets in fractions of the view height, applied on top of the overlay's position. */
  dx: number
  dy: number
  scale: number
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** 0 at the start of the move, 1 once it has fully arrived. */
function styleAt(style: AnimStyle, progress: number, leaving: boolean): OverlayTransform {
  const p = easeOut(clamp01(progress))
  const away = 1 - p
  switch (style) {
    case 'none':
      return { opacity: 1, dx: 0, dy: 0, scale: 1 }
    case 'fade':
      return { opacity: p, dx: 0, dy: 0, scale: 1 }
    case 'slide-up':
      return { opacity: p, dx: 0, dy: -away * 0.08 * (leaving ? -1 : 1), scale: 1 }
    case 'slide-down':
      return { opacity: p, dx: 0, dy: away * 0.08 * (leaving ? -1 : 1), scale: 1 }
    case 'scale':
      return { opacity: p, dx: 0, dy: 0, scale: 1 - away * 0.18 }
  }
}

/**
 * Where an overlay sits at local time `t`, given the shot's length.
 * Enter runs from the overlay's start; exit lands exactly on its end.
 */
export function overlayAt(o: Overlay, t: number, shotDuration: number): OverlayTransform {
  const start = Math.max(0, o.start)
  const end = o.end > start ? Math.min(o.end, shotDuration) : shotDuration
  if (t < start || t > end) return { opacity: 0, dx: 0, dy: 0, scale: 1 }

  const enterDur = Math.max(0, Math.min(o.enterDur, end - start))
  const exitDur = Math.max(0, Math.min(o.exitDur, end - start - enterDur))

  if (enterDur > 0 && t < start + enterDur) return styleAt(o.enter, (t - start) / enterDur, false)
  if (exitDur > 0 && t > end - exitDur) return styleAt(o.exit, (end - t) / exitDur, true)
  return { opacity: 1, dx: 0, dy: 0, scale: 1 }
}
