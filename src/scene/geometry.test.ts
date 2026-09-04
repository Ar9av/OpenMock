import { expect, test } from 'vitest'
import { safeRadius } from './geometry'

test('radius is clamped below half the thinnest dimension', () => {
  // A phone body: 0.09 deep cannot take a 0.09 corner radius.
  expect(safeRadius(0.09, 0.83, 1.7, 0.09)).toBeCloseTo(0.044)
})

test('a radius that already fits is left alone', () => {
  expect(safeRadius(0.015, 2, 1.3, 0.035)).toBe(0.015)
})

test('never returns a negative radius', () => {
  expect(safeRadius(0.5, 0.001)).toBe(0)
})
