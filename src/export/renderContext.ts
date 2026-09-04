import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'

/** Anything that can draw the scene to the canvas at the current size. */
export interface Composer {
  render: () => void
  setSize: (w: number, h: number) => void
}

let ctx: RootState | null = null
let composer: Composer | null = null

/** The live R3F root, so export can render the same scene at a different size. */
export const registerRenderContext = (r: RootState) => {
  ctx = r
  return () => {
    if (ctx === r) ctx = null
  }
}

/**
 * The post-processing composer, when effects are on. Export must draw through it
 * or the exported file would silently lack every effect the user can see.
 */
export const registerComposer = (c: Composer | null) => {
  composer = c
  return () => {
    if (composer === c) composer = null
  }
}

export const getRenderContext = () => ctx

// Dev-only handle so the running scene can be inspected from a headless browser.
if (import.meta.env.DEV) {
  ;(globalThis as unknown as { __openmock?: () => unknown }).__openmock = () => ctx
}

/**
 * Resizes the drawing buffer to the export size, optionally drops the background
 * for alpha, and hands back a `render` plus a `restore` that puts everything back.
 * The CSS size is untouched, so the visible viewport never jumps.
 */
export function beginExportViewport(width: number, height: number, transparent: boolean) {
  const c = ctx
  if (!c) throw new Error('Viewport is not ready yet.')
  const { gl, scene, camera } = c
  const cam = camera as THREE.PerspectiveCamera

  const prevSize = gl.getSize(new THREE.Vector2())
  const prevDpr = gl.getPixelRatio()
  const prevAspect = cam.aspect
  const background = scene.getObjectByName('background')
  const prevBgVisible = background?.visible

  gl.setPixelRatio(1)
  gl.setSize(width, height, false)
  composer?.setSize(width, height)
  cam.aspect = width / height
  cam.updateProjectionMatrix()
  if (background && transparent) background.visible = false

  return {
    gl,
    scene,
    camera: cam,
    render: () => (composer ? composer.render() : gl.render(scene, cam)),
    restore: () => {
      gl.setPixelRatio(prevDpr)
      gl.setSize(prevSize.x, prevSize.y, false)
      composer?.setSize(prevSize.x, prevSize.y)
      cam.aspect = prevAspect
      cam.updateProjectionMatrix()
      if (background) background.visible = prevBgVisible ?? true
    },
  }
}
