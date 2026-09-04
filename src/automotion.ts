import type { Keyframe, Shot } from './types'

type Vec3 = [number, number, number]

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/** Spherical coordinates of `pos` around `target`. */
function toSpherical(pos: Vec3, target: Vec3) {
  const [x, y, z] = sub(pos, target)
  const radius = Math.hypot(x, y, z) || 1
  return { radius, azimuth: Math.atan2(x, z), polar: Math.acos(Math.min(1, Math.max(-1, y / radius))) }
}

function fromSpherical(radius: number, azimuth: number, polar: number, target: Vec3): Vec3 {
  const sp = Math.sin(polar)
  return add([radius * sp * Math.sin(azimuth), radius * Math.cos(polar), radius * sp * Math.cos(azimuth)], target)
}

export type MoveId = 'push-in' | 'pull-back' | 'orbit' | 'slow-zoom' | 'reveal'

export const MOVES: { id: MoveId; label: string }[] = [
  { id: 'push-in', label: 'Push In' },
  { id: 'pull-back', label: 'Pull Back' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'slow-zoom', label: 'Slow Zoom' },
  { id: 'reveal', label: 'Reveal' },
]

const key = (t: number, value: number | number[]): Keyframe => ({ t, value, easing: 'easeInOut' })

/**
 * Builds camera keyframes for a canned move, using the shot's current framing as
 * the anchor so the result always ends (or passes through) what the user set up.
 */
export function buildMove(shot: Shot, move: MoveId): Record<string, Keyframe[]> {
  const end = shot.duration
  const target = shot.camera.target
  const { radius, azimuth, polar } = toSpherical(shot.camera.position, target)

  switch (move) {
    case 'push-in':
      return { 'camera.position': [key(0, fromSpherical(radius * 1.45, azimuth, polar, target)), key(end, shot.camera.position)] }
    case 'pull-back':
      return { 'camera.position': [key(0, shot.camera.position), key(end, fromSpherical(radius * 1.5, azimuth, polar, target))] }
    case 'orbit':
      return {
        'camera.position': [
          key(0, fromSpherical(radius, azimuth - 0.45, polar, target)),
          key(end / 2, shot.camera.position),
          key(end, fromSpherical(radius, azimuth + 0.45, polar, target)),
        ],
      }
    case 'slow-zoom':
      return { 'camera.fov': [key(0, Math.min(90, shot.camera.fov * 1.35)), key(end, shot.camera.fov)] }
    case 'reveal':
      return {
        'camera.position': [
          key(0, fromSpherical(radius * 1.3, azimuth - 0.6, Math.min(Math.PI - 0.1, polar + 0.35), target)),
          key(end, shot.camera.position),
        ],
        'camera.fov': [key(0, Math.min(90, shot.camera.fov * 1.15)), key(end, shot.camera.fov)],
      }
  }
}

/**
 * Auto-motion: picks a move that suits the shot instead of asking the user to
 * keyframe by hand. Portrait devices get an orbit, wide ones a push-in.
 */
export function autoMotion(shot: Shot): Record<string, Keyframe[]> {
  const has = Object.keys(shot.tracks).length > 0
  if (has) return buildMove(shot, 'orbit')
  return buildMove(shot, shot.device.model.startsWith('iphone') ? 'reveal' : 'push-in')
}
