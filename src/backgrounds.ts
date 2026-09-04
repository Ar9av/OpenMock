import type { Background } from './types'

export interface GradientPreset {
  name: string
  from: string
  to: string
  angle: number
}

/** Curated gradients, so a good-looking backdrop is one click rather than two colour pickers. */
export const GRADIENTS: GradientPreset[] = [
  { name: 'Fog', from: '#ededf0', to: '#c6c8ce', angle: 135 },
  { name: 'Paper', from: '#fdfcfb', to: '#e2d1c3', angle: 160 },
  { name: 'Slate', from: '#3a3d46', to: '#16171b', angle: 150 },
  { name: 'Ink', from: '#232526', to: '#000000', angle: 180 },
  { name: 'Ember', from: '#ff7a45', to: '#c2410c', angle: 140 },
  { name: 'Peach', from: '#ffd3a5', to: '#fd6585', angle: 120 },
  { name: 'Grape', from: '#8e2de2', to: '#4a00e0', angle: 135 },
  { name: 'Ocean', from: '#2b5876', to: '#4e4376', angle: 145 },
  { name: 'Mint', from: '#a8e6cf', to: '#1d976c', angle: 130 },
  { name: 'Sky', from: '#89f7fe', to: '#3b82f6', angle: 140 },
  { name: 'Sand', from: '#f6d365', to: '#fda085', angle: 125 },
  { name: 'Rose', from: '#ffe1e6', to: '#c9a7b0', angle: 150 },
]

export const gradientBackground = (g: GradientPreset): Background => ({
  type: 'gradient',
  from: g.from,
  to: g.to,
  angle: g.angle,
})

export const cssGradient = (g: GradientPreset) => `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`
