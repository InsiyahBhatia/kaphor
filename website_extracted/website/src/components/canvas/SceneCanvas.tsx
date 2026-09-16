import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { HeroJacket } from './HeroJacket';
import { AIScanningRig } from './AIScanningRig';
import { StylingStudio } from './StylingStudio';
import { WardrobeSwapZone } from './WardrobeSwapZone';
import { ThriftShowroom } from './ThriftShowroom';
import { EcosystemGalaxy } from './EcosystemGalaxy';
import { StudioEnvironment } from './StudioEnvironment';
import { CameraController } from './CameraController';
import { ZoneId, RackGarment } from '../../types';

interface SceneCanvasProps {
  zone: ZoneId;
  mousePos: { x: number; y: number };
  isWireframe: boolean;
  onToggleWireframe: () => void;
  equippedItems: Record<string, boolean>;
  onToggleAccessory: (id: string, equipped: boolean) => void;
  onSelectRackGarment: (garment: RackGarment) => void;
  selectedRackGarmentId: string | null;
}

export function SceneCanvas({
  zone,
  mousePos,
  isWireframe,
  onToggleWireframe,
  equippedItems,
  onToggleAccessory,
  onSelectRackGarment,
  selectedRackGarmentId
}: SceneCanvasProps) {
  const isJacketVisible = zone === 'studio' || zone === 'inspection' || zone === 'styling';
  const isScanningActive = zone === 'inspection';
  const isStylingActive = zone === 'styling';
  const isSwapActive = zone === 'swap';
  const isMarketplaceActive = zone === 'marketplace';
  const isEcosystemActive = zone === 'ecosystem';

  return (
    <div className="fixed inset-0 w-screen h-screen z-0 bg-[#0F0F11] overflow-hidden select-none">
      <Canvas
        shadows
        camera={{ position: [0, 0.2, 4], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          {/* Lighting & Particle Environment */}
          <StudioEnvironment />

          {/* Smooth Cinematic Camera Orbit & Parallax */}
          <CameraController zone={zone} mousePos={mousePos} />

          {/* ZONE 1 & 2: HERO JACKET (Raycast Drag-to-Rotate + Spatial Defect Marker) */}
          {isJacketVisible && (
            <HeroJacket
              isScanning={isScanningActive}
              isWireframe={isWireframe}
              onSelect={onToggleWireframe}
              showDefect={zone === 'inspection'}
            />
          )}

          {/* ZONE 2: 3D VERTICAL LASER SCANNING RIG */}
          <AIScanningRig active={isScanningActive} />

          {/* ZONE 3: 3D ACCESSORY STYLING LAB */}
          <StylingStudio
            active={isStylingActive}
            equippedItems={equippedItems}
            onToggleAccessory={onToggleAccessory}
          />

          {/* ZONE 4A: 3D WARDROBE PHYSICAL SWAP ANIMATION */}
          <WardrobeSwapZone active={isSwapActive} />

          {/* ZONE 4B: 3D THRIFT SHOWROOM & RACK WALKTHROUGH */}
          <ThriftShowroom
            active={isMarketplaceActive}
            onSelectGarment={onSelectRackGarment}
            selectedGarmentId={selectedRackGarmentId}
          />

          {/* ZONE 5: INFINITE INSTANCED ECOSYSTEM GALAXY */}
          <EcosystemGalaxy active={isEcosystemActive} />
        </Suspense>
      </Canvas>
    </div>
  );
}
