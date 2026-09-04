import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useMediaUrl } from '../persist'
import { overlayAt } from '../overlayAnim'
import type { LogoOverlay, Overlay, TextOverlay } from '../types'
import { getFrameTime } from './frameClock'

const FONTS: Record<TextOverlay['font'], string> = {
  sans: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  serif: 'Georgia, "Times New Roman", serif',
}

/** Renders text to a canvas texture. Sized generously so it stays crisp when pushed in. */
function useTextTexture(o: TextOverlay) {
  return useMemo(() => {
    const px = 128
    const lines = o.text.split('\n')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = `${o.weight} ${px}px ${FONTS[o.font]}`
    ctx.font = font
    const width = Math.max(1, ...lines.map((l) => ctx.measureText(l).width))
    const lineHeight = px * 1.22
    const pad = px * 0.18

    canvas.width = Math.ceil(width + pad * 2)
    canvas.height = Math.ceil(lineHeight * lines.length + pad * 2)
    const c = canvas.getContext('2d')!
    c.font = font
    c.fillStyle = o.color
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    lines.forEach((line, i) => c.fillText(line, canvas.width / 2, pad + lineHeight * (i + 0.5)))

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [o.text, o.color, o.weight, o.font])
}

function useImageTexture(url: string | null) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) return setTex(null)
    const img = new Image()
    img.src = url
    img.onload = () => {
      const t = new THREE.Texture(img)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      t.needsUpdate = true
      setTex(t)
    }
  }, [url])
  return tex
}

/**
 * One overlay, pinned to the camera.
 *
 * The transform is recomputed in `onBeforeRender` instead of a frame loop, so it
 * is correct both on screen and inside an export, which renders without React.
 */
function OverlayPlane({ overlay, texture, duration }: { overlay: Overlay; texture: THREE.Texture | null; duration: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    [],
  )

  useEffect(() => {
    material.map = texture
    material.needsUpdate = true
  }, [material, texture])

  const onBeforeRender = (_r: unknown, _s: unknown, camera: THREE.Camera) => {
    const m = mesh.current
    const cam = camera as THREE.PerspectiveCamera
    if (!m || !cam.isPerspectiveCamera || !texture) return

    const anim = overlayAt(overlay, getFrameTime(), duration)
    material.opacity = anim.opacity * overlay.opacity
    m.visible = material.opacity > 0.001
    if (!m.visible) return

    // Keep a fixed distance in front of the camera and match its orientation.
    const dist = 2
    const viewH = 2 * Math.tan((cam.fov * Math.PI) / 360) * (dist / cam.zoom)
    const viewW = viewH * cam.aspect
    const img = texture.image as { width: number; height: number }
    const h = viewH * overlay.size * anim.scale
    const w = h * (img.width / img.height)

    m.scale.set(w, h, 1)
    m.quaternion.copy(cam.quaternion)
    m.position
      .set((overlay.x / 2) * viewW + anim.dx * viewH, (overlay.y / 2) * viewH + anim.dy * viewH, -dist)
      .applyQuaternion(cam.quaternion)
      .add(cam.position)
    m.updateMatrixWorld()
  }

  return (
    <mesh ref={mesh} material={material} renderOrder={1000} frustumCulled={false} onBeforeRender={onBeforeRender}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

function TextItem({ overlay, duration }: { overlay: TextOverlay; duration: number }) {
  return <OverlayPlane overlay={overlay} texture={useTextTexture(overlay)} duration={duration} />
}

function LogoItem({ overlay, duration }: { overlay: LogoOverlay; duration: number }) {
  const url = useMediaUrl(overlay.blobKey)
  return <OverlayPlane overlay={overlay} texture={useImageTexture(url)} duration={duration} />
}

export function Overlays({ overlays, duration }: { overlays: Overlay[]; duration: number }) {
  return (
    <>
      {overlays.map((o) =>
        o.kind === 'text' ? (
          <TextItem key={o.id} overlay={o} duration={duration} />
        ) : (
          <LogoItem key={o.id} overlay={o} duration={duration} />
        ),
      )}
    </>
  )
}
