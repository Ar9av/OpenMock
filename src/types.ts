export type DeviceId = 'iphone-17-pro' | 'macbook-pro-16' | 'browser'
export type EnvPreset = 'default' | 'studio-soft' | 'dramatic-key' | 'dark-rim' | 'lightbox'
export type ScenePresetId = 'custom' | 'dark-room' | 'concrete' | 'studio'

export type Background =
  | { type: 'transparent' }
  | { type: 'color'; value: string }
  | { type: 'gradient'; from: string; to: string; angle: number }
  | { type: 'image'; blobKey: string }

export interface Source { blobKey: string; kind: 'image' | 'video' }
export interface Camera { position: [number, number, number]; target: [number, number, number]; fov: number; zoom: number }
export interface Scene {
  preset: ScenePresetId
  background: Background
  envPreset: EnvPreset
  lightRotX: number
  lightRotY: number
  contactShadow: boolean
  bgBlur: number
  /** Light the screen throws back into the scene. */
  screenGlow: number
}
/** Post-processing and floor effects. All numeric so every one is keyframable. */
export interface Effects {
  bloom: number
  vignette: number
  blur: number
  focus: number
  grain: number
  chroma: number
  reflection: number
}

export type AnimStyle = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'scale'

interface OverlayBase {
  id: string
  /** Screen position, -1..1 from the centre of the frame. */
  x: number
  y: number
  /** Height as a fraction of the view height. */
  size: number
  opacity: number
  enter: AnimStyle
  exit: AnimStyle
  enterDur: number
  exitDur: number
  start: number
  /** 0 means "until the end of the shot". */
  end: number
}
export interface TextOverlay extends OverlayBase {
  kind: 'text'
  text: string
  color: string
  weight: 400 | 600 | 800
  font: 'sans' | 'mono' | 'serif'
}
export interface LogoOverlay extends OverlayBase {
  kind: 'logo'
  blobKey: string
}
export type Overlay = TextOverlay | LogoOverlay

export type Easing = 'linear' | 'easeInOut'
export interface Keyframe { t: number; value: number | number[]; easing: Easing }

export interface Shot {
  id: string
  name: string
  duration: number
  source: Source | null
  /** flipX/flipY correct the screen orientation of an imported model, on top of its own defaults. */
  device: { model: DeviceId; finish: string; flipX?: boolean; flipY?: boolean }
  scene: Scene
  camera: Camera
  effects: Effects
  overlays: Overlay[]
  /** property path -> keyframes, times local to this shot */
  tracks: Record<string, Keyframe[]>
}

export type Aspect = '16:9' | '1:1' | '4:5' | '9:16' | '3:4' | '4:3' | '21:9' | '3:2' | '2:3'
export interface ExportSettings { aspect: Aspect; width: number; transparent: boolean; fps: 30 | 60; format: 'png' | 'webm' }
export interface Project { id: string; name: string; version: 1; createdAt: number; updatedAt: number; shots: Shot[]; export: ExportSettings }

export const ASPECTS: Record<Aspect, number> = {
  '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16, '3:4': 3 / 4,
  '4:3': 4 / 3, '21:9': 21 / 9, '3:2': 3 / 2, '2:3': 2 / 3,
}

/** Animatable numeric properties, keyed by the path used in Shot.tracks. */
export const TRACKABLE: Record<string, string> = {
  'scene.lightRotX': 'Light Rotation X',
  'scene.lightRotY': 'Light Rotation Y',
  'scene.bgBlur': 'BG Blur',
  'scene.screenGlow': 'Screen Glow',
  'camera.fov': 'FOV',
  'camera.zoom': 'Zoom',
  'camera.position': 'Camera Position',
  'camera.target': 'Camera Target',
  'effects.bloom': 'Bloom',
  'effects.vignette': 'Vignette',
  'effects.blur': 'Lens Blur',
  'effects.focus': 'Focus',
  'effects.grain': 'Grain',
  'effects.chroma': 'Chromatic',
  'effects.reflection': 'Reflection',
}

export const NO_EFFECTS: Effects = { bloom: 0, vignette: 0, blur: 0, focus: 0.5, grain: 0, chroma: 0, reflection: 0 }

export const uid = () => Math.random().toString(36).slice(2, 10)

const overlayDefaults = () => ({
  id: uid(), x: 0, y: -0.62, size: 0.09, opacity: 1,
  enter: 'slide-up' as AnimStyle, exit: 'fade' as AnimStyle,
  enterDur: 0.6, exitDur: 0.4, start: 0, end: 0,
})

export const newTextOverlay = (text = 'Your headline'): TextOverlay => ({
  ...overlayDefaults(), kind: 'text', text, color: '#ffffff', weight: 600, font: 'sans',
})

export const newLogoOverlay = (blobKey: string): LogoOverlay => ({
  ...overlayDefaults(), kind: 'logo', blobKey, y: 0.62, size: 0.12,
})

export const defaultShot = (name = 'Shot 1'): Shot => ({
  id: uid(),
  name,
  duration: 3,
  source: null,
  device: { model: 'iphone-17-pro', finish: 'white' },
  scene: {
    preset: 'custom',
    background: { type: 'gradient', from: '#ededf0', to: '#c6c8ce', angle: 135 },
    envPreset: 'default',
    lightRotX: 0,
    lightRotY: 263,
    contactShadow: true,
    bgBlur: 0.85,
    screenGlow: 0,
  },
  camera: { position: [1.1, 1.25, 3.1], target: [0, 0.8, 0], fov: 35, zoom: 1 },
  effects: { ...NO_EFFECTS },
  overlays: [],
  tracks: {},
})

export const defaultProject = (): Project => ({
  id: uid(),
  name: 'Untitled',
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  shots: [defaultShot()],
  export: { aspect: '16:9', width: 1920, transparent: false, fps: 30, format: 'png' },
})
