import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test } from 'vitest'
import { DEVICES, deviceAspect, finishOf } from './devices'

/** Reads the JSON chunk out of a binary glTF container. */
function readGlbJson(path: string) {
  const buf = readFileSync(path)
  expect(buf.toString('utf8', 0, 4)).toBe('glTF')
  const chunkLength = buf.readUInt32LE(12)
  const chunkType = buf.readUInt32LE(16)
  expect(chunkType).toBe(0x4e4f534a) // 'JSON'
  return JSON.parse(buf.toString('utf8', 20, 20 + chunkLength)) as {
    meshes?: { name?: string; primitives: { material?: number }[] }[]
    materials?: { name?: string }[]
  }
}

const modelPath = (file: string) => resolve(process.cwd(), 'public', file)
const shipped = Object.values(DEVICES).filter((d) => existsSync(modelPath(d.file)))

test('at least one real model is shipped', () => {
  expect(shipped.length).toBeGreaterThan(0)
})

test.each(shipped.map((d) => [d.label, d] as const))(
  '%s: exactly one material is the screen, and the housing is addressable',
  (_label, def) => {
    const gltf = readGlbJson(modelPath(def.file))
    const names = (gltf.materials ?? []).map((m) => m.name ?? '')
    expect(names.length).toBeGreaterThan(0)

    // A model is only usable if its display can be singled out. Matching more than
    // one material would texture the housing too.
    const screens = names.filter((n) => def.screenMesh.test(n))
    expect(screens, `screenMesh ${def.screenMesh} against ${names.join(', ')}`).toHaveLength(1)

    const bodies = names.filter((n) => def.bodyMesh.test(n))
    expect(bodies.length, `bodyMesh ${def.bodyMesh} against ${names.join(', ')}`).toBeGreaterThan(0)
    expect(screens[0]).not.toBe(bodies[0])
  },
)

test.each(Object.values(DEVICES).map((d) => [d.label, d] as const))('%s has a coherent definition', (_label, def) => {
  expect(deviceAspect(def)).toBeGreaterThan(0.3)
  expect(deviceAspect(def)).toBeLessThan(3)
  expect(Object.keys(def.finishes).length).toBeGreaterThan(0)
  // An unknown finish key must still resolve, since shots carry finishes across devices.
  expect(finishOf(def, 'no-such-finish')).toBeDefined()
  expect(finishOf(def, 'no-such-finish').color).toMatch(/^#[0-9a-f]{6}$/i)
})
