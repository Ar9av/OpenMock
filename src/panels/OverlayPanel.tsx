import { useRef } from 'react'
import { useShot, useStore } from '../store'
import { putMedia } from '../persist'
import { newLogoOverlay, newTextOverlay, uid, type AnimStyle, type Overlay } from '../types'
import { Pill, Section, SelectRow, SliderRow } from '../ui/controls'

const STYLES: { value: AnimStyle; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'scale', label: 'Scale' },
  { value: 'none', label: 'None' },
]

const FONTS = [
  { value: 'sans', label: 'Sans' },
  { value: 'mono', label: 'Mono' },
  { value: 'serif', label: 'Serif' },
] as const

const WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '600', label: 'Semibold' },
  { value: '800', label: 'Bold' },
]

function OverlayEditor({ overlay, index }: { overlay: Overlay; index: number }) {
  const shot = useShot()
  const updateShot = useStore((s) => s.updateShot)
  const expanded = useStore((s) => s.expanded[overlay.id])
  const toggleExpanded = useStore((s) => s.toggleExpanded)

  const patch = (p: Partial<Overlay>) =>
    updateShot(shot.id, (s) => ({
      ...s,
      overlays: s.overlays.map((o, i) => (i === index ? ({ ...o, ...p } as Overlay) : o)),
    }))

  const remove = () => updateShot(shot.id, (s) => ({ ...s, overlays: s.overlays.filter((_, i) => i !== index) }))

  return (
    <div className="overlay-item">
      <div className="overlay-head">
        <button className={`chev ${expanded ? 'open' : ''}`} onClick={() => toggleExpanded(overlay.id)}>
          <svg viewBox="0 0 10 10" width="8" height="8">
            <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <span className="overlay-title">{overlay.kind === 'text' ? overlay.text.split('\n')[0] || 'Text' : 'Logo'}</span>
        <button className="shot-del" title="Delete overlay" onClick={remove}>
          ×
        </button>
      </div>

      {expanded && (
        <div className="rows">
          {overlay.kind === 'text' && (
            <>
              <textarea
                className="text-input"
                value={overlay.text}
                rows={2}
                placeholder="Your headline"
                onChange={(e) => patch({ text: e.target.value })}
              />
              <Pill label="Color">
                <input className="swatch" type="color" value={overlay.color} onChange={(e) => patch({ color: e.target.value })} />
              </Pill>
              <SelectRow
                label="Font"
                value={overlay.font}
                options={FONTS.map((f) => ({ value: f.value, label: f.label }))}
                onChange={(font) => patch({ font })}
              />
              <SelectRow
                label="Weight"
                value={String(overlay.weight)}
                options={WEIGHTS}
                onChange={(w) => patch({ weight: Number(w) as 400 | 600 | 800 })}
              />
            </>
          )}
          <SliderRow label="Size" value={overlay.size} min={0.02} max={0.4} step={0.005} decimals={3} onChange={(size) => patch({ size })} />
          <SliderRow label="Position X" value={overlay.x} min={-1} max={1} step={0.01} decimals={2} onChange={(x) => patch({ x })} />
          <SliderRow label="Position Y" value={overlay.y} min={-1} max={1} step={0.01} decimals={2} onChange={(y) => patch({ y })} />
          <SliderRow label="Opacity" value={overlay.opacity} min={0} max={1} step={0.01} decimals={2} onChange={(opacity) => patch({ opacity })} />
          <SelectRow label="Enter" value={overlay.enter} options={STYLES} onChange={(enter) => patch({ enter })} />
          <SliderRow label="Enter Time" value={overlay.enterDur} min={0} max={3} step={0.05} decimals={2} onChange={(enterDur) => patch({ enterDur })} />
          <SelectRow label="Exit" value={overlay.exit} options={STYLES} onChange={(exit) => patch({ exit })} />
          <SliderRow label="Exit Time" value={overlay.exitDur} min={0} max={3} step={0.05} decimals={2} onChange={(exitDur) => patch({ exitDur })} />
          <SliderRow label="Start" value={overlay.start} min={0} max={shot.duration} step={0.05} decimals={2} onChange={(start) => patch({ start })} />
        </div>
      )}
    </div>
  )
}

export function OverlayPanel() {
  const shot = useShot()
  const updateShot = useStore((s) => s.updateShot)
  const logoInput = useRef<HTMLInputElement>(null)

  const add = (o: Overlay) => updateShot(shot.id, (s) => ({ ...s, overlays: [...s.overlays, o] }))

  return (
    <Section title="Text & Logo">
      <div className="overlay-add">
        <button className="ghost" onClick={() => add(newTextOverlay())}>
          + Text
        </button>
        <button className="ghost" onClick={() => logoInput.current?.click()}>
          + Logo
        </button>
        <input
          ref={logoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const key = uid()
            await putMedia(key, f)
            add(newLogoOverlay(key))
          }}
        />
      </div>
      {shot.overlays.map((o, i) => (
        <OverlayEditor key={o.id} overlay={o} index={i} />
      ))}
      {shot.overlays.length === 0 && <p className="hint">Add a headline or a logo. Both animate in and out on their own timing.</p>}
    </Section>
  )
}
