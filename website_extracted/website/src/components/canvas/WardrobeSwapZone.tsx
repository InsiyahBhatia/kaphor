import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { sound } from '../../utils/audio';

interface WardrobeSwapZoneProps {
  active: boolean;
  onSwapCompleted?: () => void;
}

export function WardrobeSwapZone({ active, onSwapCompleted }: WardrobeSwapZoneProps) {
  const [swapped, setSwapped] = useState(false);
  const swapProgress = useRef(0);
  const isAnimating = useRef(false);

  // Load the blue shirt model provided by the user
  let blueShirtGltf: any = null;
  try {
    blueShirtGltf = useGLTF('/models/swap-shirt-blue.glb');
  } catch (e) {
    console.warn('Swap blue shirt fallback:', e);
  }

  const podAGroup = useRef<THREE.Group>(null);
  const podBGroup = useRef<THREE.Group>(null);

  const triggerSwap = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    sound.playSwap();
  };

  useFrame((state, delta) => {
    if (!active) return;

    if (isAnimating.current) {
      swapProgress.current += delta * 1.5;
      if (swapProgress.current >= 1) {
        swapProgress.current = 1;
        isAnimating.current = false;
        setSwapped((prev) => !prev);
        swapProgress.current = 0;
        sound.playClick();
        onSwapCompleted?.();
      }
    }

    // Parabolic Arc Math:
    // Pod A is at [-2.2, 0, 0]
    // Pod B is at [2.2, 0, 0]
    const p = swapProgress.current;
    const arcY = Math.sin(p * Math.PI) * 1.8; // Peak height in air

    if (podAGroup.current && podBGroup.current) {
      if (isAnimating.current) {
        // Item A travels from -2.2 to +2.2 (or reverse if already swapped)
        const startXA = swapped ? 2.2 : -2.2;
        const targetXA = swapped ? -2.2 : 2.2;
        podAGroup.current.position.x = THREE.MathUtils.lerp(startXA, targetXA, p);
        podAGroup.current.position.y = arcY;
        podAGroup.current.rotation.y += delta * 5;

        // Item B travels in opposite direction
        const startXB = swapped ? -2.2 : 2.2;
        const targetXB = swapped ? 2.2 : -2.2;
        podBGroup.current.position.x = THREE.MathUtils.lerp(startXB, targetXB, p);
        podBGroup.current.position.y = arcY;
        podBGroup.current.rotation.y += delta * 5;
      } else {
        const baseXA = swapped ? 2.2 : -2.2;
        const baseXB = swapped ? -2.2 : 2.2;
        podAGroup.current.position.x = baseXA;
        podAGroup.current.position.y = Math.sin(state.clock.elapsedTime * 1.8) * 0.04;
        podBGroup.current.position.x = baseXB;
        podBGroup.current.position.y = Math.cos(state.clock.elapsedTime * 1.8) * 0.04;
      }
    }
  });

  if (!active) return null;

  return (
    <group position={[0, 0, 0]}>
      {/* POD A PEDESTAL (Left: User Closet) */}
      <group position={[-2.2, -1.2, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[1.2, 1.35, 0.25, 32]} />
          <meshStandardMaterial color="#171916" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.15, 32]} />
          <meshBasicMaterial color="#A82222" transparent opacity={0.7} />
        </mesh>
      </group>

      {/* POD B PEDESTAL (Right: Kaphor Vault) */}
      <group position={[2.2, -1.2, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[1.2, 1.35, 0.25, 32]} />
          <meshStandardMaterial color="#171916" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.15, 32]} />
          <meshBasicMaterial color="#1E3B2F" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* FLYING SWAP ITEM 1: Kaphor Denim Piece */}
      <group ref={podAGroup} position={[-2.2, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.35, 0.5, 1.1, 16]} />
          <meshStandardMaterial color="#2B3E58" roughness={0.6} />
        </mesh>
        {/* Collar tag */}
        <mesh position={[0, 0.55, 0.1]}>
          <boxGeometry args={[0.15, 0.12, 0.04]} />
          <meshStandardMaterial color="#A82222" />
        </mesh>
      </group>

      {/* FLYING SWAP ITEM 2: User-Provided Blue Shirt Model */}
      <group ref={podBGroup} position={[2.2, 0, 0]}>
        {blueShirtGltf?.scene ? (
          <primitive object={blueShirtGltf.scene.clone(true)} scale={1.8} />
        ) : (
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.45, 1.0, 16]} />
            <meshStandardMaterial color="#1C2B4A" roughness={0.5} metalness={0.2} />
          </mesh>
        )}
      </group>

      {/* Central 3D Interactive Swap Terminal */}
      <group position={[0, -0.6, 0.5]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            triggerSwap();
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <boxGeometry args={[1.4, 0.4, 0.1]} />
          <meshStandardMaterial color="#A82222" roughness={0.3} metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload('/models/swap-shirt-blue.glb');
