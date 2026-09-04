import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useAnimatedShot, useLocalTime, useStore } from '../store'
import { DEVICES } from '../devices'
import { DeviceStack } from './Device'
import { Lighting } from './Lighting'
import { Background } from './Background'
import { Effects, anyEffectOn } from './Effects'
import { Floor } from './Floor'
import { Overlays } from './Overlays'
import { setFrameTime } from './frameClock'
import { registerRenderContext } from '../export/renderContext'

function Contents() {
  const shot = useAnimatedShot()
  const def = DEVICES[shot.device.model]
  const three = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const setProp = useStore((s) => s.setProp)
  const playing = useStore((s) => s.playing)
  // Overlays read the clock during render; export overwrites it per frame.
  setFrameTime(useLocalTime())

  useEffect(() => registerRenderContext(three), [three])

  // Camera is data: the store drives it, and OrbitControls writes back on release.
  useEffect(() => {
    const c = three.camera as THREE.PerspectiveCamera
    c.position.set(...shot.camera.position)
    c.fov = shot.camera.fov
    c.zoom = shot.camera.zoom
    c.updateProjectionMatrix()
    controls.current?.target.set(...shot.camera.target)
    controls.current?.update()
  }, [shot.camera, three.camera])

  return (
    <>
      <Background bg={shot.scene.background} blur={shot.scene.bgBlur} />
      <Lighting preset={shot.scene.envPreset} rotX={shot.scene.lightRotX} rotY={shot.scene.lightRotY} />
      <DeviceStack
        def={def}
        source={shot.source}
        finish={shot.device.finish}
        flip={{ x: shot.device.flipX, y: shot.device.flipY }}
      />
      {shot.scene.screenGlow > 0 && (
        <pointLight
          position={[0, 0.95, 1.05]}
          intensity={shot.scene.screenGlow * 12}
          distance={7}
          decay={2}
          color="#cfe4ff"
        />
      )}
      {shot.effects.reflection > 0 && <Floor strength={shot.effects.reflection} />}
      {shot.scene.contactShadow && (
        <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={9} blur={2.6} far={5} resolution={512} color="#000000" />
      )}
      <Overlays overlays={shot.overlays} duration={shot.duration} />
      {anyEffectOn(shot.effects) && <Effects config={shot.effects} />}
      <OrbitControls
        ref={controls}
        makeDefault
        /* The clock owns the camera during playback, so dragging cannot fight it. */
        enabled={!playing}
        enablePan
        minDistance={0.8}
        maxDistance={14}
        onEnd={() => {
          const c = three.camera as THREE.PerspectiveCamera
          const t = controls.current!.target
          setProp('camera.position', [c.position.x, c.position.y, c.position.z])
          setProp('camera.target', [t.x, t.y, t.z])
        }}
      />
    </>
  )
}

export function Viewport() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      camera={{ position: [1.1, 1.25, 3.1], fov: 35, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.setClearColor(0x000000, 0)
      }}
    >
      <Contents />
    </Canvas>
  )
}
