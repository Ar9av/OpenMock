import { MeshReflectorMaterial } from '@react-three/drei'

/**
 * Mirror floor under the device. This is a real reflection rather than a post
 * effect, which is what sells a product shot as a photograph.
 */
export function Floor({ strength }: { strength: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[26, 26]} />
      <MeshReflectorMaterial
        resolution={1024}
        mixBlur={0.8}
        mixStrength={strength * 6}
        blur={[300, 100]}
        mirror={strength}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.35}
        roughness={0.85}
        metalness={0.2}
        color="#9a9aa2"
        transparent
        opacity={Math.min(1, 0.35 + strength * 0.65)}
      />
    </mesh>
  )
}
