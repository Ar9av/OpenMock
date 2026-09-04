import { useCallback, useRef, type ReactNode } from 'react'
import { keyframeAt } from '../anim'
import { useLocalTime, useShot, useStore } from '../store'

/** Diamond keyframe button: filled at a key, half at an animated track, hollow otherwise. */
export function KeyButton({ path }: { path: string }) {
  const shot = useShot()
  const local = useLocalTime()
  const toggle = useStore((s) => s.toggleKeyframe)
  const kfs = shot.tracks[path]
  const state = keyframeAt(kfs, local) ? 'on' : kfs?.length ? 'animated' : 'off'
  return (
    <button
      className={`keybtn ${state}`}
      title={state === 'on' ? 'Remove keyframe' : 'Add keyframe'}
      onClick={() => toggle(path)}
      aria-label={`keyframe ${path}`}
    >
      <svg viewBox="0 0 12 12" width="11" height="11">
        <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" />
      </svg>
    </button>
  )
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel-section">
      <header>
        <h2>{title}</h2>
        {right && <span className="section-right">{right}</span>}
      </header>
      <div className="rows">{children}</div>
    </section>
  )
}

/** Label pill with arbitrary content on its right edge. */
export function Pill({ label, children, track }: { label: string; children?: ReactNode; track?: string }) {
  return (
    <div className="ctl">
      <div className="pill">
        <span className="pill-label">{label}</span>
        {children}
      </div>
      {track && <KeyButton path={track} />}
    </div>
  )
}

export function SelectRow<T extends string>({
  label, value, options, onChange, track,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  track?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <div className="ctl">
      <label className="pill pill-select">
        <span className="pill-label">{label}</span>
        <span className="pill-value">
          {current?.label ?? value}
          <Chevron />
        </span>
        <select value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {track && <KeyButton path={track} />}
    </div>
  )
}

/**
 * Slider drawn as a filled pill with a separate numeric readout, like the reference UI.
 * Drag anywhere on the pill to scrub.
 */
export function SliderRow({
  label, value, min, max, step = 1, decimals = 0, onChange, track,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  decimals?: number
  onChange: (v: number) => void
  track?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = ((value - min) / (max - min)) * 100

  const scrub = useCallback(
    (clientX: number) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const raw = min + ((clientX - r.left) / r.width) * (max - min)
      onChange(Math.min(max, Math.max(min, Math.round(raw / step) * step)))
    },
    [min, max, step, onChange],
  )

  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    scrub(e.clientX)
  }

  return (
    <div className="ctl">
      <div
        ref={ref}
        className="pill pill-slider"
        onPointerDown={onDown}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && scrub(e.clientX)}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onChange(Math.max(min, value - step))
          if (e.key === 'ArrowRight') onChange(Math.min(max, value + step))
        }}
      >
        <span className="pill-fill" style={{ width: `${pct}%` }} />
        <span className="pill-label">{label}</span>
      </div>
      <span className="numbox">{value.toFixed(decimals)}</span>
      {track && <KeyButton path={track} />}
    </div>
  )
}

export function ToggleRow({
  label, value, onChange,
}: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pill label={label}>
      <button className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)} aria-pressed={value} aria-label={label}>
        <span className="knob" />
      </button>
    </Pill>
  )
}

export const Chevron = () => (
  <svg className="chev" viewBox="0 0 10 6" width="9" height="6" aria-hidden>
    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)
