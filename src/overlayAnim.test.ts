import { expect, test } from 'vitest'
import { overlayAt } from './overlayAnim'
import { newTextOverlay, type Overlay } from './types'

const make = (p: Partial<Overlay> = {}): Overlay =>
  ({ ...newTextOverlay(), enter: 'fade', exit: 'fade', enterDur: 1, exitDur: 1, start: 0, end: 0, ...p }) as Overlay

test('an overlay is invisible before it starts', () => {
  expect(overlayAt(make({ start: 2 }), 1, 6).opacity).toBe(0)
})

test('enter runs up to full opacity and exit runs back down', () => {
  const o = make()
  expect(overlayAt(o, 0, 6).opacity).toBe(0)
  expect(overlayAt(o, 1, 6).opacity).toBeCloseTo(1)
  expect(overlayAt(o, 3, 6).opacity).toBe(1)
  expect(overlayAt(o, 6, 6).opacity).toBeCloseTo(0)
})

test('exit lands exactly on the end of the shot', () => {
  const o = make({ exitDur: 2 })
  expect(overlayAt(o, 4, 6).opacity).toBeCloseTo(1)
  expect(overlayAt(o, 5, 6).opacity).toBeGreaterThan(0)
  expect(overlayAt(o, 5, 6).opacity).toBeLessThan(1)
  expect(overlayAt(o, 6, 6).opacity).toBeCloseTo(0)
})

test('an explicit end wins over the shot length', () => {
  const o = make({ end: 3, exitDur: 1 })
  expect(overlayAt(o, 3, 6).opacity).toBeCloseTo(0)
  expect(overlayAt(o, 4, 6).opacity).toBe(0)
})

test('enter and exit cannot overlap into negative time', () => {
  const o = make({ enterDur: 5, exitDur: 5 })
  for (let t = 0; t <= 2; t += 0.25) {
    const a = overlayAt(o, t, 2).opacity
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(1)
  }
})

test('slide up enters from below and settles at rest', () => {
  const o = make({ enter: 'slide-up' })
  expect(overlayAt(o, 0.01, 6).dy).toBeLessThan(0)
  expect(overlayAt(o, 1, 6).dy).toBeCloseTo(0)
})

test('none style is fully visible for the whole run', () => {
  const o = make({ enter: 'none', exit: 'none' })
  expect(overlayAt(o, 0, 6).opacity).toBe(1)
  expect(overlayAt(o, 6, 6).opacity).toBe(1)
})
