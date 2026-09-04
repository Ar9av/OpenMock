import { beforeEach, expect, test } from 'vitest'
import { shotStart, startHistory, totalDuration, useStore } from './store'
import { defaultProject, defaultShot } from './types'

const reset = () => {
  const project = defaultProject()
  useStore.setState({ project, selectedId: project.shots[0].id, time: 0, past: [], future: [], recording: false })
}
beforeEach(reset)

const s = () => useStore.getState()
const shot0 = () => s().project.shots[0]

test('duplicating a shot inserts a copy right after it and selects it', () => {
  const first = shot0()
  s().duplicateShot(first.id)
  const shots = s().project.shots
  expect(shots).toHaveLength(2)
  expect(shots[1].name).toBe(`${first.name} copy`)
  expect(shots[1].id).not.toBe(first.id)
  expect(s().selectedId).toBe(shots[1].id)
})

test('a duplicated shot is a deep copy, not a shared reference', () => {
  useStore.setState({ project: { ...s().project, shots: [{ ...shot0(), tracks: { 'camera.fov': [{ t: 0, value: 20, easing: 'linear' }] } }] } })
  s().duplicateShot(shot0().id)
  const [a, b] = s().project.shots
  b.tracks['camera.fov'][0].value = 99
  expect(a.tracks['camera.fov'][0].value).toBe(20)
})

test('moving a shot swaps it with its neighbour and stops at the ends', () => {
  s().addShot()
  const [a, b] = s().project.shots
  s().moveShot(b.id, -1)
  expect(s().project.shots.map((x) => x.id)).toEqual([b.id, a.id])
  s().moveShot(b.id, -1) // already first
  expect(s().project.shots.map((x) => x.id)).toEqual([b.id, a.id])
})

test('shot start times follow the order of the shots', () => {
  s().addShot()
  const [a, b] = s().project.shots
  expect(shotStart(s().project, a.id)).toBe(0)
  expect(shotStart(s().project, b.id)).toBe(a.duration)
  expect(totalDuration(s().project)).toBe(a.duration + b.duration)
})

test('the last shot cannot be deleted', () => {
  s().removeShot(shot0().id)
  expect(s().project.shots).toHaveLength(1)
})

test('record off shifts a whole track instead of rewriting one keyframe', () => {
  const withTrack = {
    ...defaultShot(),
    tracks: {
      'camera.fov': [
        { t: 0, value: 20, easing: 'linear' as const },
        { t: 3, value: 40, easing: 'linear' as const },
      ],
    },
  }
  useStore.setState({ project: { ...s().project, shots: [withTrack] }, selectedId: withTrack.id, time: 0 })

  s().setProp('camera.fov', 30) // at t=0 the track reads 20, so this is +10
  const track = shot0().tracks['camera.fov']
  expect(track.map((k) => k.value)).toEqual([30, 50])
})

test('record on writes a keyframe at the playhead', () => {
  useStore.setState({ recording: true, time: 1 })
  s().setProp('camera.fov', 55)
  expect(shot0().tracks['camera.fov']).toEqual([{ t: 1, value: 55, easing: 'easeInOut' }])
})

test('undo and redo walk the project back and forward', () => {
  const stop = startHistory()
  const original = shot0().camera.fov
  s().setProp('camera.fov', 70)
  expect(shot0().camera.fov).toBe(70)

  s().undo()
  expect(shot0().camera.fov).toBe(original)
  s().redo()
  expect(shot0().camera.fov).toBe(70)
  stop()
})

test('undo on an empty history does nothing', () => {
  const before = s().project
  s().undo()
  expect(s().project).toBe(before)
})
