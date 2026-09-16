import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { sound } from '../../utils/audio';

interface HeroJacketProps {
  isScanning: boolean;
  isWireframe: boolean;
  onSelect?: () => void;
  showDefect: boolean;
}

export function HeroJacket({
  isScanning,
  isWireframe,
  onSelect,
  showDefect
}: HeroJacketProps) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  
  // Drag-to-rotate state
  const isDragging = useRef(false);
  const previousPointerX = useRef(0);
  const previousPointerY = useRef(0);
  const rotationVelocityY = useRef(0.003); // Initial slow spin
  const rotationVelocityX = useRef(0);

  const [hovered, setHovered] = useState(false);

  // Load the Giacca model from public/models/
  let gltf: any = null;
  try {
    gltf = useGLTF('/models/hero-jacket.glb');
  } catch (err) {
    console.warn('Hero jacket model fallback active:', err);
  }

  // Clone scene so we can modify materials without side effects
  const clonedScene = useMemo(() => {
    if (!gltf?.scene) return null;
    const clone = gltf.scene.clone(true);
    
    // Compute bounding box to center and normalize scale
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Center geometry
    clone.position.x = -center.x;
    clone.position.y = -center.y + 0.1;
    clone.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetScale = maxDim > 0 ? 2.2 / maxDim : 1;
    clone.scale.setScalar(targetScale);

    // Apply materials
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
          mat.roughness = 0.65;
          mat.metalness = 0.15;
          mat.envMapIntensity = 1.2;
        }
      }
    });

    return clone;
  }, [gltf]);

  // Handle pointer drag for full 3D rotation
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current = true;
    previousPointerX.current = e.clientX;
    previousPointerY.current = e.clientY;
    rotationVelocityY.current = 0;
    rotationVelocityX.current = 0;
    sound.playClick();
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current || !groupRef.current) return;
    const deltaX = e.clientX - previousPointerX.current;
    const deltaY = e.clientY - previousPointerY.current;
    
    previousPointerX.current = e.clientX;
    previousPointerY.current = e.clientY;

    groupRef.current.rotation.y += deltaX * 0.008;
    groupRef.current.rotation.x += deltaY * 0.004;

    // Constrain pitch to avoid upside down disorientation
    groupRef.current.rotation.x = THREE.MathUtils.clamp(
      groupRef.current.rotation.x,
      -Math.PI / 4,
      Math.PI / 4
    );

    rotationVelocityY.current = deltaX * 0.008;
    rotationVelocityX.current = deltaY * 0.004;
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Apply inertia and damping when not dragging
    if (!isDragging.current) {
      groupRef.current.rotation.y += rotationVelocityY.current;
      groupRef.current.rotation.x += rotationVelocityX.current;
      
      // Gradually decay custom velocity back to slow ambient idle spin
      rotationVelocityY.current = THREE.MathUtils.lerp(rotationVelocityY.current, 0.002, 0.05);
      rotationVelocityX.current = THREE.MathUtils.lerp(rotationVelocityX.current, 0, 0.05);
    }

    // Gentle vertical levitation float
    const floatOffset = Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
    groupRef.current.position.y = floatOffset;

    // Dynamic material switching for digital twin / wireframe
    if (clonedScene) {
      clonedScene.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) {
            mat.wireframe = isWireframe;
            if (isWireframe) {
              mat.color.setHex(0xA82222);
              mat.emissive.setHex(0x3A0808);
            } else if (hovered) {
              mat.color.setHex(0xE5E0D8);
            } else {
              mat.color.setHex(0xFFFFFF);
              mat.emissive.setHex(0x000000);
            }
          }
        }
      });
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* 3D Garment Model or Procedural Fallback */}
      <group ref={modelRef}>
        {clonedScene ? (
          <primitive object={clonedScene} />
        ) : (
          /* Procedural high-poly jacket fallback if file is reading */
          <group position={[0, 0, 0]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.55, 0.7, 1.4, 32]} />
              <meshStandardMaterial
                color={isWireframe ? '#A82222' : '#2A3B50'}
                wireframe={isWireframe}
                roughness={0.7}
              />
            </mesh>
            {/* Sleeves */}
            <mesh position={[-0.75, 0.1, 0]} rotation={[0, 0, 0.4]} castShadow>
              <cylinderGeometry args={[0.18, 0.22, 1.1, 16]} />
              <meshStandardMaterial
                color={isWireframe ? '#A82222' : '#2A3B50'}
                wireframe={isWireframe}
              />
            </mesh>
            <mesh position={[0.75, 0.1, 0]} rotation={[0, 0, -0.4]} castShadow>
              <cylinderGeometry args={[0.18, 0.22, 1.1, 16]} />
              <meshStandardMaterial
                color={isWireframe ? '#A82222' : '#2A3B50'}
                wireframe={isWireframe}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* 3D SPATIAL DEFECT MARKER: Locked directly to garment local coordinate! */}
      {showDefect && (
        <group position={[0.26, 0.35, 0.25]}>
          {/* Pulsing Target Ring */}
          <mesh>
            <ringGeometry args={[0.04, 0.055, 32]} />
            <meshBasicMaterial color="#A82222" side={THREE.DoubleSide} />
          </mesh>
          {/* Glowing Center Dot */}
          <mesh>
            <sphereGeometry args={[0.02, 16, 16]} />
            <meshBasicMaterial color="#FF3B30" />
          </mesh>
          {/* Spatial Pointer Stem */}
          <line>
            <bufferGeometry
              attach="geometry"
              onUpdate={(geo) => {
                const points = [
                  new THREE.Vector3(0, 0, 0),
                  new THREE.Vector3(0.12, 0.15, 0.1)
                ];
                geo.setFromPoints(points);
              }}
            />
            <lineBasicMaterial color="#A82222" linewidth={2} />
          </line>
          {/* Spatial 3D Callout Plaque */}
          <group position={[0.14, 0.17, 0.1]}>
            <mesh>
              <planeGeometry args={[0.38, 0.14]} />
              <meshBasicMaterial color="#171916" transparent opacity={0.92} />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <ringGeometry args={[0.18, 0.19, 4]} />
              <meshBasicMaterial color="#A82222" />
            </mesh>
          </group>
        </group>
      )}

      {/* Subtle Ground Contact Shadow */}
      <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.9, 32]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload('/models/hero-jacket.glb');
