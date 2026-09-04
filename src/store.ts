import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { evaluate, getAt, keyframeAt, setAt, shiftTrack, upsertKeyframe } from './anim'
import { defaultProject, defaultShot, uid, type Camera, type ExportSettings, type Keyframe, type Project, type Shot } from './types'

interface State {
  project: Project
  /** Global playhead in seconds across all shots. */
  time: number
  playing: boolean
  /** When on, editing a tracked property writes a keyframe instead of the base value. */
  recording: boolean
  selectedId: string
  expanded: Record<string, boolean>
  past: Project[]
  future: Project[]
  /** Set when the browser cannot decode the loaded media, so the UI can say why. */
  mediaError: string | null

  setProject: (p: Project) => void
  setMediaError: (m: string | null) => void
  undo: () => void
  redo: () => void
  patchExport: (patch: Partial<ExportSettings>) => void

  setTime: (t: number) => void
  setPlaying: (p: boolean) => void
  setRecording: (r: boolean) => void
  select: (id: string) => void
  toggleExpanded: (id: string) => void

  updateShot: (id: string, fn: (s: Shot) => Shot) => void
  addShot: () => void
  removeShot: (id: string) => void
  duplicateShot: (id: string) => void
  moveShot: (id: string, delta: number) => void
  /** Edits a property, routing to a keyframe when the track is animated or recording is on. */
  setProp: (path: string, value: unknown) => void
  applyCameraMove: (tracks: Record<string, Keyframe[]>, camera: Camera) => void
  toggleKeyframe: (path: string) => void
  removeKeyframe: (path: string, t: number) => void
  clearTrack: (path: string) => void
}

export const totalDuration = (p: Project) => p.shots.reduce((n, s) => n + s.duration, 0)

export const shotStart = (p: Project, id: string) => {
  let n = 0
  for (const s of p.shots) {
    if (s.id === id) break
    n += s.duration
  }
  return n
}

/** The shot under the playhead, clamped to the last shot at the very end. */
export const shotAtTime = (p: Project, t: number) => {
  let n = 0
  for (const s of p.shots) {
    if (t < n + s.duration) return s
    n += s.duration
  }
  return p.shots[p.shots.length - 1]
}

