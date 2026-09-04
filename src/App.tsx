import { useEffect, useRef, useState } from 'react'
import { Viewport } from './scene/Viewport'
import { SourcePanel, useAcceptMedia } from './panels/SourcePanel'
import { MockupPanel } from './panels/MockupPanel'
import { ScenePanel } from './panels/ScenePanel'
import { EffectsPanel } from './panels/EffectsPanel'
import { OverlayPanel } from './panels/OverlayPanel'
import { ExportDialog } from './panels/ExportDialog'
import { TemplateDialog } from './panels/TemplateDialog'
import { Timeline } from './timeline/Timeline'
import { startHistory, totalDuration, useShot, useStore } from './store'
import { loadLastProject, startAutosave } from './persist'
import { download, exportPNG } from './export/exportImage'
import { ASPECTS, type Aspect } from './types'
import { MEDIA_ACCEPT } from './media'

type Fit = 'fill' | Aspect
const FITS: Fit[] = ['fill', ...(Object.keys(ASPECTS) as Aspect[])]

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('openmock:dark') === '1')
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('openmock:dark', dark ? '1' : '0')
  }, [dark])
  return [dark, setDark] as const
}

/** Prompt shown over the viewport until the shot has media. */
function UploadToast() {
  const accept = useAcceptMedia()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="upload-toast">
      <span>Upload media to get started — or paste / drop.</span>
      <button onClick={() => input.current?.click()}>Upload</button>
      <input ref={input} type="file" accept={MEDIA_ACCEPT} hidden onChange={(e) => accept(e.target.files?.[0])} />
    </div>
  )
}

export default function App() {
  const project = useStore((s) => s.project)
  const setProject = useStore((s) => s.setProject)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const shot = useShot()
  const accept = useAcceptMedia()
  const [dark, setDark] = useTheme()
  const [dialog, setDialog] = useState<null | 'export' | 'templates'>(null)
  const [fit, setFit] = useState<Fit>('fill')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadLastProject()
      .then((p) => (p && p.version === 1 ? setProject(p) : setProject(useStore.getState().project)))
      .finally(() => setReady(true))
  }, [setProject])

  useEffect(() => {
    if (!ready) return
    const stopSave = startAutosave()
    const stopHistory = startHistory()
    return () => {
      stopSave()
      stopHistory()
    }
  }, [ready])

  // Editor shortcuts. Typing in a field never triggers them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
      } else if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setDialog('export')
      } else if (!mod && e.key === 'ArrowRight') {
        e.preventDefault()
        s.setTime(s.time + (e.shiftKey ? 1 : 1 / 30))
      } else if (!mod && e.key === 'ArrowLeft') {
        e.preventDefault()
        s.setTime(s.time - (e.shiftKey ? 1 : 1 / 30))
      } else if (e.key === 'Home') {
        s.setTime(0)
      } else if (e.key === 'End') {
        s.setTime(totalDuration(s.project))
      } else if (!mod && e.key.toLowerCase() === 'r') {
        s.setRecording(!s.recording)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const snapshot = async () => {
    const blob = await exportPNG({ width: 1920, height: 1080, transparent: false })
    download(blob, `${project.name.replace(/\s+/g, '-').toLowerCase() || 'openmock'}-snapshot.png`)
  }

  if (!ready) return <div className="boot">Loading…</div>

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand" title="openmock">
          <svg viewBox="0 0 16 16" width="15" height="15">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1a7 7 0 010 14z" fill="currentColor" />
          </svg>
        </span>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => setProject({ ...project, name: e.target.value })}
          aria-label="Project name"
        />
        <button className="tl-btn" onClick={() => setDialog('templates')}>
          Templates
        </button>

        <label className="fit-select">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
          </svg>
          {fit === 'fill' ? 'Fill' : fit}
          <svg viewBox="0 0 10 6" width="9" height="6">
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <select value={fit} onChange={(e) => setFit(e.target.value as Fit)}>
            {FITS.map((f) => (
              <option key={f} value={f}>
                {f === 'fill' ? 'Fill' : f}
              </option>
            ))}
          </select>
        </label>

        <div className="spacer" />
        <button className="icon-btn" title="Snapshot PNG" onClick={snapshot}>
          <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2.5 6h2.2l1-1.6h4.6L11.3 6h2.2A1.5 1.5 0 0115 7.5v5A1.5 1.5 0 0113.5 14h-9A1.5 1.5 0 013 12.5v-5A1.5 1.5 0 014.5 6z" />
            <circle cx="9" cy="9.8" r="2.3" />
          </svg>
        </button>
        <button className="primary" onClick={() => setDialog('export')}>
          Export
        </button>
      </header>

      <main className="stage">
        <div
          className={`viewport-frame ${fit === 'fill' ? 'fill' : ''}`}
          style={fit === 'fill' ? undefined : { aspectRatio: String(ASPECTS[fit]) }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            accept(e.dataTransfer.files[0])
          }}
        >
          <Viewport />
          {!shot.source && <UploadToast />}
        </div>
      </main>

      <Timeline />

      <aside className="panel">
        <div className="panel-top">
          <button className="icon-btn" title="Undo (⌘Z)" disabled={!canUndo} onClick={() => useStore.getState().undo()}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8a5 5 0 115 5" strokeLinecap="round" />
              <path d="M1.4 6.2L3 8.2 5 6.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="icon-btn" title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={() => useStore.getState().redo()}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <g transform="translate(16,0) scale(-1,1)">
                <path d="M3 8a5 5 0 115 5" strokeLinecap="round" />
                <path d="M1.4 6.2L3 8.2 5 6.6" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </svg>
          </button>
          <div className="spacer" />
          <button className="icon-btn" title="Toggle theme" onClick={() => setDark(!dark)}>
            {dark ? (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="8" cy="8" r="3.2" />
                <path
                  d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M13.5 9.6A5.8 5.8 0 016.4 2.5a5.8 5.8 0 107.1 7.1z" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <SourcePanel />
        <ScenePanel />
        <MockupPanel />
        <OverlayPanel />
        <EffectsPanel />
      </aside>

      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {dialog === 'templates' && <TemplateDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
