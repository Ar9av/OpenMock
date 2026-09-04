import { useEffect, useMemo, useRef } from 'react'
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { registerComposer, type Composer } from '../export/renderContext'
import type { Effects as EffectsConfig } from '../types'

export const anyEffectOn = (e: EffectsConfig) =>
  e.bloom > 0 || e.vignette > 0 || e.blur > 0 || e.grain > 0 || e.chroma > 0

/**
 * Post stack. Mounted only when something is switched on, so the plain path stays
 * a single forward render. The composer is registered so export draws through it
 * and the exported file matches the viewport.
 */
export function Effects({ config }: { config: EffectsConfig }) {
  const ref = useRef<Composer>(null)
  const chroma = useMemo(() => new THREE.Vector2(config.chroma * 0.006, config.chroma * 0.006), [config.chroma])

  useEffect(() => registerComposer(ref.current ?? null), [])

  return (
    <EffectComposer ref={ref as never} multisampling={4} enableNormalPass={false}>
      <>
        {config.blur > 0 && (
          <DepthOfField focusDistance={config.focus} focalLength={0.04} bokehScale={config.blur * 12} height={480} />
        )}
        {config.bloom > 0 && (
          <Bloom mipmapBlur intensity={config.bloom * 1.4} luminanceThreshold={0.75} luminanceSmoothing={0.3} />
        )}
        {config.chroma > 0 && <ChromaticAberration offset={chroma} radialModulation modulationOffset={0.3} />}
        {config.grain > 0 && <Noise opacity={config.grain * 0.35} premultiply />}
        {config.vignette > 0 && <Vignette offset={0.28} darkness={config.vignette} />}
      </>
    </EffectComposer>
  )
}
