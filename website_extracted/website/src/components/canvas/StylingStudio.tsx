import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sound } from '../../utils/audio';

export interface AccessoryState {
  id: string;
  name: string;
  category: 'sunglasses' | 'bag' | 'sneakers';
  isEquipped: boolean;
  orbitPos: [number, number, number];
  dockPos: [number, number, number];
  rotation: [number, number, number];
}

interface StylingStudioProps {
  active: boolean;
  onToggleAccessory: (id: string, equipped: boolean) => void;
  equippedItems: Record<string, boolean>;
}

export function StylingStudio({ active, onToggleAccessory, equippedItems }: StylingStudioProps) {
  if (!active) return null;

  return (
    <group>
      {/* 1. SUNGLASSES */}
      <AccessoryItem
        id="sunglasses"
        name="Tortoise Polarized Frames"
        isEquipped={!!equippedItems['sunglasses']}
        orbitPos={[-1.6, 0.7, 0.5]}
        dockPos={[0, 0.65, 0.35]}
        rotation={[0, 0, 0]}
        onToggle={() => onToggleAccessory('sunglasses', !equippedItems['sunglasses'])}
        renderGeometry={() => (
          <group scale={0.4}>
            {/* Sunglasses frame */}
            <mesh castShadow>
              <boxGeometry args={[1.2, 0.35, 0.1]} />
              <meshStandardMaterial color="#1E1F22" roughness={0.2} metalness={0.8} />
            </mesh>
            {/* Lenses */}
            <mesh position={[-0.32, 0, 0.04]}>
              <boxGeometry args={[0.42, 0.26, 0.05]} />
              <meshStandardMaterial color="#0A0A0C" roughness={0.1} metalness={0.9} />
            </mesh>
            <mesh position={[0.32, 0, 0.04]}>
              <boxGeometry args={[0.42, 0.26, 0.05]} />
              <meshStandardMaterial color="#0A0A0C" roughness={0.1} metalness={0.9} />
            </mesh>
            {/* Temples */}
            <mesh position={[-0.58, 0, -0.35]} rotation={[0, -0.2, 0]}>
              <boxGeometry args={[0.08, 0.12, 0.7]} />
              <meshStandardMaterial color="#A82222" metalness={0.5} />
            </mesh>
            <mesh position={[0.58, 0, -0.35]} rotation={[0, 0.2, 0]}>
              <boxGeometry args={[0.08, 0.12, 0.7]} />
              <meshStandardMaterial color="#A82222" metalness={0.5} />
            </mesh>
          </group>
        )}
      />

      {/* 2. LEATHER TOTE BAG */}
      <AccessoryItem
        id="bag"
        name="Vintage Cognac Leather Tote"
        isEquipped={!!equippedItems['bag']}
        orbitPos={[1.8, -0.2, 0.4]}
        dockPos={[0.85, -0.4, 0.1]}
        rotation={[0, -0.3, 0]}
        onToggle={() => onToggleAccessory('bag', !equippedItems['bag'])}
        renderGeometry={() => (
          <group scale={0.45}>
            {/* Bag body */}
            <mesh castShadow>
              <boxGeometry args={[0.85, 0.95, 0.38]} />
              <meshStandardMaterial color="#6E3A1A" roughness={0.5} metalness={0.15} />
            </mesh>
            {/* Handle straps */}
            <mesh position={[0, 0.65, 0]}>
              <torusGeometry args={[0.3, 0.035, 12, 24, Math.PI]} />
              <meshStandardMaterial color="#4A2610" roughness={0.4} />
            </mesh>
            {/* Brass Clasp */}
            <mesh position={[0, 0.25, 0.2]}>
              <boxGeometry args={[0.12, 0.12, 0.05]} />
              <meshStandardMaterial color="#C95F12" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        )}
      />

      {/* 3. RETRO CHUNKY SNEAKERS */}
      <AccessoryItem
        id="sneakers"
        name="Kaphor Re-Craft Lows"
        isEquipped={!!equippedItems['sneakers']}
        orbitPos={[-1.7, -0.8, 0.3]}
        dockPos={[-0.3, -1.15, 0.2]}
        rotation={[0, 0.4, 0]}
        onToggle={() => onToggleAccessory('sneakers', !equippedItems['sneakers'])}
        renderGeometry={() => (
          <group scale={0.42}>
            {/* Sole */}
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.42, 0.18, 1.05]} />
              <meshStandardMaterial color="#F7F5F0" roughness={0.6} />
            </mesh>
            {/* Upper */}
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[0.38, 0.3, 0.95]} />
              <meshStandardMaterial color="#1E1F22" roughness={0.7} />
            </mesh>
            {/* Crimson side stripe */}
            <mesh position={[0.2, 0.08, 0]}>
              <boxGeometry args={[0.02, 0.08, 0.6]} />
              <meshStandardMaterial color="#A82222" roughness={0.4} />
            </mesh>
          </group>
        )}
      />
    </group>
  );
}

function AccessoryItem({
  id,
  name,
  isEquipped,
  orbitPos,
  dockPos,
  rotation,
  onToggle,
  renderGeometry
}: {
  id: string;
  name: string;
  isEquipped: boolean;
  orbitPos: [number, number, number];
  dockPos: [number, number, number];
  rotation: [number, number, number];
  onToggle: () => void;
  renderGeometry: () => JSX.Element;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Smooth translation between orbit dock and equipped body coordinate
    const targetPos = isEquipped ? dockPos : orbitPos;
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetPos[0], delta * 4);
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetPos[1] + (isEquipped ? 0 : Math.sin(state.clock.elapsedTime * 2 + (id === 'bag' ? 1 : 2)) * 0.05),
      delta * 4
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetPos[2], delta * 4);

    // Rotation
    if (!isEquipped) {
      groupRef.current.rotation.y += delta * 0.4;
    } else {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation[1], delta * 4);
    }
  });

  return (
    <group
      ref={groupRef}
      position={orbitPos}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        sound.playSwap();
        onToggle();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {renderGeometry()}

      {/* Floating Selection Beacon */}
      {!isEquipped && (
        <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.25, 32]} />
          <meshBasicMaterial
            color={hovered ? '#F7F5F0' : '#A82222'}
            transparent
            opacity={hovered ? 0.9 : 0.4}
          />
        </mesh>
      )}
    </group>
  );
}
