import { expect, test } from 'vitest'
import { classifyMedia } from './media'

const file = (name: string, type = '') => new File([new Uint8Array([0])], name, { type })

test('a proper MIME type is trusted', () => {
  expect(classifyMedia(file('a.mp4', 'video/mp4'))).toBe('video')
  expect(classifyMedia(file('a.png', 'image/png'))).toBe('image')
})

test('a file with no MIME type falls back to its extension', () => {
  // Files dragged out of some apps and archives arrive with an empty type.
  expect(classifyMedia(file('screen-recording.mov'))).toBe('video')
  expect(classifyMedia(file('clip.MKV'))).toBe('video')
  expect(classifyMedia(file('shot.PNG'))).toBe('image')
})

test('a macOS screen recording is recognised either way', () => {
  expect(classifyMedia(file('Screen Recording.mov', 'video/quicktime'))).toBe('video')
  expect(classifyMedia(file('Screen Recording.mov'))).toBe('video')
})

test('anything else is rejected so the caller can say why', () => {
  expect(classifyMedia(file('notes.pdf', 'application/pdf'))).toBeNull()
  expect(classifyMedia(file('archive.zip'))).toBeNull()
  expect(classifyMedia(file('no-extension'))).toBeNull()
})
