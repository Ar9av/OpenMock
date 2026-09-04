import { useState } from 'react'
import { useShot, useStore } from '../store'
import { putMedia, useMediaUrl } from '../persist'
import { uid, type Background, type EnvPreset, type ScenePresetId } from '../types'
import { SCENE_PRESETS, scenePreset } from '../scenePresets'
import { GRADIENTS, cssGradient, gradientBackground } from '../backgrounds'
import { Chevron, Pill, Section, SelectRow, SliderRow, ToggleRow } from '../ui/controls'

const LIGHTING: { value: EnvPreset; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'studio-soft', label: 'Studio Soft' },
  { value: 'dramatic-key', label: 'Dramatic Key' },
  { value: 'dark-rim', label: 'Dark Rim' },
  { value: 'lightbox', label: 'Lightbox' },
]

const BG_KINDS: { value: Background['type']; label: string }[] = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'color', label: 'Color' },
  { value: 'image', label: 'Image' },
  { value: 'transparent', label: 'Transparent' },
]

const defaultBg = (type: Background['type']): Background =>
  type === 'color'
    ? { type, value: '#ededf0' }
    : type === 'gradient'
      ? { type, from: '#ededf0', to: '#c6c8ce', angle: 135 }
      : type === 'image'
        ? { type, blobKey: '' }
        : { type: 'transparent' }

function ScenePicker({ onPick, onClose }: { onPick: (id: ScenePresetId) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Choose a scene</h2>
        <div className="scene-grid">
          {SCENE_PRESETS.map((p) => (
            <button
              key={p.id}
              className="scene-card"
              onClick={() => {
                onPick(p.id)
                onClose()
              }}
            >
              <span className="scene-swatch" style={{ background: p.swatch }} />
              <strong>{p.label}</strong>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BackgroundExtras({ bg, set }: { bg: Background; set: (b: Background) => void }) {
  const imageUrl = useMediaUrl(bg.type === 'image' ? bg.blobKey : undefined)
  if (bg.type === 'color') {
    return (
      <Pill label="Color">
        <input className="swatch" type="color" value={bg.value} onChange={(e) => set({ ...bg, value: e.target.value })} />
      </Pill>
    )
  }
  if (bg.type === 'gradient') {
    return (
      <>
        <Pill label="Gradient">
          <span className="swatch-pair">
            <input className="swatch" type="color" value={bg.from} onChange={(e) => set({ ...bg, from: e.target.value })} />
            <input className="swatch" type="color" value={bg.to} onChange={(e) => set({ ...bg, to: e.target.value })} />
          </span>
        </Pill>
        <SliderRow label="BG Angle" value={bg.angle} min={0} max={360} onChange={(angle) => set({ ...bg, angle })} />
      </>
    )
  }
  if (bg.type === 'image') {
    return (
      <label className="ctl">
        <div className="pill pill-select">
          <span className="pill-label">BG Image</span>
          <span className="pill-value">
            {imageUrl ? <img className="thumb-mini" src={imageUrl} alt="" /> : null}
            {imageUrl ? 'Custom' : 'Choose…'}
            <Chevron />
          </span>
        </div>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const key = uid()
            await putMedia(key, f)
            set({ type: 'image', blobKey: key })
          }}
        />
      </label>
    )
  }
  return null
}

export function ScenePanel() {
  const shot = useShot()
  const setProp = useStore((s) => s.setProp)
  const updateShot = useStore((s) => s.updateShot)
  const [picking, setPicking] = useState(false)
  const preset = scenePreset(shot.scene.preset)

  const applyPreset = (id: ScenePresetId) => {
    const def = SCENE_PRESETS.find((p) => p.id === id)!
    updateShot(shot.id, (s) => ({ ...s, scene: { ...s.scene, preset: id, ...def.apply } }))
  }

  return (
    <Section title="Scene">
      <div className="card">
        <span className="card-swatch" style={{ background: preset.swatch }} />
        <span className="card-text">
          <strong>{preset.label}</strong>
          <span>{preset.blurb}</span>
        </span>
        <button className="ghost" onClick={() => setPicking(true)}>
          Change
        </button>
      </div>

      <SelectRow
        label="Lighting"
        value={shot.scene.envPreset}
        options={LIGHTING}
        onChange={(envPreset) => setProp('scene.envPreset', envPreset)}
      />
      <SliderRow
        label="Light Rotation X"
        value={shot.scene.lightRotX}
        min={-180}
        max={180}
        onChange={(v) => setProp('scene.lightRotX', v)}
        track="scene.lightRotX"
      />
      <SliderRow
        label="Light Rotation Y"
        value={shot.scene.lightRotY}
        min={0}
        max={360}
        onChange={(v) => setProp('scene.lightRotY', v)}
        track="scene.lightRotY"
      />
      <ToggleRow label="Contact Shadow" value={shot.scene.contactShadow} onChange={(v) => setProp('scene.contactShadow', v)} />
      <SliderRow
        label="BG Blur"
        value={shot.scene.bgBlur}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => setProp('scene.bgBlur', v)}
        track="scene.bgBlur"
      />
      <SelectRow
        label="Background"
        value={shot.scene.background.type}
        options={BG_KINDS}
        onChange={(type) => setProp('scene.background', defaultBg(type))}
      />
      <BackgroundExtras bg={shot.scene.background} set={(b) => setProp('scene.background', b)} />
      {shot.scene.background.type === 'gradient' && (
        <div className="swatch-grid">
          {GRADIENTS.map((g) => (
            <button
              key={g.name}
              className="swatch-chip"
              title={g.name}
              style={{ background: cssGradient(g) }}
              onClick={() => setProp('scene.background', gradientBackground(g))}
            />
          ))}
        </div>
      )}
      <SliderRow
        label="Screen Glow"
        value={shot.scene.screenGlow}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => setProp('scene.screenGlow', v)}
        track="scene.screenGlow"
      />

      {picking && <ScenePicker onPick={applyPreset} onClose={() => setPicking(false)} />}
    </Section>
  )
}
