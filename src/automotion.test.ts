import { expect, test } from 'vitest'
import { buildMove } from './automotion'
import { evaluate } from './anim'
import { defaultShot, type Shot } from './types'

const shot = (): Shot => ({ ...defaultShot(), duration: 2 })

const distanceAt = (s: Shot, t: number) => {
  const c = evaluate(s, t).camera
  return Math.hypot(c.position[0] - c.target[0], c.position[1] - c.target[1], c.position[2] - c.target[2])
}

const withMove = (move: Parameters<typeof buildMove>[1]) => {
  const s = shot()
  return { ...s, tracks: buildMove(s, move) }
}

test('push in ends closer to the subject than it starts', () => {
  const s = withMove('push-in')
  expect(distanceAt(s, s.duration)).toBeLessThan(distanceAt(s, 0))
})

test('pull back ends further away than it starts', () => {
  const s = withMove('pull-back')
  expect(distanceAt(s, s.duration)).toBeGreaterThan(distanceAt(s, 0))
})

test('push in and pull back are mirror images', () => {
  const inward = withMove('push-in')
  const outward = withMove('pull-back')
  expect(distanceAt(inward, 0)).toBeGreaterThan(distanceAt(inward, inward.duration))
  expect(distanceAt(outward, 0)).toBeLessThan(distanceAt(outward, outward.duration))
})

test('every move lands on the framing the user set up', () => {
  // Orbit is the exception: it sweeps through that framing at its midpoint.
  for (const move of ['push-in', 'slow-zoom', 'reveal'] as const) {
    const base = shot()
    const s = { ...base, tracks: buildMove(base, move) }
    const end = evaluate(s, s.duration).camera
    expect(end.position[0]).toBeCloseTo(base.camera.position[0], 4)
    expect(end.position[1]).toBeCloseTo(base.camera.position[1], 4)
    expect(end.position[2]).toBeCloseTo(base.camera.position[2], 4)
    expect(end.fov).toBeCloseTo(base.camera.fov, 4)
  }
})

test('orbit keeps a constant distance and sweeps through the setup framing', () => {
  const base = shot()
  const s = { ...base, tracks: buildMove(base, 'orbit') }
  const mid = evaluate(s, s.duration / 2).camera
  expect(mid.position[0]).toBeCloseTo(base.camera.position[0], 4)
  expect(mid.position[2]).toBeCloseTo(base.camera.position[2], 4)
  const d0 = distanceAt(s, 0)
  expect(distanceAt(s, s.duration / 2)).toBeCloseTo(d0, 4)
  expect(distanceAt(s, s.duration)).toBeCloseTo(d0, 4)
  // Sweeps one way then the other, not back and forth over the same side.
  const x = [0, s.duration / 2, s.duration].map((t) => evaluate(s, t).camera.position[0])
  expect((x[1] - x[0]) * (x[2] - x[1])).toBeGreaterThan(0)
})

test('slow zoom narrows the field of view', () => {
  const s = withMove('slow-zoom')
  expect(evaluate(s, s.duration).camera.fov).toBeLessThan(evaluate(s, 0).camera.fov)
})

test('reveal rises from below the final framing', () => {
  const s = withMove('reveal')
  expect(evaluate(s, 0).camera.position[1]).toBeLessThan(evaluate(s, s.duration).camera.position[1])
})
