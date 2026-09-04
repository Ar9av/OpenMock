import { Component, Suspense, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { RoundedBox, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { deviceAspect, finishOf, type DeviceDef, type Finish } from '../devices'
import { useMediaUrl } from '../persist'
import type { Source } from '../types'
import { coverFit } from './coverFit'
import { useTimelineVideo } from './useTimelineVideo'
import { safeRadius } from './geometry'

/**
 * Display surface.
 *
 * `DoubleSide` is not cosmetic: imported models often have the screen quad wound
 * backwards, and a single-sided material makes it vanish entirely, showing the
 * inside of the lid instead. The polygon offset keeps it clear of bezels that sit
 * on the same plane, which would otherwise z-fight.
 */
const screenMaterial = (map: THREE.Texture | null) =>
  map
    ? new THREE.MeshBasicMaterial({
        map,
        toneMapped: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    : new THREE.MeshStandardMaterial({
        color: '#0a0a0c',
        roughness: 0.12,
        metalness: 0.3,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })

const bodyMaterial = (f: Finish) =>
  new THREE.MeshStandardMaterial({ color: f.color, metalness: f.metalness, roughness: f.roughness })

/** Applies object-fit: cover for this device's display, in place on the texture. */
function useCoverFit(tex: THREE.Texture | null, def: DeviceDef, flip: { x?: boolean; y?: boolean }) {
  return useMemo(() => {
    if (!tex) return null
    const img = tex.image as { width?: number; height?: number; videoWidth?: number; videoHeight?: number }
    const w = img.videoWidth || img.width || 1
    const h = img.videoHeight || img.height || 1
    const [rx, ry] = coverFit(w / h, deviceAspect(def))
    // The device default and the user's correction combine, so either can fix a model.
    const flipX = def.uv.flipX !== !!flip.x
    const flipY = def.uv.flipY !== !!flip.y
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    // Anchored at the centre, so scaling crops evenly and a flip is just a
    // negative scale. No offset, which is what sent the image off the screen.
    tex.center.set(0.5, 0.5)
    tex.rotation = def.uv.rotation
    tex.repeat.set(flipX ? -rx : rx, flipY ? -ry : ry)
    tex.offset.set(0, 0)
    tex.needsUpdate = true
    return tex
  }, [tex, def, flip.x, flip.y])
}

function Screen({ w, h, texture }: { w: number; h: number; texture: THREE.Texture | null }) {
  const mat = useMemo(() => screenMaterial(texture), [texture])
  return (
    <mesh material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/** Roughly where the editor's camera sits, used to work out which way a screen faces. */
const VIEWER_SIDE = new THREE.Vector3(0, 0.35, 1).normalize()

/**
 * Nudges the display a hair proud of the lid it sits in.
 *
 * Models model the screen flush with its bezel and cover glass, sometimes within
 * 0.008 units. A depth bias alone does not settle that reliably: the depth slope
 * grows as the surface turns away from the camera, so the bezel wins at glancing
 * angles and the screen blinks out. Moving the geometry a fixed distance along
 * its own outward normal wins at every angle, and the offset is far too small to
 * see.
 */
function liftScreen(mesh: THREE.Mesh, root: THREE.Object3D) {
  if (mesh.userData.omLifted) return
  mesh.userData.omLifted = true

  const normals = mesh.geometry.getAttribute('normal')
  const positions = mesh.geometry.getAttribute('position')
  if (!normals || !positions) return

  const outward = new THREE.Vector3()
  const centroid = new THREE.Vector3()
  const step = Math.max(1, Math.floor(normals.count / 64))
  let n = 0
  for (let i = 0; i < normals.count; i += step) {
    outward.x += normals.getX(i)
    outward.y += normals.getY(i)
    outward.z += normals.getZ(i)
    centroid.x += positions.getX(i)
    centroid.y += positions.getY(i)
    centroid.z += positions.getZ(i)
    n++
  }
  if (!n || outward.lengthSq() === 0) return
  outward.normalize()
  centroid.divideScalar(n)

  // Imported screens are often wound backwards, so the stored normal cannot pick
  // the side on its own. A device is always modelled with its display facing the
  // viewer, so the sign is taken from the direction the editor's camera looks
  // from. Using "away from the body centre" instead gets a laptop wrong, because
  // its lid leans back behind that centre and the screen sinks into it.
  if (outward.dot(VIEWER_SIDE) < 0) outward.negate()

  const bounds = new THREE.Box3().setFromObject(root)
  const size = bounds.getSize(new THREE.Vector3())
  mesh.position.addScaledVector(outward, Math.max(size.x, size.y, size.z) * 0.004)
}

/** GLB device: swaps the screen material, tints the housing, rests it on y=0. */
function GltfDevice({ def, texture, finish }: { def: DeviceDef; texture: THREE.Texture | null; finish: Finish }) {
  const gltf = useGLTF(def.file, false)
  // useGLTF hands back one cached scene. Two instances render at once while the
  // texture suspends, so without a clone the untextured one overwrites the
  // textured one's screen material and the screenshot never appears.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const screen = useMemo(() => screenMaterial(texture), [texture])
  const body = useMemo(() => bodyMaterial(finish), [finish])

  useLayoutEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const s = (1.7 / Math.max(size.x, size.y, size.z)) * def.scale
    scene.scale.setScalar(s)
    const c = box.getCenter(new THREE.Vector3())
    scene.position.set(-c.x * s, -box.min.y * s, -c.z * s)
  }, [scene, def])

  /**
   * Find the parts once, before anything is reassigned.
   *
   * Swapping in our own material wipes the imported material name, so re-running
   * the match after the texture finishes loading would find nothing and the
   * screenshot would never reach the screen. The original name is stamped onto
   * the mesh so matching stays stable for the life of the model.
   */
  const parts = useMemo(() => {
    const screens: THREE.Mesh[] = []
    const bodies: THREE.Mesh[] = []
    const seen: string[] = []
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      if (o.userData.omPart === undefined) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        o.userData.omPart = m?.name ?? ''
      }
      const part = o.userData.omPart as string
      seen.push(`${o.name} / ${part}`)
      o.castShadow = o.receiveShadow = true
      // three strips dots from object names, so the material name is the reliable id.
      if (def.screenMesh.test(o.name) || def.screenMesh.test(part)) screens.push(o)
      else if (def.bodyMesh.test(o.name) || def.bodyMesh.test(part)) bodies.push(o)
    })
    if (!screens.length) {
      console.warn(`[openmock] no screen matched ${def.screenMesh} in ${def.file}. Parts (mesh / material):`, seen)
    }
    screens.forEach((m) => liftScreen(m, scene))
    return { screens, bodies }
  }, [scene, def])

  useLayoutEffect(() => {
    parts.screens.forEach((m) => (m.material = screen))
    parts.bodies.forEach((m) => (m.material = body))
  }, [parts, screen, body])

  return <primitive object={scene} />
}

/** Stand-in geometry so the pipeline works before any GLB is added. */
function ProceduralDevice({ def, texture, finish }: { def: DeviceDef; texture: THREE.Texture | null; finish: Finish }) {
  const body = useMemo(() => bodyMaterial(finish), [finish])
  const aspect = deviceAspect(def)

  if (def.fallback === 'phone') {
    const h = 1.7
    const w = h * aspect + 0.05
    const d = 0.09
    return (
      <group position={[0, h / 2, 0]}>
        <RoundedBox args={[w, h, d]} radius={safeRadius(0.09, w, h, d)} smoothness={8} castShadow material={body} />
        <group position={[0, 0, d / 2 + 0.004]}>
          <Screen w={w - 0.05} h={h - 0.05} texture={texture} />
        </group>
      </group>
    )
  }

  const w = 2
  const sw = w - 0.1
  const sh = sw / aspect
  const depth = 1.36
  const baseH = 0.05
  const lidD = 0.035
  const lidH = sh + 0.11
  return (
    <group>
      <RoundedBox
        args={[w, baseH, depth]}
        radius={safeRadius(0.02, w, baseH, depth)}
        smoothness={5}
        position={[0, baseH / 2, 0]}
        castShadow
        material={body}
      />
      <group position={[0, baseH, -depth / 2]} rotation={[-0.22, 0, 0]}>
        <RoundedBox
          args={[w, lidH, lidD]}
          radius={safeRadius(0.015, w, lidH, lidD)}
          smoothness={5}
          position={[0, lidH / 2, 0]}
          castShadow
          material={body}
        />
        <group position={[0, lidH / 2, lidD / 2 + 0.004]}>
          <Screen w={sw} h={sh} texture={texture} />
        </group>
      </group>
    </group>
  )
}

/** Chromeless browser window: the frame every SaaS screenshot is shown in. */
function BrowserWindow({ def, texture, finish }: { def: DeviceDef; texture: THREE.Texture | null; finish: Finish }) {
  const body = useMemo(() => bodyMaterial(finish), [finish])
  const dark = finish.color < '#808080'
  const aspect = deviceAspect(def)

  const w = 2.4
  const sw = w - 0.05
  const sh = sw / aspect
  const bar = 0.14
  const h = sh + bar + 0.05
  const d = 0.05
  const lights = ['#ff5f57', '#febc2e', '#28c840']
  const urlColor = dark ? '#3a3a41' : '#d8d8dd'

  return (
    <group position={[0, h / 2 + 0.02, 0]}>
      <RoundedBox args={[w, h, d]} radius={safeRadius(0.04, w, h, d)} smoothness={6} castShadow material={body} />
      {/* Traffic lights */}
      {lights.map((c, i) => (
        <mesh key={c} position={[-w / 2 + 0.12 + i * 0.09, h / 2 - bar / 2, d / 2 + 0.002]}>
          <circleGeometry args={[0.022, 24]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
      {/* Address bar */}
      <mesh position={[0.12, h / 2 - bar / 2, d / 2 + 0.002]}>
        <planeGeometry args={[w * 0.6, bar * 0.5]} />
        <meshBasicMaterial color={urlColor} toneMapped={false} />
      </mesh>
      <group position={[0, h / 2 - bar - sh / 2 - 0.02, d / 2 + 0.003]}>
        <Screen w={sw} h={sh} texture={texture} />
      </group>
    </group>
  )
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    console.info('[openmock] GLB not found, using procedural device.')
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Device({ def, texture, finish }: { def: DeviceDef; texture: THREE.Texture | null; finish: string }) {
  const f = finishOf(def, finish)
  const fallback =
    def.fallback === 'browser' ? (
      <BrowserWindow def={def} texture={texture} finish={f} />
    ) : (
      <ProceduralDevice def={def} texture={texture} finish={f} />
    )
  return (
    <Boundary key={def.id} fallback={fallback}>
      <GltfDevice def={def} texture={texture} finish={f} />
    </Boundary>
  )
}

type Flip = { x?: boolean; y?: boolean }
type Props = { def: DeviceDef; finish: string; flip: Flip }

function ImageDevice({ url, def, finish, flip }: Props & { url: string }) {
  const tex = useTexture(url)
  return <Device def={def} texture={useCoverFit(tex, def, flip)} finish={finish} />
}

function VideoDevice({ url, def, finish, flip }: Props & { url: string }) {
  const tex = useTimelineVideo(url)
  return <Device def={def} texture={useCoverFit(tex, def, flip)} finish={finish} />
}

/**
 * Device with its screen content. Texture loading suspends, so the untextured
 * device renders meanwhile instead of the scene going empty.
 */
export function DeviceStack({ def, finish, flip, source }: Props & { source: Source | null }) {
  const url = useMediaUrl(source?.blobKey)
  const bare = <Device def={def} texture={null} finish={finish} />
  if (!url || !source) return bare
  const key = `${source.blobKey}-${def.id}`
  if (source.kind === 'video') return <VideoDevice key={key} url={url} def={def} finish={finish} flip={flip} />
  return (
    <Suspense fallback={bare}>
      <ImageDevice key={key} url={url} def={def} finish={finish} flip={flip} />
    </Suspense>
  )
}
