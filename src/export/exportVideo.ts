import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer'
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer'
import { evaluate } from '../anim'
import { shotAtTime, shotStart, totalDuration, useStore } from '../store'
import { beginExportViewport } from './renderContext'
import { setFrameTime } from '../scene/frameClock'
import { seekVideos } from '../scene/videoSync'

export type VideoFormat = 'mp4' | 'webm' | 'webm-alpha'

export const VIDEO_FORMATS: { value: VideoFormat; label: string; hint: string }[] = [
  { value: 'mp4', label: 'MP4 · H.264', hint: 'Plays everywhere. Best for social and slides.' },
  { value: 'webm', label: 'WebM · VP9', hint: 'Smaller files, great for the web.' },
  { value: 'webm-alpha', label: 'WebM · transparent', hint: 'Keeps the alpha channel for compositing.' },
]

const CODECS: Record<VideoFormat, string[]> = {
  // Ordered best-first; the first supported one wins.
  mp4: ['avc1.640034', 'avc1.640028', 'avc1.42001f'],
  webm: ['vp09.00.10.08'],
  'webm-alpha': ['vp09.00.10.08', 'vp8'],
}

export const videoExportSupported = () => typeof window !== 'undefined' && 'VideoEncoder' in window

/** Rounds to an even number, which H.264 requires for both dimensions. */
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

async function pickCodec(format: VideoFormat, width: number, height: number, framerate: number, bitrate: number) {
  for (const codec of CODECS[format]) {
    const config: VideoEncoderConfig = { codec, width, height, framerate, bitrate }
    if (format === 'webm-alpha') config.alpha = 'keep'
    try {
      const { supported } = await VideoEncoder.isConfigSupported(config)
      if (supported) return config
    } catch {
      /* unsupported codec string, try the next */
    }
  }
  return null
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

export interface VideoExportOptions {
  width: number
  height: number
  fps: 30 | 60
  format: VideoFormat
  /** Reports 0..1 as frames are encoded. */
  onProgress?: (fraction: number) => void
  /** Return true to abort partway through. */
  cancelled?: () => boolean
}

/**
 * Renders the whole timeline to a video file.
 *
 * The clock is driven by hand rather than by playback: for each frame we set the
 * time, apply the evaluated camera and environment straight to the three.js
 * objects, and render. React cannot be flushed synchronously inside the 3D tree,
 * so anything animated is applied here directly instead of waiting on a commit.
 */
export async function exportVideo(opts: VideoExportOptions): Promise<Blob> {
  if (!videoExportSupported()) throw new Error('This browser has no WebCodecs support. Try Chrome or Edge.')

  const width = even(opts.width)
  const height = even(opts.height)
  const { fps, format } = opts
  const transparent = format === 'webm-alpha'

  const project = useStore.getState().project
  const duration = totalDuration(project)
  const frameCount = Math.max(1, Math.round(duration * fps))
  const bitrate = Math.min(40_000_000, Math.round(width * height * fps * 0.14))

  const config = await pickCodec(format, width, height, fps, bitrate)
  if (!config) throw new Error(`This browser cannot encode ${format}. Try MP4 instead.`)

  const muxer =
    format === 'mp4'
      ? new Mp4Muxer({
          target: new Mp4Target(),
          video: { codec: 'avc', width, height, frameRate: fps },
          fastStart: 'in-memory',
        })
      : new WebmMuxer({
          target: new WebmTarget(),
          video: { codec: config.codec.startsWith('vp8') ? 'V_VP8' : 'V_VP9', width, height, frameRate: fps, alpha: transparent },
        })

  let encodeError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => (muxer as { addVideoChunk: (c: EncodedVideoChunk, m?: unknown) => void }).addVideoChunk(chunk, meta),
    error: (e) => (encodeError = e instanceof Error ? e : new Error(String(e))),
  })
  encoder.configure(config)

  const prevPlaying = useStore.getState().playing
  const prevTime = useStore.getState().time
  useStore.setState({ playing: false })

  const view = beginExportViewport(width, height, transparent)
  const { gl, scene, camera: cam } = view
  const prevEnvRotation = scene.environmentRotation.clone()

  const deg = Math.PI / 180
  let lastShotId = ''

  try {
    for (let i = 0; i < frameCount; i++) {
      if (opts.cancelled?.()) throw new Error('Export cancelled.')
      if (encodeError) throw encodeError

      const t = Math.min(duration - 1e-4, i / fps)
      const shot = shotAtTime(project, t)
      const local = t - shotStart(project, shot.id)
      const frameShot = evaluate(shot, local)

      // A shot change swaps the device and its screen media, which only React can
      // do. Give it a frame to commit before we render.
      if (shot.id !== lastShotId) {
        lastShotId = shot.id
        useStore.setState({ time: t, selectedId: shot.id })
        await nextFrame()
        await nextFrame()
      } else if (i % 4 === 0) {
        useStore.setState({ time: t })
      }

      setFrameTime(local)
      // A freely playing video would land on the wrong frame; park it on this one.
      await seekVideos(local)
      cam.position.set(...frameShot.camera.position)
      cam.fov = frameShot.camera.fov
      cam.zoom = frameShot.camera.zoom
      cam.updateProjectionMatrix()
      cam.lookAt(...frameShot.camera.target)
      scene.environmentRotation.set(frameShot.scene.lightRotX * deg, frameShot.scene.lightRotY * deg, 0)

      view.render()

      const frame = new VideoFrame(gl.domElement, {
        timestamp: Math.round((i * 1e6) / fps),
        duration: Math.round(1e6 / fps),
      })
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()

      // Keep the encoder queue shallow so memory stays flat on long timelines.
      while (encoder.encodeQueueSize > 8) await nextFrame()
      opts.onProgress?.((i + 1) / frameCount)
    }

    await encoder.flush()
    if (encodeError) throw encodeError
    muxer.finalize()
    const { buffer } = muxer.target as { buffer: ArrayBuffer }
    return new Blob([buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' })
  } finally {
    encoder.close()
    scene.environmentRotation.copy(prevEnvRotation)
    view.restore()
    useStore.setState({ time: prevTime, playing: prevPlaying })
  }
}
