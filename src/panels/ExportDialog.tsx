import { useRef, useState } from 'react'
import { totalDuration, useStore } from '../store'
import { ASPECTS, type Aspect } from '../types'
import { download, exportPNG } from '../export/exportImage'
import { exportVideo, videoExportSupported, VIDEO_FORMATS, type VideoFormat } from '../export/exportVideo'
import { Pill, SelectRow, SliderRow, ToggleRow } from '../ui/controls'

const aspectOptions = (Object.keys(ASPECTS) as Aspect[]).map((a) => ({ value: a, label: a }))
const slug = (s: string) => s.replace(/\s+/g, '-').toLowerCase() || 'openmock'

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)
  const patchExport = useStore((s) => s.patchExport)
  const [tab, setTab] = useState<'image' | 'video'>('image')
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('mp4')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const cancel = useRef(false)

  const { aspect, width, transparent, fps } = project.export
  const height = Math.round(width / ASPECTS[aspect])
  const duration = totalDuration(project)
  const canVideo = videoExportSupported()

  const run = async () => {
    setBusy(true)
    setError(null)
    setProgress(0)
    cancel.current = false
    try {
      if (tab === 'image') {
        const blob = await exportPNG({ width, height, transparent })
        download(blob, `${slug(project.name)}-${width}x${height}.png`)
      } else {
        const blob = await exportVideo({
          width,
          height,
          fps,
          format: videoFormat,
          onProgress: setProgress,
          cancelled: () => cancel.current,
        })
        download(blob, `${slug(project.name)}-${width}x${height}.${videoFormat === 'mp4' ? 'mp4' : 'webm'}`)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>

        <div className="segmented wide">
          <button className={tab === 'image' ? 'active' : ''} onClick={() => setTab('image')} disabled={busy}>
            Image
          </button>
          <button className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')} disabled={busy}>
            Video
          </button>
        </div>

        <SelectRow label="Aspect" value={aspect} options={aspectOptions} onChange={(a: Aspect) => patchExport({ aspect: a })} />
        <SliderRow label="Width" value={width} min={480} max={4096} step={16} onChange={(w) => patchExport({ width: Math.round(w) })} />
        <Pill label="Output">
          <span className="pill-value">
            {width} × {height}
            {tab === 'video' && ` · ${duration.toFixed(1)}s`}
          </span>
        </Pill>

        {tab === 'image' ? (
          <ToggleRow label="Transparent" value={transparent} onChange={(t) => patchExport({ transparent: t })} />
        ) : (
          <>
            <SelectRow
              label="Format"
              value={videoFormat}
              options={VIDEO_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
              onChange={setVideoFormat}
            />
            <SelectRow
              label="Frame rate"
              value={String(fps)}
              options={[
                { value: '30', label: '30 fps' },
                { value: '60', label: '60 fps' },
              ]}
              onChange={(v) => patchExport({ fps: Number(v) as 30 | 60 })}
            />
            <p className="hint">{VIDEO_FORMATS.find((f) => f.value === videoFormat)?.hint}</p>
            {!canVideo && <p className="error">This browser has no WebCodecs support. Try Chrome or Edge.</p>}
          </>
        )}

        {busy && tab === 'video' && (
          <div className="progress">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
            <em>{Math.round(progress * 100)}%</em>
          </div>
        )}
        {error && <p className="error">{error}</p>}

        <footer>
          {busy && tab === 'video' ? (
            <button className="link" onClick={() => (cancel.current = true)}>
              Cancel render
            </button>
          ) : (
            <button className="link" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          )}
          <button className="primary" disabled={busy || (tab === 'video' && !canVideo)} onClick={run}>
            {busy ? 'Rendering…' : tab === 'image' ? 'Export PNG' : 'Export video'}
          </button>
        </footer>
      </div>
    </div>
  )
}
