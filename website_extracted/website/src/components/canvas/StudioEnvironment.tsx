import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

export function StudioEnvironment() {
  const lightRef = useRef<THREE.SpotLight>(null);

  useFrame((state) => {
    if (lightRef.current) {
      lightRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.3) * 2;
    }
  });

  return (
    <>
      {/* Deep Dark Ambient */}
      <ambientLight intensity={0.4} />

      {/* Main Overhead Key Spotlight */}
      <spotLight
        ref={lightRef}
        position={[2, 6, 4]}
        angle={0.6}
        penumbra={0.8}
        intensity={3.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        color="#F7F5F0"
      />

      {/* Cool Rim Light */}
      <directionalLight
        position={[-4, 3, -3]}
        intensity={1.2}
        color="#384A65"
      />

      {/* Kaphor Crimson Under-Glow / Brand Mood Light */}
      <pointLight
        position={[0, -2, 1]}
        intensity={1.8}
        distance={6}
        color="#A82222"
      />

      {/* Floating Dark Studio Atmospheric Dust Particles */}
      <Sparkles
        count={80}
        scale={10}
        size={1.6}
        speed={0.4}
        opacity={0.35}
        color="#F7F5F0"
      />
      <Sparkles
        count={30}
        scale={8}
        size={2.2}
        speed={0.6}
        opacity={0.5}
        color="#A82222"
      />

      {/* Ground Grid Floor */}
      <mesh position={[0, -1.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#0B0C0E"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
    </>
  );
}
