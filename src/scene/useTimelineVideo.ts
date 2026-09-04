import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useLocalTime, useStore } from '../store'
import { registerVideo } from './videoSync'

/** How far the video may drift from the playhead during playback before it is nudged. */
const DRIFT_TOLERANCE = 0.25

/**
 * A video texture driven by the timeline rather than by its own playback.
 *
 * Waits for `loadeddata`, not `loadedmetadata`: metadata alone means no frame has
 * been decoded, so the texture would be blank. Scrubbing seeks the element and
 * playback lets it run while drift is corrected, which keeps the picture smooth
 * without letting it wander off the clock.
 */
export function useTimelineVideo(url: string | null) {
  const [ready, setReady] = useState<{ tex: THREE.VideoTexture; el: HTMLVideoElement } | null>(null)
  const local = useLocalTime()
  const playing = useStore((s) => s.playing)
  const setMediaError = useStore((s) => s.setMediaError)

  useEffect(() => {
    if (!url) {
      setReady(null)
      return
    }
    const el = document.createElement('video')
    el.src = url
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.preload = 'auto'

    const onReady = () => {
      const tex = new THREE.VideoTexture(el)
      tex.colorSpace = THREE.SRGBColorSpace
      console.info(`[openmock] video ready: ${el.videoWidth}x${el.videoHeight}, ${el.duration.toFixed(2)}s`)
      setMediaError(null)
      setReady({ tex, el })
    }
    const onError = () => {
      const msg = `This video could not be decoded${el.error?.message ? ` (${el.error.message})` : ''}. Browsers do not play every codec — H.264 MP4 and VP9 WebM are the safe choices. A ProRes or HEVC screen recording needs converting first.`
      console.error('[openmock]', msg)
      setMediaError(msg)
    }

    el.addEventListener('loadeddata', onReady, { once: true })
    el.addEventListener('error', onError)
    el.load()

    return () => {
      el.removeEventListener('loadeddata', onReady)
      el.removeEventListener('error', onError)
      el.pause()
      el.removeAttribute('src')
      el.load()
      setReady(null)
    }
  }, [url, setMediaError])

  useEffect(() => (ready ? registerVideo(ready.el, ready.tex) : undefined), [ready])

  useEffect(() => {
    const el = ready?.el
    if (!el) return
    if (playing) {
      if (Math.abs(el.currentTime - local) > DRIFT_TOLERANCE) el.currentTime = Math.min(local, el.duration || local)
      if (el.paused) el.play().catch(() => {})
    } else {
      if (!el.paused) el.pause()
      const target = Math.min(local, Math.max(0, (el.duration || 0) - 1e-3))
      if (Math.abs(el.currentTime - target) > 1e-3) el.currentTime = target
    }
  }, [ready, playing, local])

  /**
   * Push the current frame to the GPU every render.
   *
   * VideoTexture only marks itself dirty when the browser presents a new frame,
   * which a paused video never does. Since this editor sits paused most of the
   * time, without this the screen stays black until you press play.
   */
  useFrame(() => {
    if (ready && ready.el.readyState >= ready.el.HAVE_CURRENT_DATA) ready.tex.needsUpdate = true
  })

  return ready?.tex ?? null
}
