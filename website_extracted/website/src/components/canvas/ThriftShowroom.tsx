import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RackGarment } from '../../types';
import { sound } from '../../utils/audio';

interface ThriftShowroomProps {
  active: boolean;
  onSelectGarment: (garment: RackGarment) => void;
  selectedGarmentId: string | null;
}

const MARKETPLACE_ITEMS: RackGarment[] = [
  {
    id: 'item-1',
    title: 'Archive Washed Denim Jacket',
    brand: 'Kaphor Verified',
    category: 'Outerwear',
    condition: 'Excellent',
    conditionScore: 96,
    price: 749,
    marketPrice: 2800,
    co2SavedKg: 14.2,
    position: [-1.4, 0.2, 0.4],
    rotation: [0, 0.2, 0]
  },
  {
    id: 'item-2',
    title: '1998 Heavyweight Cotton Overshirt',
    brand: 'Japanese Selvedge',
    category: 'Shirts',
    condition: 'Good (Minor Cuff Patina)',
    conditionScore: 89,
    price: 499,
    marketPrice: 1950,
    co2SavedKg: 8.7,
    position: [0, 0.2, 0.6],
    rotation: [0, -0.1, 0]
  },
  {
    id: 'item-3',
    title: 'Relaxed Wide-Leg Raw Denim',
    brand: 'Deadstock Archive',
    category: 'Pants',
    condition: 'Mint / Unworn',
    conditionScore: 99,
    price: 899,
    marketPrice: 3400,
    co2SavedKg: 18.5,
    position: [1.4, 0.2, 0.4],
    rotation: [0, -0.3, 0]
  }
];

export function ThriftShowroom({
  active,
  onSelectGarment,
  selectedGarmentId
}: ThriftShowroomProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Load user provided store rack model
  let rackGltf: any = null;
  try {
    rackGltf = useGLTF('/models/thrift-store-rack.glb');
  } catch (err) {
    console.warn('Thrift rack model fallback:', err);
  }

  const clonedRack = useMemo(() => {
    if (!rackGltf?.scene) return null;
    const clone = rackGltf.scene.clone(true);
    clone.position.set(0, -1.4, -1.2);
    clone.scale.setScalar(1.2);
    
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [rackGltf]);

  useFrame((state, delta) => {
    if (!active || !groupRef.current) return;
    // Subtle ambient breath
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 3D Physical Store & Clothing Rack Model */}
      {clonedRack ? (
        <primitive object={clonedRack} />
      ) : (
        /* Procedural Clothing Rack Fallback */
        <group position={[0, -1.2, 0]}>
          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[12, 12]} />
            <meshStandardMaterial color="#141518" roughness={0.8} />
          </mesh>
          {/* Main Metal Rail */}
          <mesh position={[0, 1.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 4.5, 16]} />
            <meshStandardMaterial color="#383A40" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Stand Legs */}
          <mesh position={[-2.2, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.8, 16]} />
            <meshStandardMaterial color="#383A40" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[2.2, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.8, 16]} />
            <meshStandardMaterial color="#383A40" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Interactive Raycastable Garments on Display */}
      {MARKETPLACE_ITEMS.map((item) => {
        const isSelected = selectedGarmentId === item.id;
        const isHovered = hoveredId === item.id;

        return (
          <group
            key={item.id}
            position={item.position}
            rotation={item.rotation}
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick();
              onSelectGarment(item);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId(item.id);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHoveredId(null);
              document.body.style.cursor = 'auto';
            }}
          >
            {/* Garment Geometry Representation */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.7, 1.2, 0.2]} />
              <meshStandardMaterial
                color={isSelected ? '#A82222' : isHovered ? '#D33F3F' : '#2A303C'}
                roughness={0.6}
                metalness={0.1}
              />
            </mesh>

            {/* Hanger Hook */}
            <mesh position={[0, 0.75, 0]}>
              <torusGeometry args={[0.1, 0.015, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#C95F12" metalness={0.9} />
            </mesh>

            {/* 3D Price Beacon Tag */}
            <group position={[0, -0.75, 0.15]}>
              <mesh>
                <planeGeometry args={[0.65, 0.22]} />
                <meshBasicMaterial color="#1E1F22" />
              </mesh>
              {/* Highlight border */}
              <mesh position={[0, 0, 0.001]}>
                <ringGeometry args={[0.3, 0.32, 4]} />
                <meshBasicMaterial color={isSelected ? '#A82222' : '#F7F5F0'} />
              </mesh>
            </group>

            {/* Active Spotlight */}
            {(isSelected || isHovered) && (
              <pointLight
                position={[0, 1, 0.6]}
                color="#A82222"
                intensity={1.8}
                distance={3}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

useGLTF.preload('/models/thrift-store-rack.glb');
