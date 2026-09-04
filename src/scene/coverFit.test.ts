import { expect, test } from 'vitest'
import { coverFit } from './coverFit'

const phone = 9 / 19.5

/** What a corner of the display samples, for a centre-anchored texture. */
const sample = (uv: number, repeat: number) => repeat * (uv - 0.5) + 0.5

test('a wide image on a tall phone crops the sides', () => {
  const [rx, ry] = coverFit(16 / 9, phone)
  expect(ry).toBe(1)
  expect(rx).toBeCloseTo(phone / (16 / 9))
})

test('a tall image on a wide screen crops top and bottom', () => {
  const [rx, ry] = coverFit(phone, 16 / 10)
  expect(rx).toBe(1)
  expect(ry).toBeCloseTo(phone / (16 / 10))
})

test('a matching aspect fills the display exactly', () => {
  expect(coverFit(1, 1)).toEqual([1, 1])
  const [rx] = coverFit(1.6, 1.6)
  expect(sample(0, rx)).toBeCloseTo(0)
  expect(sample(1, rx)).toBeCloseTo(1)
})

test('the crop stays centred, taking equal bites from both sides', () => {
  const [rx] = coverFit(16 / 9, phone)
  const left = sample(0, rx)
  const right = sample(1, rx)
  expect(left).toBeCloseTo(1 - right)
  expect(left).toBeGreaterThan(0)
  expect(right).toBeLessThan(1)
})

test('flipping by negating repeat stays inside the texture', () => {
  const [, ry] = coverFit(phone, 16 / 10)
  for (const uv of [0, 0.5, 1]) {
    const v = sample(uv, -ry)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  }
  // A flip mirrors the image without moving it off the display.
  expect(sample(0, -ry)).toBeCloseTo(sample(1, ry))
})
