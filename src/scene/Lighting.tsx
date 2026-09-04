import type { ReactElement } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import type { EnvPreset } from '../types'

const deg = Math.PI / 180

const RIGS: Record<EnvPreset, ReactElement> = {
  default: (
    <>
      <Lightformer form="rect" intensity={3} position={[0, 5, 1]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[-5, 2, 3]} rotation-y={Math.PI / 2} scale={[5, 4, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[5, 2, 3]} rotation-y={-Math.PI / 2} scale={[5, 4, 1]} />
    </>
  ),
  'studio-soft': (
    <>
      <Lightformer form="rect" intensity={4} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
      <Lightformer form="rect" intensity={1} position={[5, 2, 2]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
      <Lightformer form="rect" intensity={0.6} position={[0, 1, 6]} scale={[8, 4, 1]} />
    </>
  ),
  'dramatic-key': (
    <>
      <Lightformer form="rect" intensity={8} position={[-4, 4, 3]} rotation-y={Math.PI / 3} scale={[2, 4, 1]} />
      <Lightformer form="rect" intensity={0.25} position={[5, 1, 3]} rotation-y={-Math.PI / 3} scale={[4, 4, 1]} />
    </>
  ),
  'dark-rim': (
    <>
      <Lightformer form="rect" intensity={6} position={[-3, 3, -3]} rotation-y={Math.PI / 4 + Math.PI} scale={[0.5, 6, 1]} />
      <Lightformer form="rect" intensity={6} position={[3, 3, -3]} rotation-y={-Math.PI / 4 + Math.PI} scale={[0.5, 6, 1]} />
      <Lightformer form="rect" intensity={0.15} position={[0, 2, 5]} scale={[6, 4, 1]} />
    </>
  ),
  lightbox: (
    <>
      <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      <Lightformer form="rect" intensity={3} position={[0, 2, 6]} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={3} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={3} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={3} position={[0, 2, -6]} rotation-y={Math.PI} scale={[10, 6, 1]} />
    </>
  ),
}

/** Fully procedural studio: no HDR download, works offline. */
export function Lighting({ preset, rotX, rotY }: { preset: EnvPreset; rotX: number; rotY: number }) {
  return (
    <Environment key={preset} resolution={256} frames={1} environmentRotation={[rotX * deg, rotY * deg, 0]}>
      {RIGS[preset]}
    </Environment>
  )
}
