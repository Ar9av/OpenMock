import { useState } from 'react'
import { DEVICES, finishOf } from '../devices'
import { useShot, useStore } from '../store'
import type { DeviceId } from '../types'
import { Section, SelectRow, SliderRow, ToggleRow } from '../ui/controls'

function DevicePicker({ onPick, onClose }: { onPick: (id: DeviceId) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Choose a device</h2>
        <div className="scene-grid">
          {Object.values(DEVICES).map((d) => (
            <button
              key={d.id}
              className="scene-card"
              onClick={() => {
                onPick(d.id)
                onClose()
              }}
            >
              <span className={`device-glyph ${d.fallback}`} />
              <strong>{d.label}</strong>
              <span>
                {d.screenPx[0].toLocaleString()} × {d.screenPx[1].toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MockupPanel() {
  const shot = useShot()
  const setProp = useStore((s) => s.setProp)
  const [picking, setPicking] = useState(false)
  const def = DEVICES[shot.device.model]
  const finishes = Object.entries(def.finishes).map(([value, f]) => ({ value, label: f.label }))

  return (
    <>
      <Section title="Mockup">
        <div className="card">
          <span className={`device-glyph ${def.fallback}`} />
          <span className="card-text">
            <strong>{def.label}</strong>
            <span>
              {def.screenPx[0].toLocaleString()} × {def.screenPx[1].toLocaleString()}
            </span>
          </span>
          <button className="ghost" onClick={() => setPicking(true)}>
            Change
          </button>
        </div>
        <SelectRow
          label="Finish"
          value={finishOf(def, shot.device.finish).label}
          options={finishes.map((f) => ({ value: f.label, label: f.label }))}
          onChange={(label) => {
            const key = finishes.find((f) => f.label === label)?.value
            if (key) setProp('device.finish', key)
          }}
        />
        <ToggleRow
          label="Flip Screen X"
          value={!!shot.device.flipX}
          onChange={(v) => setProp('device.flipX', v)}
        />
        <ToggleRow
          label="Flip Screen Y"
          value={!!shot.device.flipY}
          onChange={(v) => setProp('device.flipY', v)}
        />
        <p className="hint">Use the flips if an imported model shows your screenshot mirrored or upside down.</p>
      </Section>

      <Section title="Camera">
        <SliderRow label="FOV" value={shot.camera.fov} min={12} max={90} onChange={(v) => setProp('camera.fov', v)} track="camera.fov" />
        <SliderRow
          label="Zoom"
          value={shot.camera.zoom}
          min={0.4}
          max={3}
          step={0.01}
          decimals={2}
          onChange={(v) => setProp('camera.zoom', v)}
          track="camera.zoom"
        />
        <p className="hint">Drag the viewport to orbit, right-drag to pan, scroll to dolly. Keyframe the result with the diamond next to Camera Position in the timeline.</p>
      </Section>

      {picking && <DevicePicker onPick={(model) => setProp('device.model', model)} onClose={() => setPicking(false)} />}
    </>
  )
}
