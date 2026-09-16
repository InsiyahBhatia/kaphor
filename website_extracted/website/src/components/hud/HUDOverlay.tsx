import React from 'react';
import { ZoneId, RackGarment } from '../../types';
import { ZoneDossier } from './ZoneDossier';
import { Volume2, VolumeX, ArrowRight, RefreshCw, Compass } from 'lucide-react';
import { sound } from '../../utils/audio';

interface HUDOverlayProps {
  zone: ZoneId;
  onSetZone: (zone: ZoneId) => void;
  isWireframe: boolean;
  onToggleWireframe: () => void;
  equippedItems: Record<string, boolean>;
  selectedRackGarment: RackGarment | null;
  onBuyRackGarment: (garment: RackGarment) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const ZONES: { id: ZoneId; label: string; num: string }[] = [
  { id: 'studio', label: 'DARK STUDIO', num: '01' },
  { id: 'inspection', label: 'AI SCAN & TWIN', num: '02' },
  { id: 'styling', label: '3D STYLING LAB', num: '03' },
  { id: 'swap', label: 'WARDROBE SWAP', num: '04' },
  { id: 'marketplace', label: 'THRIFT RACK', num: '05' },
  { id: 'ecosystem', label: 'GALAXY', num: '06' },
];

export function HUDOverlay({
  zone,
  onSetZone,
  isWireframe,
  onToggleWireframe,
  equippedItems,
  selectedRackGarment,
  onBuyRackGarment,
  soundEnabled,
  onToggleSound
}: HUDOverlayProps) {
  const equippedCount = Object.values(equippedItems).filter(Boolean).length;

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 select-none font-mono">
      {/* TOP BAR */}
      <header className="flex items-center justify-between pointer-events-auto">
        {/* Brandmark */}
        <div className="flex items-center gap-4">
          <div className="border border-cream/20 bg-charcoal/80 backdrop-blur-md px-4 py-2 flex items-center gap-3 shadow-brutal">
            <span className="w-2.5 h-2.5 bg-crimson rounded-none animate-pulse" />
            <h1 className="font-bebas text-2xl tracking-widest text-cream">KAPHOR</h1>
            <span className="text-[10px] text-text-muted border-l border-white/20 pl-3 uppercase">
              3D Fashion World
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px] text-text-muted bg-black/60 px-3 py-2 border border-white/10">
            <Compass size={13} className="text-crimson" />
            <span>SIGNAL: ACTIVE</span>
            <span className="text-white/30">|</span>
            <span className="text-cream uppercase">MODE: {zone}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              onToggleSound();
              sound.playClick();
            }}
            className="hud-panel px-3 py-2 text-xs flex items-center gap-2 hover:bg-crimson hover:border-crimson transition-colors text-cream"
            title="Toggle Sound Effects"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="hidden sm:inline">{soundEnabled ? 'SOUND ON' : 'MUTED'}</span>
          </button>
        </div>
      </header>

      {/* MIDDLE SECTION: Floating Telemetry Dossier on the Left */}
      <div className="flex items-center justify-between my-auto">
        <div className="pointer-events-auto max-w-sm">
          <ZoneDossier
            zone={zone}
            isWireframe={isWireframe}
            onToggleWireframe={onToggleWireframe}
            equippedCount={equippedCount}
            selectedRackGarment={selectedRackGarment}
            onBuyRackGarment={onBuyRackGarment}
          />
        </div>

        {/* Center Prompt Guidance (Subtle) */}
        <div className="hidden lg:block text-center text-xs text-text-muted/60 pointer-events-none tracking-widest uppercase">
          {zone === 'studio' && 'Drag 3D garment to spin • Scroll or click tabs to explore'}
          {zone === 'inspection' && 'Volumetric scanner active • 3D defect pinned to lapel'}
          {zone === 'styling' && 'Click 3D accessories in space to snap onto outfit'}
          {zone === 'swap' && 'Click SWAP NOW in dossier to launch physical 3D trade'}
          {zone === 'marketplace' && 'Click garments on the 3D rail to zoom camera'}
          {zone === 'ecosystem' && 'Pull back into the infinite circular constellation'}
        </div>
      </div>

      {/* BOTTOM BAR: Brutalist Zone Switcher Dock */}
      <footer className="pointer-events-auto flex flex-col items-center gap-3">
        {/* Navigation Dock */}
        <div className="hud-panel p-1.5 flex flex-wrap items-center justify-center gap-1 shadow-brutal border border-border-brutal max-w-full">
          {ZONES.map((z) => {
            const isActive = zone === z.id;
            return (
              <button
                key={z.id}
                onClick={() => {
                  sound.playClick();
                  onSetZone(z.id);
                }}
                className={`px-3 py-2 text-xs font-mono tracking-wider transition-all flex items-center gap-2 border ${
                  isActive
                    ? 'bg-crimson text-white border-crimson shadow-brutal-crimson font-bold'
                    : 'bg-charcoal/80 text-text-muted hover:text-cream hover:bg-white/5 border-transparent'
                }`}
              >
                <span className={`text-[10px] ${isActive ? 'text-white' : 'text-crimson'}`}>
                  {z.num}
                </span>
                <span>{z.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer Credit & Status */}
        <div className="text-[10px] text-text-muted tracking-widest uppercase flex items-center gap-3">
          <span>KAPHOR INTELLIGENCE PLATFORM</span>
          <span>•</span>
          <span>REAL-TIME THREE.JS WEBGL VIEWPORT</span>
        </div>
      </footer>
    </div>
  );
}
