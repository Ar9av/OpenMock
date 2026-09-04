import { expect, test } from 'vitest'
import { migrateProject } from './persist'
import { defaultProject, type Project } from './types'

/** A project saved before effects, names, or the export block existed. */
const legacy = {
  id: 'x',
  name: 'Old',
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  shots: [{ id: 's1', duration: 4, source: null, camera: { fov: 50 } }],
} as unknown as Project

test('a project saved before effects existed still loads', () => {
  const p = migrateProject(legacy)
  expect(p.shots[0].effects).toBeDefined()
  expect(p.shots[0].effects.bloom).toBe(0)
  expect(p.shots[0].scene.envPreset).toBeDefined()
  expect(p.shots[0].tracks).toEqual({})
  expect(p.export.aspect).toBe('16:9')
})

test('migration keeps the values that were saved', () => {
  const p = migrateProject(legacy)
  expect(p.name).toBe('Old')
  expect(p.shots[0].duration).toBe(4)
  expect(p.shots[0].camera.fov).toBe(50)
  // Missing camera fields fall back instead of becoming undefined.
  expect(p.shots[0].camera.position).toHaveLength(3)
})

test('a project with no shots gets one', () => {
  const p = migrateProject({ ...legacy, shots: [] } as Project)
  expect(p.shots).toHaveLength(1)
})

test('a current project survives migration unchanged in shape', () => {
  const p = migrateProject(defaultProject())
  expect(Object.keys(p.shots[0]).sort()).toEqual(Object.keys(defaultProject().shots[0]).sort())
})
