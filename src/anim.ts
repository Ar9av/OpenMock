import type { Easing, Keyframe, Shot } from './types'

const EASE: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
}

export const getAt = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj)

/** Immutable deep set: returns a copy of obj with path replaced. */
export function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const src = obj as Record<string, unknown>
  return { ...src, [head]: rest.length ? setAt(src[head], rest.join('.'), value) : value } as T
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Value of a track at local time t. Holds at the ends, no extrapolation. */
export function sample(kfs: Keyframe[], t: number): number | number[] | undefined {
  if (!kfs.length) return undefined
  if (t <= kfs[0].t) return kfs[0].value
  if (t >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].value
  const i = kfs.findIndex((k) => k.t > t)
  const a = kfs[i - 1]
  const b = kfs[i]
  const raw = (t - a.t) / (b.t - a.t)
  const e = EASE[b.easing ?? 'easeInOut'](raw)
  if (Array.isArray(a.value) && Array.isArray(b.value)) return a.value.map((v, j) => lerp(v, (b.value as number[])[j], e))
  return lerp(a.value as number, b.value as number, e)
}

/** The shot as it looks at local time t, with every track applied. */
export function evaluate(shot: Shot, t: number): Shot {
  let out = shot
  for (const [path, kfs] of Object.entries(shot.tracks)) {
    const v = sample(kfs, t)
    if (v !== undefined) out = setAt(out, path, v)
  }
  return out
}

export const KEY_EPSILON = 1 / 60

export function keyframeAt(kfs: Keyframe[] | undefined, t: number) {
  return kfs?.find((k) => Math.abs(k.t - t) < KEY_EPSILON)
}

/** Insert or replace a keyframe, keeping the track sorted by time. */
export function upsertKeyframe(kfs: Keyframe[] | undefined, t: number, value: number | number[]): Keyframe[] {
  const rest = (kfs ?? []).filter((k) => Math.abs(k.t - t) >= KEY_EPSILON)
  return [...rest, { t, value, easing: 'easeInOut' as const }].sort((a, b) => a.t - b.t)
}

/**
 * Moves an entire track by the difference between `from` and `to`, preserving
 * the shape of the animation. This is what reframing an animated property does
 * when Record is off: the whole move follows the edit instead of one end of it
 * silently changing, which would play back as a move toward the old framing.
 */
export function shiftTrack(kfs: Keyframe[], from: number | number[], to: number | number[]): Keyframe[] {
  if (Array.isArray(from) && Array.isArray(to)) {
    const d = to.map((v, i) => v - from[i])
    return kfs.map((k) => ({ ...k, value: (k.value as number[]).map((v, i) => v + d[i]) }))
  }
  const d = (to as number) - (from as number)
  return kfs.map((k) => ({ ...k, value: (k.value as number) + d }))
}
