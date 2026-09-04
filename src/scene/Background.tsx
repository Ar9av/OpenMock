import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMediaUrl } from '../persist'
import type { Background as Bg } from '../types'

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`
const frag = /* glsl */ `
  varying vec2 vUv;
  uniform int mode; uniform vec3 colorA; uniform vec3 colorB; uniform float angle;
  uniform sampler2D map; uniform vec2 fit; // repeat for cover
  void main(){
    vec3 c = colorA;
    // CSS convention: 0deg points up, angle increases clockwise.
    if (mode == 1) { vec2 d = vec2(sin(angle), cos(angle)); float t = dot(vUv - 0.5, d) + 0.5; c = mix(colorA, colorB, clamp(t, 0.0, 1.0)); }
    if (mode == 2) { vec2 uv = (vUv - 0.5) * fit + 0.5; c = texture2D(map, uv).rgb; }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`

function useBlurredImage(blobKey: string | undefined, blur: number) {
  const url = useMediaUrl(blobKey)
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) return setTex(null)
    const img = new Image()
    img.src = url
    img.onload = () => {
      const c = document.createElement('canvas')
      const scale = Math.min(1, 2048 / Math.max(img.width, img.height))
      c.width = img.width * scale; c.height = img.height * scale
      const ctx = c.getContext('2d')!
      ctx.filter = blur > 0 ? `blur(${blur * 40 * scale}px)` : 'none'
      // ponytail: overdraw edges so blur does not fade to transparent at borders
      const pad = blur * 40 * scale
      ctx.drawImage(img, -pad, -pad, c.width + 2 * pad, c.height + 2 * pad)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      setTex(t)
    }
  }, [url, blur])
  return tex
}

/** Fullscreen quad at the far plane; named so export can hide it for transparent output. */
export function Background({ bg, blur }: { bg: Bg; blur: number }) {
  const viewport = useThree((s) => s.size)
  const image = useBlurredImage(bg.type === 'image' ? bg.blobKey : undefined, blur)
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: { mode: { value: 0 }, colorA: { value: new THREE.Color() }, colorB: { value: new THREE.Color() }, angle: { value: 0 }, map: { value: null }, fit: { value: new THREE.Vector2(1, 1) } },
  }), [])

  const u = mat.uniforms
  if (bg.type === 'color') { u.mode.value = 0; u.colorA.value.set(bg.value) }
  if (bg.type === 'gradient') { u.mode.value = 1; u.colorA.value.set(bg.from); u.colorB.value.set(bg.to); u.angle.value = (bg.angle * Math.PI) / 180 }
  if (bg.type === 'image') {
    u.mode.value = image ? 2 : 0; u.colorA.value.set('#222'); u.map.value = image
    if (image) {
      const img = image.image as HTMLCanvasElement
      const src = img.width / img.height, dst = viewport.width / viewport.height
      u.fit.value.set(src >= dst ? dst / src : 1, src >= dst ? 1 : src / dst)
    }
  }
  if (bg.type === 'transparent') return null
  return <mesh name="background" material={mat} renderOrder={-1000} frustumCulled={false}><planeGeometry args={[2, 2]} /></mesh>
}
