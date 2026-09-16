import React from 'react';
import { ZoneId, RackGarment } from '../../types';
import { AlertCircle, Sparkles, RefreshCw, ShoppingBag, ShieldCheck, Box } from 'lucide-react';
import { sound } from '../../utils/audio';

interface ZoneDossierProps {
  zone: ZoneId;
  isWireframe: boolean;
  onToggleWireframe: () => void;
  equippedCount: number;
  selectedRackGarment: RackGarment | null;
  onBuyRackGarment: (garment: RackGarment) => void;
}

export function ZoneDossier({
  zone,
  isWireframe,
  onToggleWireframe,
  equippedCount,
  selectedRackGarment,
  onBuyRackGarment
}: ZoneDossierProps) {
  return (
    <div className="hud-panel p-5 max-w-sm pointer-events-auto border border-border-brutal text-cream font-mono shadow-brutal transition-all duration-300">
      {/* ZONE 1: STUDIO */}
      {zone === 'studio' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border-brutal pb-2">
            <span className="text-xs uppercase tracking-widest text-text-muted">DOSSIER / 001</span>
            <span className="text-xs bg-crimson px-2 py-0.5 text-white font-semibold">ORIGINAL HERO</span>
          </div>
          <h2 className="font-bebas text-3xl tracking-wide text-cream">ARCHIVE DENIM JACKET</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            Floating in high-fidelity dark studio. Real-time physical Three.js mesh with dynamic PBR lighting.
          </p>
          <div className="p-2.5 bg-black/40 border border-white/10 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">INTERACTION:</span>
              <span className="text-cream">DRAG MESH TO ROTATE 360°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">PARALLAX:</span>
              <span className="text-cream">ACTIVE GYROSCOPIC TILT</span>
            </div>
          </div>
        </div>
      )}

      {/* ZONE 2: AI SCAN */}
      {zone === 'inspection' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border-brutal pb-2">
            <span className="text-xs uppercase tracking-widest text-text-muted">DOSSIER / 002</span>
            <span className="text-xs bg-crimson px-2 py-0.5 text-white flex items-center gap-1 font-bold animate-pulse">
              <AlertCircle size={12} /> SCANNING
            </span>
          </div>
          <h2 className="font-bebas text-3xl tracking-wide text-cream">AI VOLUMETRIC SCAN</h2>
          
          <div className="p-3 bg-crimson/15 border border-crimson/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-crimson-light">
              <span>DEFECT DETECTED:</span>
              <span>97.4% CONFIDENCE</span>
            </div>
            <p className="text-xs text-cream/90 font-mono">
              Minor seam tension loosening on right lapel stitch. Structurally sound.
            </p>
            <div className="flex justify-between text-[11px] text-text-muted border-t border-crimson/20 pt-1">
              <span>ESTIMATED GRADE:</span>
              <span className="text-white font-bold">A- (EXCELLENT)</span>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playToggle();
              onToggleWireframe();
            }}
            className="w-full py-2 bg-charcoal hover:bg-crimson border border-border-brutal text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
          >
            <Box size={14} />
            {isWireframe ? 'RESTORE PBR SURFACE' : 'DIGITAL TWIN (WIREFRAME)'}
          </button>
        </div>
      )}

      {/* ZONE 3: STYLING */}
      {zone === 'styling' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border-brutal pb-2">
            <span className="text-xs uppercase tracking-widest text-text-muted">DOSSIER / 003</span>
            <span className="text-xs bg-gold px-2 py-0.5 text-black font-bold">STYLE MATRIX</span>
          </div>
          <h2 className="font-bebas text-3xl tracking-wide text-cream">AI OUTFIT COMPOSER</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            Click floating 3D accessories in physical space to dock or undock them from the outfit.
          </p>

          <div className="p-2.5 bg-black/40 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-muted">OUTFIT HARMONY:</span>
              <span className="text-gold font-bold text-sm">
                {equippedCount === 0 ? '78%' : equippedCount === 1 ? '86%' : equippedCount === 2 ? '94%' : '98% MATCH'}
              </span>
            </div>
            <div className="w-full bg-white/10 h-1.5 overflow-hidden">
              <div
                className="bg-gold h-full transition-all duration-500"
                style={{
                  width: equippedCount === 0 ? '78%' : equippedCount === 1 ? '86%' : equippedCount === 2 ? '94%' : '98%'
                }}
              />
            </div>
          </div>

          <div className="text-[11px] text-text-muted">
            EQUIPPED: <span className="text-cream font-bold">{equippedCount} OF 3 ITEMS DOCKED</span>
          </div>
        </div>
      )}

      {/* ZONE 4: SWAP */}
      {zone === 'swap' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border-brutal pb-2">
            <span className="text-xs uppercase tracking-widest text-text-muted">DOSSIER / 004</span>
            <span className="text-xs bg-forest px-2 py-0.5 text-white font-bold">CIRCULAR PROTOCOL</span>
          </div>
          <h2 className="font-bebas text-3xl tracking-wide text-cream">3D PHYSICAL WARDROBE SWAP</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            Pod A (Your Closet) vs Pod B (Kaphor Vault). Physical parabolic projectile translation across 3D space.
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 bg-black/40 border border-crimson/30">
              <div className="text-crimson font-bold">POD A (OUTGOING)</div>
              <div className="text-cream">Hero Jacket</div>
              <div className="text-text-muted text-[10px]">Value: ₹2,400</div>
            </div>
            <div className="p-2 bg-black/40 border border-forest/30">
              <div className="text-forest font-bold">POD B (INCOMING)</div>
              <div className="text-cream">Archival Blue Shirt</div>
              <div className="text-text-muted text-[10px]">Value: ₹2,200</div>
            </div>
          </div>
        </div>
      )}

      {/* ZONE 5: MARKETPLACE */}
      {zone === 'marketplace' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border-brutal pb-2">
            <span className="text-xs uppercase tracking-widest text-text-muted">DOSSIER / 005</span>
            <span className="text-xs bg-cream text-black px-2 py-0.5 font-bold">THRIFT SHOWROOM</span>
          </div>

          {selectedRackGarment ? (
            <div className="space-y-2">
              <h3 className="font-bebas text-2xl text-cream tracking-wide">{selectedRackGarment.title}</h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">{selectedRackGarment.brand}</span>
                <span className="text-crimson font-bold">₹{selectedRackGarment.price}</span>
              </div>
              <div className="p-2 bg-black/40 border border-white/10 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">CONDITION:</span>
                  <span className="text-cream font-bold">{selectedRackGarment.condition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">CO2 SAVED:</span>
                  <span className="text-forest font-bold">{selectedRackGarment.co2SavedKg} kg</span>
                </div>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  onBuyRackGarment(selectedRackGarment);
                }}
                className="w-full py-2 bg-crimson hover:bg-crimson-dark text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingBag size={14} /> BUY NOW — ₹{selectedRackGarment.price}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="font-bebas text-2xl text-cream">SELECT A RACK GARMENT</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Click any garment hanging on the 3D rails to pull the camera forward and inspect condition and verified pricing.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ZONE 6: ECOSYSTEM */}
      {zone === 'ecosystem' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border-brutal pb-2">
            <span className="text-xs uppercase tracking-widest text-text-muted">DOSSIER / 006</span>
            <span className="text-xs bg-crimson px-2 py-0.5 text-white font-bold">INFINITE GALAXY</span>
          </div>
          <h2 className="font-bebas text-3xl tracking-wide text-cream">CIRCULAR RECIRCULATION</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            One garment multiplies into thousands across the Kaphor ecosystem. Powered by WebGL InstancedMesh for zero frame drops.
          </p>
          <div className="p-2.5 bg-black/40 border border-white/10 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">TOTAL RECIRCULATED:</span>
              <span className="text-cream font-bold">1,240+ PIECES</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">ACTIVE PEER TRADES:</span>
              <span className="text-gold font-bold">342 LIVE SWAPS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
