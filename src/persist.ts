import { get, set, del } from 'idb-keyval'
import { useEffect, useState } from 'react'
import { useStore } from './store'
import { defaultShot, NO_EFFECTS, type Project, type Shot } from './types'

const LAST = 'openmock:last'
const urlCache = new Map<string, string>()

export const putMedia = async (key: string, blob: Blob) => { await set(`media/${key}`, blob) }
export const getMedia = (key: string) => get<Blob>(`media/${key}`)
export const delMedia = (key: string) => { urlCache.delete(key); return del(`media/${key}`) }

/** Object URL for a stored blob; null while loading or missing. */
export function useMediaUrl(key: string | undefined) {
  const [url, setUrl] = useState<string | null>(key ? urlCache.get(key) ?? null : null)
  useEffect(() => {
    if (!key) return setUrl(null)
    const cached = urlCache.get(key)
    if (cached) return setUrl(cached)
    let alive = true
    getMedia(key).then((b) => {
      if (!alive || !b) return
      const u = URL.createObjectURL(b)
      urlCache.set(key, u)
      setUrl(u)
    })
    return () => { alive = false }
  }, [key])
  return url
}

/**
 * Fills in fields added after a project was saved. Autosaved projects outlive the
 * schema, so every load runs through this rather than trusting what is on disk.
 */
export function migrateProject(p: Project): Project {
  const base = defaultShot()
  return {
    ...p,
    shots: (p.shots?.length ? p.shots : [base]).map(
      (s): Shot => ({
        ...base,
        ...s,
        name: s.name ?? 'Shot 1',
        scene: { ...base.scene, ...s.scene },
        camera: { ...base.camera, ...s.camera },
        device: { ...base.device, ...s.device },
        effects: { ...NO_EFFECTS, ...s.effects },
        overlays: s.overlays ?? [],
        tracks: s.tracks ?? {},
      }),
    ),
    export: { ...{ aspect: '16:9' as const, width: 1920, transparent: false, fps: 30 as const, format: 'png' as const }, ...p.export },
  }
}

export async function loadLastProject(): Promise<Project | undefined> {
  const p = await get<Project>(LAST)
  return p && migrateProject(p)
}

/** Autosave: debounced write of the current project. Call once at app start. */
export function startAutosave() {
  let t: ReturnType<typeof setTimeout> | undefined
  return useStore.subscribe((s, prev) => {
    if (s.project === prev.project) return
    clearTimeout(t)
    t = setTimeout(() => set(LAST, s.project), 1000)
  })
}