export const useStore = create<State>((set, get) => ({
  project: defaultProject(),
  time: 0,
  playing: false,
  recording: false,
  selectedId: '',
  expanded: {},
  past: [],
  future: [],
  mediaError: null,

  setProject: (project) => set({ project, selectedId: project.shots[0]?.id ?? '', time: 0 }),
  setMediaError: (mediaError) => set({ mediaError }),

  undo: () =>
    set(({ past, future, project, selectedId }) => {
      const prev = past[past.length - 1]
      if (!prev) return {}
      return {
        past: past.slice(0, -1),
        future: [...future, project],
        project: prev,
        selectedId: prev.shots.some((s) => s.id === selectedId) ? selectedId : prev.shots[0].id,
      }
    }),

  redo: () =>
    set(({ past, future, project, selectedId }) => {
      const next = future[future.length - 1]
      if (!next) return {}
      return {
        past: [...past, project],
        future: future.slice(0, -1),
        project: next,
        selectedId: next.shots.some((s) => s.id === selectedId) ? selectedId : next.shots[0].id,
      }
    }),
  patchExport: (patch) => set(({ project }) => ({ project: { ...project, export: { ...project.export, ...patch } } })),

  setTime: (t) => {
    const { project } = get()
    const time = Math.max(0, Math.min(t, totalDuration(project)))
    set({ time, selectedId: shotAtTime(project, time).id })
  },
  setPlaying: (playing) => set({ playing }),
  setRecording: (recording) => set({ recording }),
  select: (id) => {
    const { project } = get()
    set({ selectedId: id, time: shotStart(project, id) })
  },
  toggleExpanded: (id) => set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),

  updateShot: (id, fn) =>
    set(({ project }) => ({
      project: { ...project, updatedAt: Date.now(), shots: project.shots.map((s) => (s.id === id ? fn(s) : s)) },
    })),

  addShot: () =>
    set(({ project }) => {
      const shot = { ...defaultShot(`Shot ${project.shots.length + 1}`), id: uid() }
      return { project: { ...project, shots: [...project.shots, shot] }, selectedId: shot.id }
    }),

  duplicateShot: (id) =>
    set(({ project }) => {
      const i = project.shots.findIndex((s) => s.id === id)
      if (i < 0) return {}
      const copy: Shot = {
        ...structuredClone(project.shots[i]),
        id: uid(),
        name: `${project.shots[i].name} copy`,
      }
      const shots = [...project.shots.slice(0, i + 1), copy, ...project.shots.slice(i + 1)]
      return { project: { ...project, shots, updatedAt: Date.now() }, selectedId: copy.id }
    }),

  moveShot: (id, delta) =>
    set(({ project }) => {
      const i = project.shots.findIndex((s) => s.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= project.shots.length) return {}
      const shots = [...project.shots]
      ;[shots[i], shots[j]] = [shots[j], shots[i]]
      return { project: { ...project, shots, updatedAt: Date.now() } }
    }),

  removeShot: (id) =>
    set(({ project, selectedId }) => {
      if (project.shots.length === 1) return {}
      const shots = project.shots.filter((s) => s.id !== id)
      return { project: { ...project, shots }, selectedId: selectedId === id ? shots[0].id : selectedId }
    }),

  /**
   * Record on: every edit becomes a keyframe at the playhead.
   * Record off on an animated property: the whole track shifts with the edit, so
   * reframing moves the entire animation rather than rewriting one end of it.
   * Otherwise: plain base value.
   */
  setProp: (path, value) => {
    const { project, recording, selectedId } = get()
    const shot = project.shots.find((s) => s.id === selectedId) ?? project.shots[0]
    const local = get().time - shotStart(project, shot.id)
    const track = shot.tracks[path]

    if (recording && (typeof value === 'number' || Array.isArray(value))) {
      get().updateShot(shot.id, (s) => ({
        ...s,
        tracks: { ...s.tracks, [path]: upsertKeyframe(s.tracks[path], local, value as number | number[]) },
      }))
      return
    }

    if (track?.length && (typeof value === 'number' || Array.isArray(value))) {
      const current = getAt(evaluate(shot, local), path) as number | number[]
      get().updateShot(shot.id, (s) => ({
        ...setAt(s, path, value),
        tracks: { ...s.tracks, [path]: shiftTrack(s.tracks[path], current, value as number | number[]) },
      }))
      return
    }

    get().updateShot(shot.id, (s) => setAt(s, path, value))
  },

  /** Replaces the camera animation with a canned move, anchored on what is on screen now. */
  applyCameraMove: (tracks, camera) =>
    set(({ project, selectedId }) => ({
      project: {
        ...project,
        updatedAt: Date.now(),
        shots: project.shots.map((s) =>
          s.id !== selectedId
            ? s
            : {
                ...s,
                camera,
                tracks: {
                  ...Object.fromEntries(Object.entries(s.tracks).filter(([p]) => !p.startsWith('camera.'))),
                  ...tracks,
                },
              },
        ),
      },
    })),

  toggleKeyframe: (path) => {
    const { project, selectedId } = get()
    const shot = project.shots.find((s) => s.id === selectedId) ?? project.shots[0]
    const local = get().time - shotStart(project, shot.id)
    const evaluated = evaluate(shot, local)
    get().updateShot(shot.id, (s) => {
      const existing = keyframeAt(s.tracks[path], local)
      if (existing) {
        const kfs = s.tracks[path].filter((k) => k !== existing)
        const tracks = { ...s.tracks }
        if (kfs.length) tracks[path] = kfs
        else delete tracks[path]
        return { ...s, tracks }
      }
      const value = getAt(evaluated, path) as number | number[]
      return { ...s, tracks: { ...s.tracks, [path]: upsertKeyframe(s.tracks[path], local, value) } }
    })
  },

  removeKeyframe: (path, t) =>
    get().updateShot(get().selectedId, (s) => {
      const kfs = (s.tracks[path] ?? []).filter((k) => k.t !== t)
      const tracks = { ...s.tracks }
      if (kfs.length) tracks[path] = kfs
      else delete tracks[path]
      return { ...s, tracks }
    }),

  clearTrack: (path) =>
    get().updateShot(get().selectedId, (s) => {
      const tracks = { ...s.tracks }
      delete tracks[path]
      return { ...s, tracks }
    }),
}))

/** The selected shot as authored (base values, tracks intact). */
export function useShot(): Shot {
  return useStore((s) => s.project.shots.find((x) => x.id === s.selectedId) ?? s.project.shots[0])
}

/** Local playhead time inside the selected shot. */
export function useLocalTime(): number {
  return useStore((s) => {
    const shot = s.project.shots.find((x) => x.id === s.selectedId) ?? s.project.shots[0]
    return Math.max(0, s.time - shotStart(s.project, shot.id))
  })
}

/** The selected shot with all keyframes applied at the current playhead — what renders. */
export function useAnimatedShot(): Shot {
  const { shot, local } = useStore(
    useShallow((s) => {
      const shot = s.project.shots.find((x) => x.id === s.selectedId) ?? s.project.shots[0]
      return { shot, local: Math.max(0, s.time - shotStart(s.project, shot.id)) }
    }),
  )
  return evaluate(shot, local)
}

const HISTORY_LIMIT = 60
/** Edits closer together than this collapse into one undo step, so dragging a slider is undone in one go. */
const COALESCE_MS = 450

/**
 * Records project history by watching the store rather than wrapping every action,
 * so any future action gets undo for free.
 */
export function startHistory() {
  let last = 0
  return useStore.subscribe((s, prev) => {
    if (s.project === prev.project) return
    // Undo and redo swap the project themselves; recording those would fight them.
    if (s.past !== prev.past || s.future !== prev.future) return
    const now = Date.now()
    const coalesce = now - last < COALESCE_MS && prev.past.length > 0
    last = now
    if (coalesce) {
      useStore.setState({ future: [] })
      return
    }
    useStore.setState({ past: [...prev.past, prev.project].slice(-HISTORY_LIMIT), future: [] })
  })
}
