import { useCallback, useEffect, useRef, useState } from 'react'
import { shotStart, totalDuration, useStore } from '../store'
import { evaluate } from '../anim'
import { TRACKABLE, type Shot } from '../types'
import { autoMotion, buildMove, MOVES, type MoveId } from '../automotion'

const BASE_PPS = 106 // px per second at zoom 1, matching a ~12s default span

export function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.floor((s % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function Ruler({ span, pps }: { span: number; pps: number }) {
  const ticks = []
  for (let s = 0; s <= Math.ceil(span); s++) {
    ticks.push(
      <div key={s} className="tick" style={{ left: s * pps }}>
        <span>{s}s</span>
      </div>,
    )
    for (let i = 1; i < 4 && s + i / 4 <= span; i++) {
      ticks.push(<div key={`${s}-${i}`} className="tick minor" style={{ left: (s + i / 4) * pps }} />)
    }
  }
  return <div className="ruler">{ticks}</div>
}

function TrackRow({ shot, path, pps, offset }: { shot: Shot; path: string; pps: number; offset: number }) {
  const removeKeyframe = useStore((s) => s.removeKeyframe)
  const clearTrack = useStore((s) => s.clearTrack)
  const setTime = useStore((s) => s.setTime)
  return (
    <div className="track-row">
      <div className="track-lane" style={{ left: offset * pps, width: shot.duration * pps }}>
        {shot.tracks[path].map((k) => (
          <button
            key={k.t}
            className="kf"
            style={{ left: k.t * pps }}
            title={`${TRACKABLE[path] ?? path} @ ${k.t.toFixed(2)}s — click to seek, double-click to delete`}
            onClick={() => setTime(offset + k.t)}
            onDoubleClick={() => removeKeyframe(path, k.t)}
          />
        ))}
      </div>
      <button className="track-clear" style={{ left: (offset + shot.duration) * pps + 8 }} onClick={() => clearTrack(path)}>
        clear
      </button>
    </div>
  )
}

export function Timeline() {
  const project = useStore((s) => s.project)
  const time = useStore((s) => s.time)
  const playing = useStore((s) => s.playing)
  const recording = useStore((s) => s.recording)
  const selectedId = useStore((s) => s.selectedId)
  const expanded = useStore((s) => s.expanded)
  const { setTime, setPlaying, setRecording, select, toggleExpanded, addShot, removeShot, updateShot, applyCameraMove, duplicateShot, moveShot } =
    useStore.getState()

  const [zoom, setZoom] = useState(1)
  const [loop, setLoop] = useState(true)
  const [advanced, setAdvanced] = useState(true)
  const pps = BASE_PPS * zoom
  const total = totalDuration(project)
  const span = Math.max(12, total)
  const laneRef = useRef<HTMLDivElement>(null)

  const selected = project.shots.find((s) => s.id === selectedId) ?? project.shots[0]

  // Playback clock.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const next = useStore.getState().time + dt
      if (next >= total) {
        if (loop) setTime(next % total)
        else {
          setTime(total)
          setPlaying(false)
          return
        }
      } else setTime(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, loop, total, setTime, setPlaying])

  // Space bar toggles playback unless a field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      e.preventDefault()
      setPlaying(!useStore.getState().playing)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPlaying])

  const scrub = useCallback(
    (clientX: number) => {
      const el = laneRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setTime((clientX - r.left + el.scrollLeft) / pps)
    },
    [pps, setTime],
  )

  /**
   * Builds from the framing currently on screen, not the stored base, and replaces
   * any existing camera animation. Anchoring on a stale base is what made a second
   * move play back toward the old framing.
   */
  const applyMove = (build: (shot: typeof selected) => Record<string, ReturnType<typeof buildMove>[string]>) => {
    const anchor = evaluate(selected, time - shotStart(project, selected.id))
    applyCameraMove(build(anchor), anchor.camera)
    setTime(shotStart(project, selected.id))
  }

  return (
    <section className="timeline">
      <div className="tl-toolbar">
        <div className="segmented">
          <button className={advanced ? '' : 'active'} onClick={() => setAdvanced(false)}>Simple</button>
          <button className={advanced ? 'active' : ''} onClick={() => setAdvanced(true)}>Advanced</button>
        </div>

        <label className="tl-btn select-btn">
          Presets
          <svg viewBox="0 0 10 6" width="9" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          <select
            value=""
            onChange={(e) => e.target.value && applyMove((sh) => buildMove(sh, e.target.value as MoveId))}
          >
            <option value="">Choose a move…</option>
            {MOVES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>

        <button className="tl-btn" onClick={() => applyMove(autoMotion)}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1.5" y="4" width="9" height="8" rx="1.5" />
            <path d="M11 7.5l3.5-2v5l-3.5-2z" />
          </svg>
          Auto-Motion
        </button>

        <button className={`tl-btn rec ${recording ? 'on' : ''}`} onClick={() => setRecording(!recording)}>
          <span className="dot" />
          Record Keyframes
        </button>

        <div className="tl-time">
          <strong>{formatTime(time)}</strong> / {formatTime(total)}
        </div>

        <label className="tl-duration" title="Selected shot duration">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="8" cy="8" r="6.2" /><path d="M8 4.5V8l2.4 1.6" strokeLinecap="round" />
          </svg>
          <input
            type="number"
            min={0.5}
            max={60}
            step={0.5}
            value={selected.duration}
            onChange={(e) => updateShot(selected.id, (s) => ({ ...s, duration: Math.max(0.5, +e.target.value) }))}
          />
          s
        </label>

        <div className="transport">
          <button onClick={() => setTime(0)} title="Go to start">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M5 3h1.6v10H5zM12 3v10L6.5 8z" /></svg>
          </button>
          <button onClick={() => setPlaying(!playing)} title="Play / pause (space)">
            {playing ? (
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M4 3h2.4v10H4zM9.6 3H12v10H9.6z" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M4.5 3l8 5-8 5z" /></svg>
            )}
          </button>
          <button className={loop ? 'active' : ''} onClick={() => setLoop(!loop)} title="Loop">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M3 8a5 5 0 015-5h3.5M13 8a5 5 0 01-5 5H4.5" strokeLinecap="round" />
              <path d="M10 1.4L12.2 3 10 4.6M6 11.4L3.8 13 6 14.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="tl-spacer" />

        <button className="tl-btn" onClick={addShot}>+ Add Shot</button>

        <label className="tl-zoom">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input type="range" min={0.4} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        </label>
      </div>

      <div className="tl-body">
        <div className="tl-shots">
          {project.shots.map((shot) => {
            const tracks = Object.keys(shot.tracks)
            const open = expanded[shot.id] && advanced
            return (
              <div key={shot.id}>
                <div className={`shot-head ${shot.id === selectedId ? 'sel' : ''}`} onClick={() => select(shot.id)}>
                  <button
                    className={`chev ${open ? 'open' : ''}`}
                    disabled={!tracks.length}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpanded(shot.id)
                    }}
                  >
                    <svg viewBox="0 0 10 10" width="8" height="8"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                  <span className="grip">⣿</span>
                  <span className="shot-name">{shot.name}</span>
                  <span className="shot-dur">{shot.duration.toFixed(1)}s</span>
                  <span className="shot-actions">
                    <button title="Move up" onClick={(e) => { e.stopPropagation(); moveShot(shot.id, -1) }}>↑</button>
                    <button title="Move down" onClick={(e) => { e.stopPropagation(); moveShot(shot.id, 1) }}>↓</button>
                    <button title="Duplicate shot" onClick={(e) => { e.stopPropagation(); duplicateShot(shot.id) }}>⧉</button>
                    {project.shots.length > 1 && (
                      <button
                        className="shot-del"
                        title="Delete shot"
                        onClick={(e) => { e.stopPropagation(); removeShot(shot.id) }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                </div>
                {open && tracks.map((p) => <div key={p} className="track-label">{TRACKABLE[p] ?? p}</div>)}
              </div>
            )
          })}
          <button className="add-track" onClick={addShot}>+ Add Shot</button>
        </div>

        <div className="tl-lanes" ref={laneRef}>
          <div
            className="tl-scroll"
            style={{ width: span * pps + 40 }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              scrub(e.clientX)
            }}
            onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && scrub(e.clientX)}
          >
            <Ruler span={span} pps={pps} />
            {project.shots.map((shot) => {
              const offset = shotStart(project, shot.id)
              const open = expanded[shot.id] && advanced
              return (
                <div key={shot.id}>
                  <div className="lane">
                    <div
                      className={`shot-bar ${shot.id === selectedId ? 'sel' : ''}`}
                      style={{ left: offset * pps, width: shot.duration * pps }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        select(shot.id)
                      }}
                    >
                      <span className="bar-icon" />
                      {shot.name}
                    </div>
                  </div>
                  {open && Object.keys(shot.tracks).map((p) => <TrackRow key={p} shot={shot} path={p} pps={pps} offset={offset} />)}
                </div>
              )
            })}
            <div className="playhead" style={{ left: time * pps }}>
              <span className="playhead-cap">{time.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
