import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EcosystemGalaxyProps {
  active: boolean;
}

const COUNT = 240;

export function EcosystemGalaxy({ active }: EcosystemGalaxyProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Generate helix coordinates for the 240 garments
  const instanceData = useMemo(() => {
    const data = [];
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 12; // 6 full spiral turns
      const radius = 2.8 + (i / COUNT) * 5.5;
      const x = Math.cos(angle) * radius;
      const y = ((i - COUNT / 2) / COUNT) * 12;
      const z = Math.sin(angle) * radius;
      const scale = 0.25 + Math.random() * 0.2;
      data.push({ x, y, z, scale, rotY: angle });
    }
    return data;
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    instanceData.forEach((item, i) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.rotY, 0.2);
      dummy.scale.set(item.scale, item.scale * 1.4, item.scale * 0.4);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Color variation: charcoal, navy, kaphor crimson, and cream
      if (i % 6 === 0) {
        color.set('#A82222'); // Crimson accent pieces
      } else if (i % 4 === 0) {
        color.set('#C95F12'); // Amber vintage
      } else if (i % 3 === 0) {
        color.set('#1E3B2F'); // Forest verified
      } else {
        color.set('#1E1F22'); // Stealth charcoal
      }
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [instanceData]);

  useFrame((state, delta) => {
    if (!active || !groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.15;
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central Holographic Core */}
      <mesh>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial color="#A82222" wireframe transparent opacity={0.6} />
      </mesh>

      {/* Orbiting Instanced Garments */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, COUNT]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}
