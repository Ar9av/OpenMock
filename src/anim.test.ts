import { expect, test } from 'vitest'
import { evaluate, keyframeAt, sample, setAt, shiftTrack, upsertKeyframe } from './anim'
import { defaultShot } from './types'

const kfs = (...pairs: [number, number][]) => pairs.map(([t, value]) => ({ t, value, easing: 'linear' as const }))

test('sample holds before the first and after the last key', () => {
  const t = kfs([1, 10], [3, 30])
  expect(sample(t, 0)).toBe(10)
  expect(sample(t, 9)).toBe(30)
})

test('sample interpolates linearly between keys', () => {
  expect(sample(kfs([0, 0], [2, 100]), 1)).toBe(50)
})

test('sample interpolates vectors component-wise', () => {
  const t = [
    { t: 0, value: [0, 0, 0], easing: 'linear' as const },
    { t: 1, value: [10, 20, 30], easing: 'linear' as const },
  ]
  expect(sample(t, 0.5)).toEqual([5, 10, 15])
})

test('easeInOut is symmetric and hits the midpoint at t=0.5', () => {
  const t = [
    { t: 0, value: 0, easing: 'easeInOut' as const },
    { t: 1, value: 100, easing: 'easeInOut' as const },
  ]
  expect(sample(t, 0.5)).toBeCloseTo(50)
  expect(sample(t, 0.25) as number).toBeLessThan(25)
  expect(sample(t, 0.75) as number).toBeGreaterThan(75)
})

test('setAt writes deep without mutating the source', () => {
  const shot = defaultShot()
  const next = setAt(shot, 'camera.fov', 60)
  expect(next.camera.fov).toBe(60)
  expect(shot.camera.fov).not.toBe(60)
  expect(next.scene).toBe(shot.scene)
})

test('evaluate applies every track at the given time', () => {
  const shot = { ...defaultShot(), tracks: { 'camera.fov': kfs([0, 20], [2, 40]) } }
  expect(evaluate(shot, 1).camera.fov).toBe(30)
  expect(evaluate(shot, 0).camera.fov).toBe(20)
})

test('upsertKeyframe replaces a key at the same time and stays sorted', () => {
  let track = upsertKeyframe(undefined, 1, 5)
  track = upsertKeyframe(track, 0, 1)
  track = upsertKeyframe(track, 1, 9)
  expect(track.map((k) => k.t)).toEqual([0, 1])
  expect(keyframeAt(track, 1)?.value).toBe(9)
})

test('shiftTrack moves the whole animation without changing its shape', () => {
  const track = kfs([0, 10], [1, 30])
  const moved = shiftTrack(track, 10, 25)
  expect(moved.map((k) => k.value)).toEqual([25, 45])
  // The 20-unit spread between the keys survives the shift.
  expect((moved[1].value as number) - (moved[0].value as number)).toBe(20)
})

test('shiftTrack shifts vectors component-wise', () => {
  const track = [
    { t: 0, value: [0, 0, 5], easing: 'linear' as const },
    { t: 1, value: [2, 0, 5], easing: 'linear' as const },
  ]
  const moved = shiftTrack(track, [0, 0, 5], [0, 1, 5])
  expect(moved.map((k) => k.value)).toEqual([
    [0, 1, 5],
    [2, 1, 5],
  ])
})
