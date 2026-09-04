import type { DeviceId } from './types'

export interface Finish { label: string; color: string; metalness: number; roughness: number }

export interface DeviceDef {
  id: DeviceId
  label: string
  file: string
  /** Native screen resolution, shown on the mockup card. */
  screenPx: [number, number]
  /**
   * Pattern for the display surface inside the GLB, tested against both the mesh
   * name and its material name. Converted models often carry meaningful names on
   * the material only, since one mesh holds many primitives.
   */
  screenMesh: RegExp
  /** Same matching, for the housing that takes the finish colour. */
  bodyMesh: RegExp
  /** Texture correction for models with odd UV layouts. */
  uv: { rotation: number; flipX: boolean; flipY: boolean }
  scale: number
  fallback: 'phone' | 'laptop' | 'browser'
  finishes: Record<string, Finish>
}

const APPLE_FINISHES: Record<string, Finish> = {
  white: { label: 'White', color: '#ececed', metalness: 0.35, roughness: 0.38 },
  black: { label: 'Black', color: '#1c1c1e', metalness: 0.5, roughness: 0.34 },
  natural: { label: 'Natural', color: '#bcb4a8', metalness: 0.75, roughness: 0.3 },
  'space-gray': { label: 'Space Gray', color: '#54565a', metalness: 0.7, roughness: 0.32 },
}

const BROWSER_FINISHES: Record<string, Finish> = {
  light: { label: 'Light', color: '#e9e9ec', metalness: 0.05, roughness: 0.55 },
  dark: { label: 'Dark', color: '#26262b', metalness: 0.15, roughness: 0.5 },
}

const noUv = { rotation: 0, flipX: false, flipY: false }

export const DEVICES: Record<DeviceId, DeviceDef> = {
  'iphone-17-pro': {
    id: 'iphone-17-pro',
    label: 'iPhone 17',
    file: 'models/iphone-17-pro.glb',
    screenPx: [1206, 2622],
    screenMesh: /screen|display/i,
    bodyMesh: /body|frame|housing|case|back/i,
    uv: noUv,
    scale: 1,
    fallback: 'phone',
    finishes: APPLE_FINISHES,
  },
  'macbook-pro-16': {
    id: 'macbook-pro-16',
    label: 'MacBook Pro 16"',
    file: 'models/macbook-pro-16.glb',
    screenPx: [3456, 2160],
    // The converted model names the display quad by material, not mesh.
    screenMesh: /^Material\.008$|screen|display/i,
    bodyMesh: /^Material\.003$|body|frame|housing|case|lid|base/i,
    // This model's display UVs run bottom-up; verified against a test card.
    uv: { rotation: 0, flipX: false, flipY: true },
    scale: 1,
    fallback: 'laptop',
    finishes: {
      'space-gray': APPLE_FINISHES['space-gray'],
      black: { label: 'Space Black', color: '#2b2b2e', metalness: 0.72, roughness: 0.33 },
      natural: { label: 'Silver', color: '#d6d7da', metalness: 0.78, roughness: 0.28 },
    },
  },
  browser: {
    id: 'browser',
    label: 'Browser Window',
    file: 'models/browser.glb',
    screenPx: [1600, 1000],
    screenMesh: /screen|display|page/i,
    bodyMesh: /body|frame|chrome|window/i,
    uv: noUv,
    scale: 1,
    fallback: 'browser',
    finishes: BROWSER_FINISHES,
  },
}

export const deviceAspect = (d: DeviceDef) => d.screenPx[0] / d.screenPx[1]
export const finishOf = (d: DeviceDef, key: string) => d.finishes[key] ?? Object.values(d.finishes)[0]
