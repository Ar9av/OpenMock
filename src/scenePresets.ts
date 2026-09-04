import type { Scene, ScenePresetId } from './types'

export interface ScenePresetDef {
  id: ScenePresetId
  label: string
  blurb: string
  swatch: string
  apply?: Partial<Scene>
}

/** Scene presets bundle a lighting rig with a matching background. */
export const SCENE_PRESETS: ScenePresetDef[] = [
  {
    id: 'custom',
    label: 'Custom Scene',
    blurb: 'Custom lighting + background',
    swatch: 'linear-gradient(135deg,#ededf0,#c6c8ce)',
  },
  {
    id: 'dark-room',
    label: 'Dark Room',
    blurb: 'Screen lights the scene',
    swatch: 'linear-gradient(135deg,#1b1b1f,#0a0a0c)',
    apply: { envPreset: 'dark-rim', background: { type: 'gradient', from: '#1b1b1f', to: '#050506', angle: 160 } },
  },
  {
    id: 'concrete',
    label: 'Concrete',
    blurb: 'Industrial product shot',
    swatch: 'linear-gradient(135deg,#8e8b86,#5d5a55)',
    apply: { envPreset: 'dramatic-key', background: { type: 'gradient', from: '#9b9791', to: '#57544f', angle: 120 } },
  },
  {
    id: 'studio',
    label: 'Studio',
    blurb: 'Bright light tent',
    swatch: 'linear-gradient(135deg,#ffffff,#e6e6ea)',
    apply: { envPreset: 'lightbox', background: { type: 'gradient', from: '#ffffff', to: '#e4e4e9', angle: 135 } },
  },
]

export const scenePreset = (id: ScenePresetId) => SCENE_PRESETS.find((p) => p.id === id) ?? SCENE_PRESETS[0]
