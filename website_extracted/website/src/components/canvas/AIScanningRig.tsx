import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AIScanningRigProps {
  active: boolean;
}

export function AIScanningRig({ active }: AIScanningRigProps) {
  const ringRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sweepPos = useRef(0);
  const direction = useRef(1);

  useFrame((state, delta) => {
    if (!active || !ringRef.current) return;

    // Oscillate vertically between -1.0 and +1.0
    sweepPos.current += delta * 1.4 * direction.current;
    if (sweepPos.current > 0.9) {
      sweepPos.current = 0.9;
      direction.current = -1;
    } else if (sweepPos.current < -0.9) {
      sweepPos.current = -0.9;
      direction.current = 1;
    }

    ringRef.current.position.y = sweepPos.current;

    // Subtle breathing scale
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.03;
    ringRef.current.scale.set(pulse, 1, pulse);

    if (lightRef.current) {
      lightRef.current.intensity = 2 + Math.sin(state.clock.elapsedTime * 8) * 0.5;
    }
  });

  if (!active) return null;

  return (
    <group ref={ringRef} position={[0, 0, 0]}>
      {/* Outer Glowing Scanner Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.15, 0.018, 16, 64]} />
        <meshBasicMaterial color="#A82222" transparent opacity={0.9} />
      </mesh>

      {/* Inner Precision Cross-Laser */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 1.14, 32]} />
        <meshBasicMaterial
          color="#A82222"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Concentric Scan Target Nodes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.75, 0.008, 16, 32]} />
        <meshBasicMaterial color="#F7F5F0" transparent opacity={0.4} />
      </mesh>

      {/* Volumetric Point Light moving with scanner */}
      <pointLight
        ref={lightRef}
        color="#A82222"
        distance={2.5}
        intensity={2.5}
      />
    </group>
  );
}
