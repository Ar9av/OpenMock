import type * as THREE from 'three'

const videos = new Map<HTMLVideoElement, THREE.VideoTexture>()

export function registerVideo(el: HTMLVideoElement, tex: THREE.VideoTexture) {
  videos.set(el, tex)
  return () => {
    videos.delete(el)
  }
}

function seekOne(v: HTMLVideoElement, t: number) {
  if (!Number.isFinite(v.duration) || v.duration === 0) return Promise.resolve()
  const target = Math.min(Math.max(0, t), Math.max(0, v.duration - 1e-3))
  if (Math.abs(v.currentTime - target) < 1e-3) return Promise.resolve()
  return new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      v.removeEventListener('seeked', done)
      resolve()
    }
    v.addEventListener('seeked', done)
    v.currentTime = target
    // A stubborn seek must not hang the whole export.
    setTimeout(done, 400)
  })
}

/**
 * Parks every video on the exact frame being exported.
 *
 * Export renders far faster or slower than real time, so a freely playing video
 * would land on whatever frame it happened to be showing. Seeking, waiting, then
 * marking the texture dirty is what makes an exported video match the timeline.
 */
export async function seekVideos(t: number) {
  const entries = [...videos.entries()]
  entries.forEach(([v]) => v.pause())
  await Promise.all(entries.map(([v]) => seekOne(v, t)))
  entries.forEach(([, tex]) => (tex.needsUpdate = true))
}

export const hasVideos = () => videos.size > 0
