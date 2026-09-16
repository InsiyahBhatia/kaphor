import React, { Suspense, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Sparkles as DreiSparkles,
  ContactShadows
} from '@react-three/drei';
import * as THREE from 'three';
import {
  Volume2,
  VolumeX,
  ArrowUpRight,
  RefreshCw,
  Layers,
  CheckCircle2,
  Scan,
  ShoppingBag,
  ArrowLeftRight,
  Calendar,
  DollarSign,
  Droplets,
  Leaf,
  ShieldCheck,
  ChevronDown,
  Clock,
  Shirt,
  Footprints
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Preload 100% authentic photorealistic GLB models
useGLTF.preload('/models/street-hoodie.glb');
useGLTF.preload('/models/retro-sneaker.glb');
useGLTF.preload('/models/handbag.glb');

// Sound Manager matching Kaphor App Haptics & Crazy Telemetry Audio
class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  click() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, this.ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch { }
  }

  scanPulse(freq: number = 880) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch { }
  }

  fanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 triumphant chord
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        const start = this.ctx!.currentTime + idx * 0.08;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch { }
  }

  success() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);
    } catch { }
  }
}

const sfx = new SoundFX();

export type ClosetItemType = 'hoodie' | 'sneaker' | 'bag';

interface PlayingCardDossier {
  id: ClosetItemType;
  rank: string;
  suit: '♠' | '♥' | '♦' | '♣';
  name: string;
  category: string;
  type: 'apparel' | 'accessory';
  brand: string;
  originalPrice: string;
  thriftPrice: string;
  thriftPriceNum: number;
  leasePrice: string;
  conditionGrade: string;
  matchPercent: number;
  defectNote: string;
  co2Saved: string;
  waterSaved: string;
  flavorText: string;
  modelUrl: string;
}

const CLOSET_PLAYING_CARDS: Record<ClosetItemType, PlayingCardDossier> = {
  hoodie: {
    id: 'hoodie',
    rank: 'K',
    suit: '♦',
    name: 'Heavyweight Fleece Streetwear Hoodie',
    category: 'Archival Luxury Streetwear',
    type: 'apparel',
    brand: 'Kaphor Essentials Studio',
    originalPrice: '₹4,800',
    thriftPrice: '₹1,299',
    thriftPriceNum: 1299,
    leasePrice: '₹299 / day',
    conditionGrade: 'A- (Excellent)',
    matchPercent: 96,
    defectNote: 'Micro-fraying along right sleeve cuff seam (15-min hand stitch guide generated). 450 GSM French Terry cotton structure fully intact.',
    co2Saved: '14.2 kg CO₂e',
    waterSaved: '2,700 L',
    flavorText: 'Custom oversized drape with heavyweight kangaroo pocket and drop shoulders. Perfect for everyday thrift rotation.',
    modelUrl: '/models/street-hoodie.glb'
  },
  sneaker: {
    id: 'sneaker',
    rank: '10',
    suit: '♦',
    name: 'Retro Leather Court Sneaker',
    category: 'Archival Footwear Grail',
    type: 'accessory',
    brand: 'Heritage Court Lab',
    originalPrice: '₹9,999',
    thriftPrice: '₹2,499',
    thriftPriceNum: 2499,
    leasePrice: '₹349 / day',
    conditionGrade: 'A (Near Pristine)',
    matchPercent: 95,
    defectNote: 'Zero toe-box creasing; minimal outsole patina. Verified factory double-needle stitching and authenticated leather collar.',
    co2Saved: '18.5 kg CO₂e',
    waterSaved: '4,100 L',
    flavorText: 'Archival low-top court sneaker. Full-grain calfskin leather, padded collar, and verified serial stamping. Ready for direct parity barter.',
    modelUrl: '/models/retro-sneaker.glb'
  },
  bag: {
    id: 'bag',
    rank: 'Q',
    suit: '♥',
    name: 'Structured Minimalist Saffiano Tote',
    category: 'Archival Luxury Leather Goods',
    type: 'accessory',
    brand: 'Kaphor Studio Atelier',
    originalPrice: '₹18,500',
    thriftPrice: '₹4,899',
    thriftPriceNum: 4899,
    leasePrice: '₹499 / day',
    conditionGrade: 'A+ (Mint Heirloom)',
    matchPercent: 97,
    defectNote: 'Arched kohl-gold hardware and reinforced hand-stitched handles. Saffiano cross-grain leather, zero scuffs, interior lining flawless.',
    co2Saved: '24.1 kg CO₂e',
    waterSaved: '6,200 L',
    flavorText: 'Hand-finished architectural day tote with double rolled handles and removable shoulder strap in scratch-resistant cross-grain leather.',
    modelUrl: '/models/handbag.glb'
  }
};

// ==========================================
// 3D CLOSET MODEL COMPONENT (100% REALISTIC GLBS ONLY)
// ==========================================
function ClosetPiece3D({
  itemType
}: {
  itemType: ClosetItemType;
}) {
  const meshGroupRef = useRef<THREE.Group>(null);
  const item = CLOSET_PLAYING_CARDS[itemType];
  const modelUrl = item.modelUrl;
  const gltf = useGLTF(modelUrl);

  const normalizedModel = useMemo(() => {
    if (!gltf?.scene) return null;
    const clone = gltf.scene.clone(true);

    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    let targetSize = 2.2;
    if (itemType === 'hoodie') targetSize = 2.2;
    if (itemType === 'sneaker') targetSize = 2.1;
    if (itemType === 'bag') targetSize = 1.95;

    const scale = maxDim > 0 ? targetSize / maxDim : 1;
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    if (itemType === 'sneaker') {
      clone.rotation.y = Math.PI / 4;
    } else if (itemType === 'bag') {
      clone.rotation.y = -Math.PI / 6;
    }

    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            if (mat.metalness !== undefined) mat.metalness = Math.min(mat.metalness, 0.1);
            if (mat.roughness !== undefined) mat.roughness = Math.min(Math.max(mat.roughness, 0.6), 1);
            if (mat.isMeshPhysicalMaterial) {
              mat.clearcoat = 0;
              mat.specularIntensity = Math.min(mat.specularIntensity ?? 1, 0.2);
            }
            mat.envMapIntensity = 0.4;
            mat.needsUpdate = true;
          });
        }
      }
    });

    return clone;
  }, [gltf, itemType]);

  useFrame((state) => {
    if (meshGroupRef.current) {
      meshGroupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.04;
    }
  });

  return (
    <group ref={meshGroupRef}>
      {normalizedModel && <primitive object={normalizedModel} />}

      {/* Soft Contact Shadow onto Pedestal */}
      <ContactShadows
        position={[0, -1.05, 0]}
        opacity={0.75}
        scale={3.2}
        blur={1.8}
        far={2.0}
        color="#1E1F22"
      />
    </group>
  );
}

// ==========================================
// 3D BRUTALIST CREAM STUDIO PEDESTAL
// ==========================================
function ClosetStudioPedestal() {
  return (
    <group position={[0, 0, 0]}>
      {/* Polished Warm Cream Limestone Floor */}
      <mesh position={[0, -1.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#EAE6DF"
          roughness={0.35}
          metalness={0.15}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Elevated Circular Display Pedestal */}
      <group position={[0, -1.05, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[1.25, 1.45, 64]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.44, 1.46, 64]} />
          <meshBasicMaterial color="#C9A84C" />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[1.25, 1.25, 0.12, 48]} />
          <meshStandardMaterial color="#F7F5F0" roughness={0.25} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

// ==========================================
// VERIFIED ATELIER SHIELD BADGE
// ==========================================
function VerifiedAtelierBadge({ label = 'VERIFIED ATELIER' }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-[#1E1F22] border border-[#C9A84C] px-2.5 py-1 text-[9px] font-mono font-bold tracking-[0.1em] text-[#F7F5F0] uppercase shadow-sm">
      <ShieldCheck size={12} className="text-[#C9A84C]" />
      <span>{label}</span>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function App() {
  const [selectedCardId, setSelectedCardId] = useState<ClosetItemType>('hoodie');
  const [soundOn, setSoundOn] = useState(true);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [submittedWaitlist, setSubmittedWaitlist] = useState(false);

  // Upcycling Community Showcase State
  const [skirtView, setSkirtView] = useState<'front' | 'back'>('front');
  const [selectedUpcycleItem, setSelectedUpcycleItem] = useState<string | null>(null);
  const upcycleSliderRef = useRef<HTMLDivElement>(null);
  const scrollUpcycle = (dir: 'left' | 'right') => {
    if (!upcycleSliderRef.current) return;
    sfx.click();
    upcycleSliderRef.current.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' });
  };

  // Active Category Sector Filter
  const [activeCategory, setActiveCategory] = useState('ALL');

  // Interactive Closet Calculator State (Values in ₹ INR)
  const [calcEthnic, setCalcEthnic] = useState(3);
  const [calcStreetwear, setCalcStreetwear] = useState(5);
  const [calcBags, setCalcBags] = useState(4);
  const [calcSneakers, setCalcSneakers] = useState(3);

  const estimatedValueINR = useMemo(() => {
    return calcEthnic * 4200 + calcStreetwear * 1200 + calcBags * 2500 + calcSneakers * 2200;
  }, [calcEthnic, calcStreetwear, calcBags, calcSneakers]);

  const estimatedCarbon = useMemo(() => {
    return (calcEthnic * 32.5 + calcStreetwear * 14.0 + calcBags * 24.5 + calcSneakers * 16.0).toFixed(1);
  }, [calcEthnic, calcStreetwear, calcBags, calcSneakers]);

  const estimatedWater = useMemo(() => {
    return ((calcEthnic * 6500 + calcStreetwear * 2800 + calcBags * 5400 + calcSneakers * 3800) / 1000).toFixed(1);
  }, [calcEthnic, calcStreetwear, calcBags, calcSneakers]);

  // Accessories Swap State
  const [swapAccepted, setSwapAccepted] = useState(false);

  const currentCard = CLOSET_PLAYING_CARDS[selectedCardId];
  const isRedSuit = currentCard.suit === '♥' || currentCard.suit === '♦';

  const handleSelectCard = (id: ClosetItemType) => {
    sfx.click();
    setSelectedCardId(id);
  };

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    sfx.success();
    setSubmittedWaitlist(true);
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#A82222', '#C9A84C', '#1E1F22', '#F7F5F0']
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#F7F5F0] text-[#1E1F22] font-sans selection:bg-[#A82222] selection:text-[#FFFFFF]">
      {/* ======================================================== */}
      {/* 1. SIGNATURE BRAND STATUS BAR (EXACT MATCH TO APP) */}
      {/* ======================================================== */}
      <div className="bg-[#1E1F22] text-[#F7F5F0] py-2 px-4 flex items-center justify-center gap-3 text-[10px] font-mono tracking-[0.25em] uppercase text-center overflow-hidden border-b border-[#383A40]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#A82222] animate-pulse" />
        <span className="text-[#C9A84C]">
          PRE-LOVED FASHION, VERIFIED & CIRCULATED · CLOTHES, BAGS & MORE
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#A82222] animate-pulse" />
      </div>

      {/* ======================================================== */}
      {/* 2. APP-STYLE STICKY HEADER (LIGHT CREAM) */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-50 bg-[#F7F5F0]/90 backdrop-blur-xl border-b border-[#1E1F22] px-6 sm:px-12 py-4 flex justify-between items-center transition-all">
        {/* Logo & Tagline */}
        <div className="flex items-center gap-4">
          <a href="#closet" className="flex flex-col group cursor-pointer">
            <span className="font-bebas text-3xl tracking-[0.18em] text-[#1E1F22] font-normal group-hover:text-[#A82222] transition-colors">
              KAPHOR
            </span>
            <span className="text-[8.5px] font-mono tracking-[0.28em] text-[#9A8E7E] uppercase -mt-1">
              PRE-LOVED. GREATER TOMORROWS.
            </span>
          </a>

          <div className="hidden sm:block">
            <VerifiedAtelierBadge label="ATELIER VERIFIED" />
          </div>
        </div>

        {/* Navigation Anchors */}
        <nav className="hidden lg:flex items-center gap-6 text-[11px] font-mono tracking-[0.2em] text-[#383A40] uppercase">
          <a href="#closet" className="hover:text-[#A82222] transition-colors">
            00 / THE CLOSET
          </a>
          <a href="#deck-showcase" className="hover:text-[#A82222] transition-colors">
            01 / PLAYING CARDS
          </a>
          <a href="#pillars" className="hover:text-[#A82222] transition-colors">
            02 / 4 PILLARS
          </a>
          <a href="#barter-deck" className="hover:text-[#A82222] transition-colors">
            03 / ACCESSORIES BARTER
          </a>
          <a href="#atelier-repair" className="hover:text-[#A82222] transition-colors">
            04 / RESTORATION ATELIER
          </a>
          <a href="#calculator" className="hover:text-[#A82222] transition-colors">
            05 / CLOSET AUDIT
          </a>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSoundOn((prev) => {
                sfx.enabled = !prev;
                return !prev;
              });
              sfx.click();
            }}
            className="w-9 h-9 border border-[#1E1F22] bg-[#FFFFFF] flex items-center justify-center text-[#1E1F22] hover:bg-[#1E1F22] hover:text-[#F7F5F0] transition-all"
            title="Toggle Haptic Sound"
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <button
            onClick={() => {
              sfx.click();
              setShowWaitlistModal(true);
            }}
            className="px-5 py-2 border border-[#A82222] bg-[#A82222] text-[#FFFFFF] text-[10px] font-mono font-bold tracking-[0.2em] uppercase hover:bg-[#7A1616] transition-all shadow-sm"
          >
            GET EARLY ACCESS
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 3. CATEGORY SECTOR TICKER */}
      {/* ======================================================== */}
      <div className="bg-[#EAE6DF] border-b border-[#1E1F22] px-6 sm:px-12 py-2 flex items-center gap-6 overflow-x-auto text-[10px] font-mono tracking-[0.18em] uppercase text-[#383A40]">
        {[
          { id: 'ALL', label: 'ALL' },
          { id: 'ETHNIC', label: 'ETHNIC & WEDDING' },
          { id: 'STREET', label: 'STREETWEAR' },
          { id: 'ACCESSORIES', label: 'ACCESSORIES' },
          { id: 'BARTER', label: 'SWAP' },
          { id: 'RENTAL', label: 'RENT' }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              sfx.click();
              setActiveCategory(cat.id);
            }}
            className={`whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeCategory === cat.id
              ? 'text-[#1E1F22] font-bold border-b-2 border-[#A82222] pb-0.5'
              : 'hover:text-[#1E1F22]'
              }`}
          >
            {activeCategory === cat.id && <span className="w-1.5 h-1.5 bg-[#A82222]" />}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* SECTION 00: THE 3D DIGITAL CLOSET (APPAREL & ACCESSORIES) */}
      {/* ======================================================== */}
      <section id="closet" className="relative min-h-screen flex flex-col justify-between pt-8 pb-12 px-6 sm:px-12 border-b border-[#1E1F22] overflow-hidden">
        {/* Warm Studio Background */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, #FFFFFF 0%, #F7F5F0 60%, #EAE6DF 100%)'
          }}
        />

        {/* Hero Grid */}
        <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Playing Card Dossier Specs */}
          <div className="lg:col-span-4 flex flex-col gap-5 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
                KAPHOR
              </span>
              <span className="text-[#1E1F22] font-mono text-xs">● PRE-LOVED FASHION</span>
            </div>

            <h1 className="font-bebas text-5xl sm:text-6xl xl:text-7xl leading-[0.88] text-[#1E1F22] tracking-wide font-normal">
              YOUR CLOTHES<br />
              <span className="text-[#A82222]">DESERVE MORE.</span>
            </h1>

            <p className="text-xs font-mono text-[#383A40] leading-relaxed max-w-md">
              Your old clothes still have life left in them. Kaphor helps you buy, sell, rent, or swap pre-loved fashion — so nothing goes to waste.
            </p>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold tracking-[0.18em] text-[#A82222] uppercase bg-[#EAE6DF] px-3 py-1.5 border border-[#1E1F22] w-fit">
              <span>BUY</span>
              <span>·</span>
              <span>SELL</span>
              <span>·</span>
              <span>RENT</span>
              <span>·</span>
              <span>SWAP</span>
              <span>·</span>
              <span>DISCOVER</span>
            </div>

            {/* White Playing Card Spec Sheet (Sharp Charcoal Border & Card Motifs) */}
            <div className="bg-[#FFFFFF] border-2 border-[#1E1F22] p-5 shadow-sm flex flex-col gap-3 relative rounded-sm">
              {/* Playing Card Inner Line Inset */}
              <div className="absolute inset-1.5 border border-[#1E1F22]/15 pointer-events-none rounded-sm" />

              <div className="flex items-center justify-between border-b border-[#1E1F22] pb-2 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col items-center leading-none">
                    <span className={`text-2xl font-mono font-black ${isRedSuit ? 'text-[#A82222]' : 'text-[#1E1F22]'}`}>
                      {currentCard.rank}
                    </span>
                    <span className={`text-base -mt-1 ${isRedSuit ? 'text-[#A82222]' : 'text-[#1E1F22]'}`}>
                      {currentCard.suit}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-bold text-[#1E1F22] uppercase">
                      {currentCard.name}
                    </span>
                    <span className="text-[9px] font-mono text-[#9A8E7E]">
                      {currentCard.category}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-[#FFFFFF] bg-[#A82222] px-2 py-0.5 rounded-sm shadow-xs">
                  {currentCard.matchPercent}% MATCH
                </span>
              </div>

              {/* Realistic Indian Thrifting & Pre-Loved Pricing in ₹ */}
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono relative z-10">
                <div>
                  <span className="text-[#9A8E7E] block text-[9px]">PRE-LOVED PRICE</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#1E1F22] font-black text-base">{currentCard.thriftPrice}</span>
                    <span className="text-[#9A8E7E] line-through text-[10px]">{currentCard.originalPrice}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[#9A8E7E] block text-[9px]">RENT FOR AN EVENT</span>
                  <span className="text-[#C95F12] font-bold text-xs">{currentCard.leasePrice}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono relative z-10 pt-1 border-t border-[#EAE6DF]">
                <div>
                  <span className="text-[#9A8E7E] block text-[9px]">CONDITION</span>
                  <span className="text-emerald-700 font-bold text-xs">{currentCard.conditionGrade}</span>
                </div>
                <div>
                  <span className="text-[#9A8E7E] block text-[9px]">SWAP VALUE</span>
                  <span className="text-[#1E1F22] font-bold text-xs">FREE SWAP</span>
                </div>
              </div>

              <div className="bg-[#F7F5F0] p-2.5 border border-[#1E1F22] text-[10px] font-mono text-[#1E1F22] relative z-10">
                <span className="text-[#A82222] font-bold">CONDITION CHECK: </span>
                {currentCard.defectNote}
              </div>

              <div className="flex items-center gap-2 pt-1 relative z-10">
                <button
                  onClick={() => {
                    sfx.click();
                    setShowWaitlistModal(true);
                  }}
                  className="flex-1 py-2.5 bg-[#1E1F22] text-[#F7F5F0] text-[10px] font-mono font-bold tracking-wider uppercase hover:bg-[#A82222] transition-all shadow-xs"
                >
                  BUY IT ({currentCard.thriftPrice})
                </button>
                <button
                  onClick={() => {
                    sfx.click();
                    setShowWaitlistModal(true);
                  }}
                  className="px-3.5 py-2.5 border border-[#1E1F22] bg-[#FFFFFF] text-[#1E1F22] text-[10px] font-mono hover:bg-[#EAE6DF] transition-all font-bold"
                >
                  LEASE
                </button>
              </div>
            </div>
          </div>

          {/* Center-Right Area: 3D Interactive Master Playing Card Chamber */}
          <div className="lg:col-span-8 relative h-[520px] sm:h-[620px] w-full border-2 border-[#1E1F22] bg-[#FFFFFF] shadow-xl overflow-hidden rounded-sm">
            {/* Playing Card Inner Line Inset */}
            <div className="absolute inset-2.5 border border-[#1E1F22]/20 pointer-events-none rounded-sm z-20" />

            {/* Top-Left Corner Playing Card Pip */}
            <div className="absolute top-4 left-5 z-30 flex flex-col items-center leading-none pointer-events-none select-none">
              <span className={`text-2xl sm:text-3xl font-mono font-black ${isRedSuit ? 'text-[#A82222]' : 'text-[#1E1F22]'}`}>
                {currentCard.rank}
              </span>
              <span className={`text-xl sm:text-2xl -mt-1 ${isRedSuit ? 'text-[#A82222]' : 'text-[#1E1F22]'}`}>
                {currentCard.suit}
              </span>
            </div>

            {/* Bottom-Right Inverted Corner Playing Card Pip (Classic Bicycle Playing Card Standard) */}
            <div className="absolute bottom-16 sm:bottom-20 right-5 z-30 flex flex-col items-center leading-none pointer-events-none select-none rotate-180">
              <span className={`text-2xl sm:text-3xl font-mono font-black ${isRedSuit ? 'text-[#A82222]' : 'text-[#1E1F22]'}`}>
                {currentCard.rank}
              </span>
              <span className={`text-xl sm:text-2xl -mt-1 ${isRedSuit ? 'text-[#A82222]' : 'text-[#1E1F22]'}`}>
                {currentCard.suit}
              </span>
            </div>

            {/* Top-Right Badges */}
            <div className="absolute top-4 right-5 z-30 flex flex-col items-end pointer-events-none">
              <VerifiedAtelierBadge label={currentCard.type === 'apparel' ? 'VERIFIED PIECE' : 'VERIFIED PIECE'} />
              <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px] text-[#383A40] bg-[#FFFFFF]/90 px-2 py-0.5 border border-[#1E1F22]">
                <span>LOT #{currentCard.id.toUpperCase()}-2026</span>
                <span>•</span>
                <span className="text-[#A82222] font-bold">{currentCard.thriftPrice}</span>
              </div>
            </div>

            {/* Faint Center Suit Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none opacity-[0.035]">
              <span className="text-[280px] font-mono leading-none">{currentCard.suit}</span>
            </div>

            {/* 3D Viewport: Interactive WebGL Canvas */}
            <div className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing">
              <Canvas
                shadows
                camera={{ position: [0, 0.2, 3.6], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
              >
                <Suspense fallback={null}>
                  <ambientLight intensity={0.9} color="#FFFFFF" />
                  <directionalLight position={[5, 6, 4]} intensity={2.2} color="#FFF6EA" castShadow />
                  <directionalLight position={[-4, 2, 3]} intensity={1.1} color="#EAF1FF" />
                  <directionalLight position={[0, 4, -5]} intensity={1.4} color="#FFEAD2" />
                  <pointLight position={[0, -0.2, 1.4]} intensity={1.1} color="#C95F12" />

                  {/* 3D Studio Pedestal */}
                  <ClosetStudioPedestal />

                  {/* Active 100% Realistic 3D Model */}
                  <ClosetPiece3D itemType={selectedCardId} />

                  {/* Orbit Controls (Damped, natural touch/click, no spinning!) */}
                  <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2 + 0.05}
                    minPolarAngle={Math.PI / 3}
                    rotateSpeed={0.6}
                  />

                  <DreiSparkles count={24} scale={6} size={1.5} speed={0.2} color="#C95F12" opacity={0.3} />
                </Suspense>
              </Canvas>
            </div>

            {/* Bottom Playing Card Wardrobe Selector Deck */}
            <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 bg-[#FFFFFF]/95 backdrop-blur-md border border-[#1E1F22] p-2 shadow-lg rounded-sm">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {(['hoodie', 'sneaker', 'bag'] as ClosetItemType[]).map((type) => {
                  const card = CLOSET_PLAYING_CARDS[type];
                  const isRed = card.suit === '♥' || card.suit === '♦';
                  const isSelected = selectedCardId === type;
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelectCard(type)}
                      className={`px-3 py-1.5 border text-[10px] font-mono tracking-wider uppercase font-bold transition-all flex items-center gap-2 rounded-sm shadow-xs ${
                        isSelected
                          ? 'border-[#1E1F22] bg-[#1E1F22] text-[#F7F5F0] -translate-y-1'
                          : 'border-[#1E1F22]/20 bg-[#F7F5F0] text-[#1E1F22] hover:border-[#1E1F22] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      <span className={`text-xs font-black ${isRed ? 'text-[#A82222]' : isSelected ? 'text-[#C9A84C]' : 'text-[#1E1F22]'}`}>
                        {card.rank}{card.suit}
                      </span>
                      <span>
                        {type === 'hoodie'
                          ? 'HOODIE'
                          : type === 'sneaker'
                          ? 'COURT SNEAKER'
                          : 'SAFFIANO TOTE'}
                      </span>
                      <span className={`text-[9px] px-1 py-0.2 border ${
                        isSelected
                          ? 'bg-[#A82222] text-[#FFFFFF] border-[#A82222]'
                          : 'bg-[#FFFFFF] text-[#383A40] border-[#1E1F22]/20'
                      }`}>
                        {card.thriftPrice}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="text-[9px] font-mono text-[#9A8E7E] hidden sm:block pr-2">
                DRAG 3D TO ROTATE &amp; INSPECT
              </div>
            </div>
        </div>
        </div>

        {/* Hero Bottom Navigation Ticker */}
        <div className="relative z-20 pt-8 flex items-center justify-between text-[10px] font-mono tracking-[0.25em] text-[#9A8E7E] uppercase border-t border-[#1E1F22] mt-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#A82222]" />
            <span>KEEP SCROLLING</span>
          </div>

          <a
            href="#deck-showcase"
            className="flex items-center gap-2 text-[#A82222] hover:text-[#1E1F22] transition-colors cursor-pointer"
          >
            <span>SEE ALL PIECES</span>
            <ChevronDown size={14} className="animate-bounce" />
          </a>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 01 — THE PROBLEM & 02 — WHAT IS KAPHOR? */}
      {/* ======================================================== */}
      <section className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* 01 — THE PROBLEM */}
          <div className="flex flex-col gap-4 border-l-2 border-[#A82222] pl-6">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
              <span>THE PROBLEM</span>
            </div>
            <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide leading-[0.92]">
              YOUR CLOSET IS STUFFED.
            </h2>
            <div className="text-xs font-mono text-[#383A40] leading-relaxed flex flex-col gap-3">
              <p>
                How many clothes are sitting in your wardrobe that you don't wear anymore?
              </p>
              <div className="p-3 bg-[#FFFFFF] border border-[#1E1F22] flex flex-col gap-1 text-[#1E1F22] font-medium shadow-xs">
                <span>They could still be worth something.</span>
                <span>Someone else would probably love them.</span>
                <span className="text-[#A82222] font-bold">But most of the time, they just sit there.</span>
              </div>
              <p>
                The fashion industry makes way too much stuff — and most of it ends up in landfills.
              </p>
              <p className="font-bold text-[#1E1F22] pt-1">
                Kaphor changes that.
              </p>
            </div>
          </div>

          {/* 02 — WHAT IS KAPHOR? */}
          <div className="flex flex-col gap-4 border-l-2 border-[#C9A84C] pl-6">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#C9A84C] uppercase font-bold">
              <span>WHAT IS KAPHOR?</span>
            </div>
            <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide leading-[0.92]">
              ONE PIECE, LOTS OF OPTIONS.
            </h2>
            <div className="text-xs font-mono text-[#383A40] leading-relaxed flex flex-col gap-3">
              <p>
                Kaphor is a platform that helps your clothes keep moving — instead of collecting dust.
              </p>
              <p>
                Buy something pre-loved, sell what you don't need, rent for a wedding, or swap bags with someone — all in one place.
              </p>
              <div className="p-3 bg-[#1E1F22] text-[#F7F5F0] border border-[#C9A84C] font-mono text-xs flex items-center justify-between shadow-xs">
                <span className="text-[#C9A84C] font-bold uppercase tracking-wider">A better way to keep fashion alive.</span>
                <span className="text-[#A82222] text-sm">♠♥♦</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 03 — DISCOVER & 04 — BUY: THE CURATED PLAYING CARD DECK */}
      {/* ======================================================== */}
      <section id="deck-showcase" className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="flex flex-col gap-3 max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
              <span>DISCOVER & BUY</span>
              <span>●</span>
              <span>FIND WHAT FITS YOUR STYLE</span>
            </div>

            <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide">
              FIND SOMETHING YOU'LL ACTUALLY WEAR.
            </h2>

            <p className="text-xs font-mono text-[#383A40] leading-relaxed">
              No endless scrolling. Kaphor learns what you like and shows you pieces that match your style. Browse pre-loved items, check their condition, and grab something great at honest prices.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-[#9A8E7E] uppercase bg-[#EAE6DF] px-3 py-1.5 border border-[#1E1F22] self-start">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>THRIFT PRICES: ACTIVE</span>
          </div>
        </div>

        {/* 6-Card Playing Deck with Real Data & Authentic Images from the App */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[
            {
              id: 'hoodie',
              rank: 'K',
              suit: '♦' as const,
              matchPercent: 96,
              headerName: '450 GSM HOODIE',
              subText: 'French Terry Cotton',
              category: 'Archival Luxury Streetwear',
              brand: 'Kaphor',
              name: 'Heavyweight Fleece Streetwear Hoodie',
              thriftPrice: '₹1,299',
              originalPrice: '₹4,800',
              condition: 'A- (Excellent)',
              leasePrice: '₹299 / day',
              buttonText: 'BUY OR RENT',
              image: '/images/app/thrift/1.jpeg',
              has3D: true,
              type: 'apparel'
            },
            {
              id: 'sneaker',
              rank: '10',
              suit: '♦' as const,
              matchPercent: 95,
              headerName: 'RETRO COURT SNEAKER',
              subText: 'Archival White Leather',
              category: 'Archival Footwear Grail',
              brand: 'Heritage',
              name: 'Retro Leather Court Sneaker',
              thriftPrice: '₹2,499',
              originalPrice: '₹9,999',
              condition: 'A (Near Pristine)',
              leasePrice: '₹349 / day',
              buttonText: 'BUY OR SWAP',
              image: '/images/app/swaps/1.jpeg',
              has3D: true,
              type: 'accessory'
            },
            {
              id: 'bag',
              rank: 'Q',
              suit: '♥' as const,
              matchPercent: 97,
              headerName: 'STRUCTURED SAFFIANO TOTE',
              subText: 'Saffiano Cross-Grain Leather',
              category: 'Archival Luxury Leather Goods',
              brand: 'Kaphor Studio',
              name: 'Structured Minimalist Saffiano Tote',
              thriftPrice: '₹4,899',
              originalPrice: '₹18,500',
              condition: 'A+ (Mint Heirloom)',
              leasePrice: '₹499 / day',
              buttonText: 'BUY OR SWAP',
              image: '/images/app/swaps/2.jpeg',
              has3D: true,
              type: 'accessory'
            },
            {
              id: 'saree',
              rank: 'K',
              suit: '♠' as const,
              matchPercent: 98,
              headerName: 'SABYASACHI CRIMSON SAREE',
              subText: 'Antique Zardozi & Dabka Brocade',
              category: 'Indian Bridal & Festive Wear',
              brand: 'Sabyasachi',
              name: 'Sabyasachi Heritage Crimson Zardozi Saree',
              thriftPrice: '₹18,999',
              originalPrice: '₹1,85,000',
              condition: 'A+ (Pristine Heirloom)',
              leasePrice: '₹1,299 / day',
              buttonText: 'BUY OR RENT',
              image: '/images/app/rentals/1.jpeg',
              has3D: false,
              type: 'apparel'
            },
            {
              id: 'skirt',
              rank: 'J',
              suit: '♣' as const,
              matchPercent: 94,
              headerName: 'ISSEY MIYAKE PLEATED SKIRT',
              subText: 'Permanent Heat-Pressed Pleats',
              category: 'Contemporary Designer Archives',
              brand: 'Issey Miyake',
              name: 'Pleats Please Black Pleated Midi Skirt',
              thriftPrice: '₹3,200',
              originalPrice: '₹28,000',
              condition: 'A (Pristine)',
              leasePrice: '₹450 / day',
              buttonText: 'BUY OR SWAP',
              image: '/images/app/thrift/4.jpeg',
              has3D: false,
              type: 'apparel'
            }
          ].map((card) => {
            const isRed = card.suit === '♥' || card.suit === '♦';
            const suitCol = isRed ? 'text-[#A82222]' : 'text-[#1E1F22]';

            return (
              <div
                key={card.id}
                onClick={() => {
                  if (card.has3D && (card.id === 'hoodie' || card.id === 'sneaker' || card.id === 'bag')) {
                    handleSelectCard(card.id as ClosetItemType);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={`bg-[#FFFFFF] border-2 border-[#1E1F22] rounded-2xl p-5 flex flex-col justify-between relative transition-all cursor-pointer group shadow-sm hover:shadow-xl hover:-translate-y-1.5 ${
                  selectedCardId === card.id ? 'ring-2 ring-[#A82222] border-[#A82222]' : ''
                }`}
              >
                {/* Playing Card Corner Decoration Top-Left */}
                <div className="absolute top-3.5 left-3.5 flex flex-col items-center leading-none z-10 select-none">
                  <span className={`text-base font-mono font-black ${suitCol}`}>{card.rank}</span>
                  <span className={`text-xs -mt-1 ${suitCol}`}>{card.suit}</span>
                </div>

                {/* Match Badge */}
                <div className="absolute top-3 right-3 bg-[#A82222] px-2 py-0.5 rounded-sm z-10 shadow-xs">
                  <span className="text-[9px] font-mono font-bold text-[#FFFFFF]">{card.matchPercent}% MATCH</span>
                </div>

                {/* Card Inset Inner Line */}
                <div className="absolute inset-2 border border-[#1E1F22]/10 rounded-xl pointer-events-none" />

                {/* Card Real Image Media Preview Area */}
                <div className="w-full h-48 bg-[#F8FAFB] border border-[#1E1F22]/15 rounded-lg mt-7 mb-3 overflow-hidden relative group-hover:border-[#A82222] transition-colors">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      // Fallback gracefully if image path is unavailable
                      (e.target as HTMLImageElement).src = '/models/upcycle/pouch.png';
                    }}
                  />

                  {/* Top Header Overlay */}
                  <div className="absolute top-2 left-2 bg-[#FFFFFF]/90 backdrop-blur-xs px-2 py-0.5 border border-[#1E1F22]/15 text-[8.5px] font-mono font-bold text-[#1E1F22]">
                    {card.headerName}
                  </div>

                  {card.has3D ? (
                    <div className="absolute bottom-2 right-2 bg-[#1E1F22] text-[#FFFFFF] px-2 py-0.5 border border-[#C9A84C] text-[8px] font-mono font-bold uppercase shadow-sm">
                      VIEW IN 3D ↺
                    </div>
                  ) : (
                    <div className="absolute bottom-2 right-2 bg-[#FFFFFF]/90 text-[#1E1F22] px-2 py-0.5 border border-[#1E1F22]/20 text-[8px] font-mono font-bold uppercase">
                      APP VERIFIED
                    </div>
                  )}
                </div>

                {/* Card Content & Details */}
                <div className="flex flex-col gap-1.5 relative z-10">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[8px] tracking-wider text-[#9A8E7E] uppercase font-bold">
                      {card.category}
                    </span>
                    <span className="text-[8px] font-mono text-[#383A40] bg-[#EAE6DF] px-1.5 py-0.5 border border-[#1E1F22]/20 font-bold">
                      {card.brand}
                    </span>
                  </div>

                  <h3 className="font-bebas text-lg text-[#1E1F22] leading-tight line-clamp-1 group-hover:text-[#A82222] transition-colors">
                    {card.name}
                  </h3>

                  {/* Indian Thrifting Price & Original Price */}
                  <div className="flex items-baseline justify-between pt-1 border-t border-[#EAE6DF]">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-[#9A8E7E]">PRICE</span>
                      <span className="text-base font-mono font-black text-[#1E1F22]">{card.thriftPrice}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#9A8E7E] line-through">{card.originalPrice}</span>
                  </div>

                  {/* Condition Tag & Lease Rate */}
                  <div className="flex items-center justify-between text-[8.5px] font-mono pt-1">
                    <span className="text-[#A82222] font-bold">{card.condition}</span>
                    <span className="text-[#383A40]">{card.leasePrice}</span>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sfx.success();
                      setShowWaitlistModal(true);
                    }}
                    className="w-full py-2 mt-2 bg-[#1E1F22] text-[#FFFFFF] text-[9.5px] font-mono font-bold tracking-wider uppercase hover:bg-[#A82222] transition-all rounded-sm shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>{card.buttonText}</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>

                {/* Playing Card Inverted Bottom-Right Corner Pip */}
                <div className="absolute bottom-2.5 right-3 flex flex-col items-center leading-none select-none rotate-180 opacity-40 group-hover:opacity-100 transition-opacity">
                  <span className={`text-xs font-mono font-black ${suitCol}`}>{card.rank}</span>
                  <span className={`text-[10px] -mt-1 ${suitCol}`}>{card.suit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 01: THE 4 QUICK ATELIER PILLARS */}
      {/* ======================================================== */}
      <section id="pillars" className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 max-w-3xl mb-12">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
            <span>HOW IT WORKS</span>
            <span>/</span>
            <span>4 WAYS TO KEEP FASHION MOVING</span>
          </div>

          <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide">
            BUY. RENT. SWAP. RESTORE.
          </h2>

          <p className="text-xs font-mono text-[#383A40] leading-relaxed">
            Four ways to give your clothes — and other people's clothes — a longer life.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pillar 1: BUY & SELL */}
          <div className="bg-[#FFFFFF] border border-[#1E1F22] hover:border-[#A82222] p-6 flex flex-col justify-between transition-all group shadow-sm">
            <div>
              <div className="w-10 h-10 border border-[#1E1F22] bg-[#F7F5F0] flex items-center justify-center text-[#1E1F22] mb-5 group-hover:border-[#A82222]">
                <ShoppingBag size={18} />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-[#A82222] uppercase block mb-1 font-bold">
                PILLAR 01
              </span>
              <h3 className="font-bebas text-2xl text-[#1E1F22] tracking-wider mb-2">
                BUY &amp; SELL
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed">
                Buy pre-loved clothes and accessories, or sell what you don't wear anymore. Quick and easy.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[#1E1F22] flex items-center justify-between text-[10px] font-mono text-[#1E1F22]">
              <span>SHOP & SELL</span>
              <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-[#A82222]" />
            </div>
          </div>

          {/* Pillar 2: WEDDING & OCCASION LEASE */}
          <div className="bg-[#FFFFFF] border border-[#1E1F22] hover:border-[#A82222] p-6 flex flex-col justify-between transition-all group shadow-sm">
            <div>
              <div className="w-10 h-10 border border-[#1E1F22] bg-[#F7F5F0] flex items-center justify-center text-[#C95F12] mb-5 group-hover:border-[#A82222]">
                <Calendar size={18} />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-[#C95F12] uppercase block mb-1 font-bold">
                PILLAR 02
              </span>
              <h3 className="font-bebas text-2xl text-[#1E1F22] tracking-wider mb-2">
                OCCASION LEASE
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed">
                Need a stunning outfit for a wedding or event? Rent it starting at ₹499/day — no need to buy something you'll wear once.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[#1E1F22] flex items-center justify-between text-[10px] font-mono text-[#1E1F22]">
              <span>RENT FOR EVENTS</span>
              <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-[#A82222]" />
            </div>
          </div>

          {/* Pillar 3: FAIR ACCESSORY SWAPS */}
          <div className="bg-[#FFFFFF] border border-[#1E1F22] hover:border-[#A82222] p-6 flex flex-col justify-between transition-all group shadow-sm">
            <div>
              <div className="w-10 h-10 border border-[#1E1F22] bg-[#F7F5F0] flex items-center justify-center text-[#1E3B2F] mb-5 group-hover:border-[#A82222]">
                <ArrowLeftRight size={18} />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-[#1E3B2F] uppercase block mb-1 font-bold">
                PILLAR 03
              </span>
              <h3 className="font-bebas text-2xl text-[#1E1F22] tracking-wider mb-2">
                FAIR SWAPS
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed">
                Swap bags, shoes, or clothes with someone else — completely free. Both items are verified before the swap.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[#1E1F22] flex items-center justify-between text-[10px] font-mono text-[#1E1F22]">
              <span>FREE SWAPS</span>
              <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-[#A82222]" />
            </div>
          </div>

          {/* Pillar 4: DIGITAL ATELIER REPAIR */}
          <div className="bg-[#FFFFFF] border border-[#1E1F22] hover:border-[#A82222] p-6 flex flex-col justify-between transition-all group shadow-sm">
            <div>
              <div className="w-10 h-10 border border-[#1E1F22] bg-[#F7F5F0] flex items-center justify-center text-[#A82222] mb-5 group-hover:border-[#A82222]">
                <Scan size={18} />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-[#A82222] uppercase block mb-1 font-bold">
                PILLAR 04
              </span>
              <h3 className="font-bebas text-2xl text-[#1E1F22] tracking-wider mb-2">
                AI STYLE CHECK
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed">
                Our AI checks garment condition, spots defects, and gives you step-by-step guides to restore and refresh your pieces.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[#1E1F22] flex items-center justify-between text-[10px] font-mono text-[#1E1F22]">
              <span>SCAN & RESTORE</span>
              <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-[#A82222]" />
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 02: SWAP ACCESSORIES. ZERO CASH NEEDED. */}
      {/* ======================================================== */}
      <section id="barter-deck" className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
              <span>SWAP ACCESSORIES</span>
            </div>

            <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide">
              SWAP BAGS &amp; SHOES.<br />
              NO CASH NEEDED.
            </h2>

            <p className="text-xs font-mono text-[#383A40] leading-relaxed">
              Got a bag you don't use? Or sneakers collecting dust? Trade them with someone who wants them. No cash involved — just a fair swap.
            </p>

            <div className="bg-[#FFFFFF] border border-[#1E1F22] p-4 flex flex-col gap-2 font-mono text-xs shadow-sm">
              <div className="flex justify-between items-center text-[#A82222] font-bold">
                <span>SAFE SWAPS</span>
                <span>ALWAYS ON</span>
              </div>
              <p className="text-[11px] text-[#383A40]">
                We handle shipping for both sides. The swap only goes through when both items are checked and verified.
              </p>
            </div>
          </div>

          {/* Swap Proposal 3D Accessories Card */}
          <div className="lg:col-span-7 bg-[#FFFFFF] border-2 border-[#1E1F22] p-6 sm:p-8 shadow-md rounded-sm">
            <div className="flex items-center justify-between border-b border-[#1E1F22] pb-3 mb-6 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#1E1F22] font-bold">SWAP #9182</span>
                <span className="text-[9px] bg-[#EAE6DF] px-1.5 py-0.5 border border-[#1E1F22]">VERIFIED</span>
              </div>
              <span className="text-emerald-700 font-bold text-xs">FAIR SWAP ✓</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Card 1: Your Accessory (3D Handbag) as Physical Playing Card */}
              <div className="border-2 border-[#1E1F22] bg-[#F7F5F0] p-4 flex flex-col justify-between h-80 shadow-sm relative rounded-xl group">
                <div className="absolute inset-1.5 border border-[#1E1F22]/15 pointer-events-none rounded-lg" />

                <div className="flex justify-between items-start relative z-10">
                  <div className="flex flex-col items-center leading-none select-none">
                    <span className="text-xl font-mono font-black text-[#1E1F22]">J</span>
                    <span className="text-base -mt-1 text-[#1E1F22]">♠</span>
                  </div>
                  <span className="text-[8.5px] font-mono font-bold bg-[#1E1F22] px-2 py-0.5 text-[#F7F5F0] rounded-xs">
                    YOUR ITEM
                  </span>
                </div>

                {/* Real Photo */}
                <div className="h-32 w-full relative z-10 overflow-hidden rounded-lg border border-[#1E1F22]/15">
                  <img
                    src="/images/app/swaps/1.jpeg"
                    alt="Your swap item"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="relative z-10">
                  <h4 className="font-bebas text-xl text-[#1E1F22]">Your Piece</h4>
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#383A40] mt-0.5">
                    <span>Great condition</span>
                    <span className="text-xs font-mono text-[#1E1F22] font-black">₹2,499 Value</span>
                  </div>
                </div>

                {/* Bottom-right inverted corner pip */}
                <div className="absolute bottom-2.5 right-3 flex flex-col items-center leading-none select-none rotate-180 opacity-40">
                  <span className="text-sm font-mono font-black text-[#1E1F22]">J</span>
                  <span className="text-xs -mt-1 text-[#1E1F22]">♠</span>
                </div>
              </div>

              {/* Card 2: Their Accessory (3D Sneaker) as Physical Playing Card */}
              <div className="border-2 border-[#A82222] bg-[#FFFFFF] p-4 flex flex-col justify-between h-80 relative shadow-md rounded-xl group">
                <div className="absolute inset-1.5 border border-[#A82222]/20 pointer-events-none rounded-lg" />

                <div className="flex justify-between items-start relative z-10">
                  <div className="flex flex-col items-center leading-none select-none">
                    <span className="text-xl font-mono font-black text-[#A82222]">10</span>
                    <span className="text-base -mt-1 text-[#A82222]">♦</span>
                  </div>
                  <span className="text-[8.5px] font-mono font-bold bg-[#A82222] px-2 py-0.5 text-white rounded-xs">
                    THEIR ITEM
                  </span>
                </div>

                {/* Real Photo */}
                <div className="h-32 w-full relative z-10 overflow-hidden rounded-lg border border-[#A82222]/20">
                  <img
                    src="/images/app/swaps/2.jpeg"
                    alt="Swap partner's item"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="relative z-10">
                  <h4 className="font-bebas text-xl text-[#1E1F22]">Their Piece</h4>
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#383A40] mt-0.5">
                    <span>Great condition</span>
                    <span className="text-xs font-mono text-[#A82222] font-black">₹2,499 Value</span>
                  </div>
                </div>

                {/* Bottom-right inverted corner pip */}
                <div className="absolute bottom-2.5 right-3 flex flex-col items-center leading-none select-none rotate-180 opacity-40">
                  <span className="text-sm font-mono font-black text-[#A82222]">10</span>
                  <span className="text-xs -mt-1 text-[#A82222]">♦</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1E1F22] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[10px] font-mono text-[#383A40]">
                No fees. Both sides pay <span className="font-bold text-[#1E1F22]">₹0</span>.
              </span>

              <button
                onClick={() => {
                  sfx.success();
                  setSwapAccepted(true);
                  confetti({
                    particleCount: 90,
                    spread: 65,
                    origin: { y: 0.7 },
                    colors: ['#A82222', '#C9A84C', '#1E1F22']
                  });
                }}
                className={`px-6 py-2.5 font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-xs ${swapAccepted
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#A82222] text-[#FFFFFF] hover:bg-[#7A1616]'
                  }`}
              >
                {swapAccepted ? 'SWAP ACCEPTED ✓' : 'ACCEPT SWAP (FREE)'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 08 — AI GARMENT INTELLIGENCE & 09 — DIGITAL WARDROBE */}
      {/* ======================================================== */}
      <section className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 08 — AI GARMENT INTELLIGENCE */}
          <div className="bg-[#FFFFFF] border-2 border-[#1E1F22] p-8 flex flex-col justify-between shadow-sm relative rounded-sm">
            <div className="absolute inset-2 border border-[#1E1F22]/10 pointer-events-none rounded-sm" />
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold mb-2">
                <span>SMART CONDITION CHECK</span>
              </div>
              <h3 className="font-bebas text-3xl sm:text-4xl text-[#1E1F22] tracking-wide mb-3">
                WE DON’T JUST LOOK AT CLOTHES. WE REALLY CHECK THEM.
              </h3>
              <p className="text-xs font-mono text-[#383A40] leading-relaxed mb-4">
                Our AI looks at your garment closely — checks the fabric, stitching, and overall condition — and tells you what to do next:
              </p>
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#FFFFFF] mb-4">
                <span className="bg-[#1E1F22] px-3 py-1 border border-[#1E1F22]">RESELL</span>
                <span className="bg-[#A82222] px-3 py-1 border border-[#A82222]">UPCYCLE</span>
                <span className="bg-[#1E3B2F] px-3 py-1 border border-[#1E3B2F]">RECYCLE</span>
              </div>
              <div className="p-3 bg-[#F7F5F0] border border-[#1E1F22] text-xs font-mono text-[#1E1F22] flex flex-col gap-1">
                <span className="text-[#9A8E7E] text-[10px]">MOST PEOPLE ASK:</span>
                <span className="italic">"Should I throw this out?"</span>
                <span className="text-[#A82222] font-bold text-[10px] pt-1">KAPHOR ASKS:</span>
                <span className="font-bold text-[#A82222]">"What can this become next?"</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-[#9A8E7E] mt-4 pt-3 border-t border-[#EAE6DF]">
              AI-powered condition checks and next-step suggestions.
            </span>
          </div>

          {/* 09 — YOUR DIGITAL WARDROBE */}
          <div className="bg-[#FFFFFF] border-2 border-[#1E1F22] p-8 flex flex-col justify-between shadow-sm relative rounded-sm">
            <div className="absolute inset-2 border border-[#1E1F22]/10 pointer-events-none rounded-sm" />
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#C9A84C] uppercase font-bold mb-2">
                <span>YOUR DIGITAL CLOSET</span>
              </div>
              <h3 className="font-bebas text-3xl sm:text-4xl text-[#1E1F22] tracking-wide mb-3">
                ALL YOUR CLOTHES, IN ONE PLACE.
              </h3>
              <p className="text-xs font-mono text-[#383A40] leading-relaxed mb-4">
                See everything you own in one place — and figure out what to do with each piece:
              </p>
              <div className="grid grid-cols-4 gap-2 font-mono text-center text-xs font-bold mb-4">
                <div className="p-2 border border-[#1E1F22] bg-[#F7F5F0]">STYLE</div>
                <div className="p-2 border border-[#1E1F22] bg-[#F7F5F0]">SELL</div>
                <div className="p-2 border border-[#1E1F22] bg-[#F7F5F0]">RENT</div>
                <div className="p-2 border border-[#1E1F22] bg-[#F7F5F0]">SWAP</div>
              </div>
              <p className="text-xs font-mono text-[#383A40] leading-relaxed">
                Your digital closet connects to everything Kaphor offers — sell, rent, swap, or restyle. No more forgotten clothes.
              </p>
            </div>
            <button
              onClick={() => {
                sfx.click();
                setShowWaitlistModal(true);
              }}
              className="w-full py-2.5 mt-4 bg-[#1E1F22] text-[#F7F5F0] text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#A82222] transition-all flex items-center justify-center gap-1.5"
            >
              <span>OPEN MY CLOSET</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>

        {/* 10 — YOUR STYLE & 11 — EVERY GARMENT HAS A JOURNEY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {/* 10 — YOUR STYLE */}
          <div className="bg-[#F7F5F0] border border-[#1E1F22] p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold mb-2">
                <span>YOUR STYLE</span>
              </div>
              <h3 className="font-bebas text-3xl sm:text-4xl text-[#1E1F22] tracking-wide mb-3">
                FASHION SHOULD FEEL LIKE YOU.
              </h3>
              <p className="text-xs font-mono text-[#383A40] leading-relaxed mb-3">
                The more you use Kaphor, the better it gets at finding pieces you'll love. It learns your taste over time.
              </p>
              <div className="p-3 bg-[#FFFFFF] border border-[#1E1F22] flex items-center justify-between font-mono text-xs font-bold text-[#1E1F22]">
                <span>FIND YOUR STYLE.</span>
                <span className="text-[#A82222]">LET AI FIND THE REST.</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-[#9A8E7E] mt-4 pt-3 border-t border-[#1E1F22]/20">
              Personalized picks, AI style matching, and a quick style quiz to get started.
            </span>
          </div>

          {/* 11 — EVERY GARMENT HAS A JOURNEY */}
          <div className="bg-[#1E1F22] text-[#F7F5F0] border border-[#383A40] p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#C9A84C] uppercase font-bold mb-2">
                <span>EVERY PIECE HAS A STORY</span>
              </div>
              <h3 className="font-bebas text-3xl sm:text-4xl text-[#F7F5F0] tracking-wide mb-3">
                FROM ONE PERSON TO THE NEXT.
              </h3>
              <p className="text-xs font-mono text-[#9A8E7E] leading-relaxed mb-4">
                A piece of clothing doesn't belong to just one person. It moves from one wardrobe to another:
              </p>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold text-[#1E1F22]">
                {['OWN', 'WEAR', 'SELL', 'BUY', 'RENT', 'SWAP', 'REUSE'].map((step, idx, arr) => (
                  <React.Fragment key={step}>
                    <span className="bg-[#F7F5F0] px-2 py-1 border border-[#C9A84C]">{step}</span>
                    {idx < arr.length - 1 && <span className="text-[#C9A84C] font-black">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#383A40] flex justify-between items-center text-xs font-mono text-[#C9A84C]">
              <span>THE GOAL IS SIMPLE:</span>
              <span className="font-bold text-[#F7F5F0]">KEEP CLOTHES IN USE LONGER.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 13 — UPCYCLE: COMMUNITY CREATIONS */}
      {/* ======================================================== */}
      <section id="atelier-repair" className="py-20 border-b border-[#1E1F22]">
        {/* Header */}
        <div className="px-6 sm:px-12 max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div className="flex flex-col gap-3 max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
              <span>RESTORE & UPCYCLE</span>
              <span>//</span>
              <span>MADE ON OUR OWN WITH ZERO STITCHING KNOWLEDGE</span>
            </div>

            <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide">
              OLD CLOTHES. NEW LIFE. MADE BY YOU.
            </h2>

            <p className="text-xs font-mono text-[#383A40] leading-relaxed">
              You don't need a sewing machine or professional tailoring skills. With Kaphor's step-by-step blueprints, you can turn unworn garments and scrap textiles into pieces you actually need — completely on your own with zero stitching knowledge.
            </p>
          </div>

          {/* Arrow controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => scrollUpcycle('left')}
              aria-label="Previous"
              className="w-9 h-9 border-2 border-[#1E1F22] bg-[#FFFFFF] flex items-center justify-center hover:bg-[#A82222] hover:border-[#A82222] hover:text-white transition-all text-[#1E1F22] font-black text-sm"
            >
              ←
            </button>
            <button
              onClick={() => scrollUpcycle('right')}
              aria-label="Next"
              className="w-9 h-9 border-2 border-[#1E1F22] bg-[#FFFFFF] flex items-center justify-center hover:bg-[#A82222] hover:border-[#A82222] hover:text-white transition-all text-[#1E1F22] font-black text-sm"
            >
              →
            </button>
          </div>
        </div>

        {/* Horizontal Snap Slider */}
        <div
          ref={upcycleSliderRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory px-6 sm:px-12 pb-6 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Item 1: Upcycled Denim Mini Skirt (has basic sewing) */}
          <div className="snap-start shrink-0 w-[300px] sm:w-[340px] border-2 border-[#1E1F22] bg-[#FFFFFF] p-5 flex flex-col justify-between shadow-sm rounded-lg group hover:shadow-xl transition-all">
            <div>
              <div className="flex justify-between items-center text-[9px] font-mono text-[#A82222] mb-2 font-bold">
                <span>DIY PROJECT #01</span>
                <span>BASIC SEWING</span>
              </div>

              {/* Media Preview with Front/Back Toggle */}
              <div className="w-full h-64 bg-[#F8FAFB] border border-[#1E1F22]/15 rounded-md overflow-hidden relative mb-3">
                <img
                  src={skirtView === 'front' ? '/models/upcycle/skirt frint.png' : '/models/upcycle/skirt back.png'}
                  alt="Restyled Denim Skirt"
                  className="w-full h-full object-contain transition-all duration-500"
                />

                {/* View Selector Controls */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-[#1E1F22]/90 backdrop-blur-sm p-1 rounded-sm">
                  <span className="text-[8px] font-mono text-[#F7F5F0] font-bold px-1.5">
                    VIEW: {skirtView.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { sfx.click(); setSkirtView('front'); }}
                      className={`px-2 py-0.5 text-[8px] font-mono font-bold uppercase transition-colors ${
                        skirtView === 'front' ? 'bg-[#A82222] text-[#FFFFFF]' : 'bg-[#FFFFFF]/20 text-[#F7F5F0] hover:bg-[#FFFFFF]/40'
                      }`}
                    >
                      FRONT
                    </button>
                    <button
                      onClick={() => { sfx.click(); setSkirtView('back'); }}
                      className={`px-2 py-0.5 text-[8px] font-mono font-bold uppercase transition-colors ${
                        skirtView === 'back' ? 'bg-[#A82222] text-[#FFFFFF]' : 'bg-[#FFFFFF]/20 text-[#F7F5F0] hover:bg-[#FFFFFF]/40'
                      }`}
                    >
                      BACK
                    </button>
                  </div>
                </div>
              </div>

              <h3 className="font-bebas text-xl text-[#1E1F22] mb-1">
                Upcycled Denim Mini Skirt
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed mb-3">
                Two old jeans became this pleated mini. Cut along the seams, ruffled panels stitched at the hem, star patches and a chain added for character. Basic sewing — maximum personality.
              </p>
            </div>

            <div className="pt-3 border-t border-[#1E1F22]/20 flex justify-between items-center text-[10px] font-mono text-[#1E1F22]">
              <span className="text-[#9A8E7E]">TIME: ~2 HRS</span>
              <span className="text-[#A82222] font-bold">BASIC SEWING</span>
            </div>
          </div>

          {/* Item 2: Upcycled Denim Bag with Lace Bow */}
          <div className="snap-start shrink-0 w-[300px] sm:w-[340px] border-2 border-[#1E1F22] bg-[#FFFFFF] p-5 flex flex-col justify-between shadow-sm rounded-lg group hover:shadow-xl transition-all">
            <div>
              <div className="flex justify-between items-center text-[9px] font-mono text-[#A82222] mb-2 font-bold">
                <span>DIY PROJECT #02</span>
                <span>DENIM BAG</span>
              </div>

              <div className="w-full h-64 bg-[#F8FAFB] border border-[#1E1F22]/15 rounded-md overflow-hidden relative mb-3">
                <img
                  src="/models/upcycle/bag.png"
                  alt="Upcycled Denim Bag"
                  className="w-full h-full object-contain transition-all duration-500"
                />
                <div className="absolute top-2 left-2 bg-[#FFFFFF]/90 px-2 py-0.5 border border-[#1E1F22]/15 text-[8.5px] font-mono font-bold text-[#1E1F22]">
                  OLD JEANS → BAG
                </div>
              </div>

              <h3 className="font-bebas text-xl text-[#1E1F22] mb-1">
                Denim Tote with Lace Bow
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed mb-3">
                A worn-out pair of jeans, a Kuromi charm, and scrap lace — that's all it took. Jeans body cut and knotted into handles, lace bow stitched on for a Y2K touch. Our own creation.
              </p>
            </div>

            <div className="pt-3 border-t border-[#1E1F22]/20 flex justify-between items-center text-[10px] font-mono text-[#1E1F22]">
              <span className="text-[#9A8E7E]">TIME: ~1 HR</span>
              <span className="text-[#A82222] font-bold">BASIC STITCHING</span>
            </div>
          </div>

          {/* Item 3: Zero-Waste Utility Pouch */}
          <div className="snap-start shrink-0 w-[300px] sm:w-[340px] border-2 border-[#1E1F22] bg-[#FFFFFF] p-5 flex flex-col justify-between shadow-sm rounded-lg group hover:shadow-xl transition-all">
            <div>
              <div className="flex justify-between items-center text-[9px] font-mono text-[#A82222] mb-2 font-bold">
                <span>DIY PROJECT #03</span>
                <span>OFFCUT UTILITY</span>
              </div>

              <div className="w-full h-64 bg-[#F8FAFB] border border-[#1E1F22]/15 rounded-md overflow-hidden relative mb-3">
                <img
                  src="/models/upcycle/pouch.png"
                  alt="Zero-Waste Utility Pouch"
                  className="w-full h-full object-contain transition-all duration-500"
                />
                <div className="absolute top-2 left-2 bg-[#FFFFFF]/90 px-2 py-0.5 border border-[#1E1F22]/15 text-[8.5px] font-mono font-bold text-[#1E1F22]">
                  ZERO TEXTILE WASTE
                </div>
              </div>

              <h3 className="font-bebas text-xl text-[#1E1F22] mb-1">
                Zero-Waste Pocket Utility Pouch
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed mb-3">
                Scraps of leftover fabric folded and snap-riveted into a minimal everyday pouch. No sewing, no machine — just folding and fastening. Holds cards, cash, keys.
              </p>
            </div>

            <div className="pt-3 border-t border-[#1E1F22]/20 flex justify-between items-center text-[10px] font-mono text-[#1E1F22]">
              <span className="text-[#9A8E7E]">TIME: 15 MINS</span>
              <span className="text-[#C95F12] font-bold">NO-SEW FOLD</span>
            </div>
          </div>

          {/* Item 4: Braided Textile Scrap Keychain */}
          <div className="snap-start shrink-0 w-[300px] sm:w-[340px] border-2 border-[#1E1F22] bg-[#FFFFFF] p-5 flex flex-col justify-between shadow-sm rounded-lg group hover:shadow-xl transition-all">
            <div>
              <div className="flex justify-between items-center text-[9px] font-mono text-[#A82222] mb-2 font-bold">
                <span>DIY PROJECT #04</span>
                <span>SCRAP LANYARD</span>
              </div>

              <div className="w-full h-64 bg-[#F8FAFB] border border-[#1E1F22]/15 rounded-md overflow-hidden relative mb-3">
                <img
                  src="/models/upcycle/keychain.png"
                  alt="Braided Textile Scrap Keychain"
                  className="w-full h-full object-contain transition-all duration-500"
                />
                <div className="absolute top-2 left-2 bg-[#FFFFFF]/90 px-2 py-0.5 border border-[#1E1F22]/15 text-[8.5px] font-mono font-bold text-[#1E1F22]">
                  100% OFF-CUT SALVAGE
                </div>
              </div>

              <h3 className="font-bebas text-xl text-[#1E1F22] mb-1">
                Braided Scrap Lanyard Keychain
              </h3>
              <p className="text-[11px] font-mono text-[#383A40] leading-relaxed mb-3">
                Leftover denim hem strips braided by hand into a sturdy keychain lanyard. Zero tools, zero waste — just fingers and fabric scraps.
              </p>
            </div>

            <div className="pt-3 border-t border-[#1E1F22]/20 flex justify-between items-center text-[10px] font-mono text-[#1E1F22]">
              <span className="text-[#9A8E7E]">TIME: 10 MINS</span>
              <span className="text-emerald-700 font-bold">FINGER BRAID</span>
            </div>
          </div>
        </div>

        {/* Community Blueprint Banner */}
        <div className="mt-8 mx-6 sm:mx-12 max-w-7xl xl:mx-auto bg-[#1E1F22] text-[#F7F5F0] border border-[#383A40] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FF88]" />
            <span>
              HAVE UNWORN GARMENTS? KAPHOR GENERATES CUSTOM ZERO-STITCH BLUEPRINTS FOR YOUR CLOSET.
            </span>
          </div>
          <button
            onClick={() => {
              sfx.click();
              setShowWaitlistModal(true);
            }}
            className="px-5 py-2 bg-[#A82222] text-[#FFFFFF] text-[10px] font-bold tracking-wider uppercase hover:bg-[#7A1616] transition-all shrink-0 shadow-sm"
          >
            GET UPCYCLING BLUEPRINTS
          </button>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 12 — SEE YOUR IMPACT: WARDROBE AUDIT ENGINE */}
      {/* ======================================================== */}
      <section id="calculator" className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="bg-[#FFFFFF] border border-[#1E1F22] p-6 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="border-b border-[#1E1F22] pb-3">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#A82222] uppercase font-bold mb-1">
                <span>SEE YOUR IMPACT</span>
                <span>//</span>
                <span>LESS WASTE, MORE VALUE</span>
              </div>
              <h3 className="font-bebas text-3xl sm:text-4xl text-[#1E1F22] mt-1">
                LESS CO₂. LESS WATER WASTE. MORE VALUE.
              </h3>
              <p className="text-xs font-mono text-[#383A40]">
                Every time you reuse instead of buying new, it makes a difference. Move the sliders to see how much your unworn clothes are worth — and how much you'd save the planet.
              </p>
            </div>

            {/* Sliders */}
            <div className="flex flex-col gap-4 font-mono text-xs">
              <div>
                <div className="flex justify-between text-[#1E1F22] mb-1 font-bold">
                  <span>Wedding & Ethnic Wear</span>
                  <span className="text-[#A82222]">{calcEthnic} garments</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={calcEthnic}
                  onChange={(e) => {
                    sfx.click();
                    setCalcEthnic(parseInt(e.target.value));
                  }}
                  className="w-full accent-[#A82222] bg-[#EAE6DF] h-2 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#1E1F22] mb-1 font-bold">
                  <span>Streetwear & Hoodies</span>
                  <span className="text-[#A82222]">{calcStreetwear} garments</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  value={calcStreetwear}
                  onChange={(e) => {
                    sfx.click();
                    setCalcStreetwear(parseInt(e.target.value));
                  }}
                  className="w-full accent-[#A82222] bg-[#EAE6DF] h-2 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#1E1F22] mb-1 font-bold">
                  <span>Bags & Totes</span>
                  <span className="text-[#A82222]">{calcBags} items</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={calcBags}
                  onChange={(e) => {
                    sfx.click();
                    setCalcBags(parseInt(e.target.value));
                  }}
                  className="w-full accent-[#A82222] bg-[#EAE6DF] h-2 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#1E1F22] mb-1 font-bold">
                  <span>Sneakers & Shoes</span>
                  <span className="text-[#A82222]">{calcSneakers} pairs</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={calcSneakers}
                  onChange={(e) => {
                    sfx.click();
                    setCalcSneakers(parseInt(e.target.value));
                  }}
                  className="w-full accent-[#A82222] bg-[#EAE6DF] h-2 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Calculator Output */}
          <div className="lg:col-span-5 bg-[#F7F5F0] border border-[#1E1F22] p-6 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#A82222] uppercase tracking-widest block mb-1 font-bold">
                VALUE HIDDEN IN YOUR CLOSET
              </span>
              <div className="font-bebas text-5xl text-[#1E1F22] tracking-wider">
                ₹{estimatedValueINR.toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] font-mono text-[#383A40] mt-2">
                Sell it, rent it, or swap it on Kaphor.
              </p>
            </div>

            <div className="my-6 border-t border-[#1E1F22] pt-4 flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <Leaf size={16} className="text-emerald-700 shrink-0" />
                <span className="text-[#1E1F22] font-bold">{estimatedCarbon} kg CO₂e Prevented</span>
              </div>
              <div className="flex items-center gap-3">
                <Droplets size={16} className="text-cyan-700 shrink-0" />
                <span className="text-[#1E1F22] font-bold">{estimatedWater}k Liters of Water Saved</span>
              </div>
            </div>

            <button
              onClick={() => {
                sfx.click();
                setShowWaitlistModal(true);
              }}
              className="w-full py-3 bg-[#A82222] text-[#FFFFFF] font-mono text-xs font-bold tracking-widest uppercase hover:bg-[#7A1616] transition-all shadow-sm"
            >
              ADD MY CLOTHES
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 05: PLANETARY IMPACT LEDGER */}
      {/* ======================================================== */}
      <section id="impact" className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 flex flex-col gap-3">
          <div className="text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
            OUR IMPACT SO FAR
          </div>
          <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide">
            REAL NUMBERS, REAL IMPACT
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center font-mono">
          <div className="border border-[#1E1F22] bg-[#FFFFFF] p-6 shadow-sm">
            <span className="font-bebas text-4xl text-[#1E1F22] block">52,480+</span>
            <span className="text-[10px] text-[#A82222] uppercase tracking-wider block mt-1 font-bold">PIECES CIRCULATED</span>
          </div>
          <div className="border border-[#1E1F22] bg-[#FFFFFF] p-6 shadow-sm">
            <span className="font-bebas text-4xl text-emerald-700 block">184,200</span>
            <span className="text-[10px] text-emerald-700 uppercase tracking-wider block mt-1 font-bold">KG CO₂E PREVENTED</span>
          </div>
          <div className="border border-[#1E1F22] bg-[#FFFFFF] p-6 shadow-sm">
            <span className="font-bebas text-4xl text-cyan-700 block">4.25M</span>
            <span className="text-[10px] text-cyan-700 uppercase tracking-wider block mt-1 font-bold">LITERS WATER SAVED</span>
          </div>
          <div className="border border-[#1E1F22] bg-[#FFFFFF] p-6 shadow-sm">
            <span className="font-bebas text-4xl text-[#C95F12] block">₹3.42 Cr</span>
            <span className="text-[10px] text-[#C95F12] uppercase tracking-wider block mt-1 font-bold">SAVED BY THRIFTERS</span>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 14 — THE KAPHOR LOOP */}
      {/* ======================================================== */}
      <section className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-12">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold mb-2">
            <span>THE KAPHOR LOOP</span>
            <span>●</span>
            <span>HOW IT ALL CONNECTS</span>
          </div>
          <h2 className="font-bebas text-4xl sm:text-6xl text-[#1E1F22] tracking-wide leading-none">
            ONE PLACE FOR THE WHOLE CYCLE.
          </h2>
          <p className="text-xs font-mono text-[#383A40] mt-3">
            Fashion isn't one-directional. Clothes move from person to person — and Kaphor makes that easy.
          </p>
        </div>

        {/* Circular Loop Graphic */}
        <div className="bg-[#FFFFFF] border-2 border-[#1E1F22] p-8 sm:p-12 shadow-md relative rounded-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center font-mono">
            {[
              { num: '01', name: 'DISCOVER', icon: '♠', sub: 'Find' },
              { num: '02', name: 'BUY', icon: '₹', sub: 'Buy' },
              { num: '03', name: 'WEAR', icon: '♥', sub: 'Wear' },
              { num: '04', name: 'SELL / SWAP / RENT', icon: '⇄', sub: 'Pass On' },
              { num: '05', name: 'REUSE', icon: '♦', sub: 'Reuse' },
              { num: '06', name: 'UPCYCLE / RECYCLE', icon: '✦', sub: 'Fix' },
              { num: '07', name: 'BACK IN ROTATION', icon: '↺', sub: 'Repeat' }
            ].map((node, i) => (
              <div
                key={node.num}
                className="border border-[#1E1F22] bg-[#F7F5F0] p-4 flex flex-col items-center justify-between hover:border-[#A82222] transition-colors group relative"
              >
                <div className="flex justify-between w-full text-[9px] text-[#9A8E7E] font-bold">
                  <span>{node.num}</span>
                  <span className="text-[#A82222]">{node.icon}</span>
                </div>
                <div className="my-3 font-bebas text-lg text-[#1E1F22] group-hover:text-[#A82222] transition-colors leading-tight">
                  {node.name}
                </div>
                <span className="text-[9px] bg-[#FFFFFF] px-2 py-0.5 border border-[#1E1F22]/20 text-[#383A40]">
                  {node.sub}
                </span>
                {i < 6 && (
                  <span className="hidden lg:block absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 text-xs font-black text-[#A82222]">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-[#1E1F22] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
            <span className="text-[#383A40]">
              Every cycle keeps clothes out of landfills and supports the people who make them.
            </span>
            <div className="flex items-center gap-2 text-[#A82222] font-bold">
              <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '8s' }} />
              <span>AND IT STARTS AGAIN.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 15 — WHY KAPHOR? & 16 — THE BIG IDEA */}
      {/* ======================================================== */}
      <section className="py-20 px-6 sm:px-12 border-b border-[#1E1F22] max-w-7xl mx-auto">
        {/* 15 — WHY KAPHOR? */}
        <div className="flex flex-col gap-3 mb-10 max-w-3xl">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-[#A82222] uppercase font-bold">
            <span>WHY KAPHOR?</span>
            <span>//</span>
            <span>BECAUSE FASHION SHOULDN'T BE THROWAWAY</span>
          </div>
          <h2 className="font-bebas text-4xl sm:text-5xl text-[#1E1F22] tracking-wide">
            WHAT WE BELIEVE IN
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
          {[
            {
              title: 'AI',
              desc: 'Smarter picks, fabric checks, and condition scanning — all powered by AI.',
              suit: '♠'
            },
            {
              title: 'CIRCULARITY',
              desc: 'Keep clothes moving between people instead of ending up in dumps.',
              suit: '♥'
            },
            {
              title: 'CHOICE',
              desc: 'Buy, sell, rent, or swap — you choose what works for you.',
              suit: '♦'
            },
            {
              title: 'IMPACT',
              desc: 'Real numbers on carbon saved, water conserved, and money unlocked.',
              suit: '♣'
            },
            {
              title: 'COMMUNITY',
              desc: 'Connect with people who appreciate well-made clothes and will actually wear them.',
              suit: '♠'
            }
          ].map((card) => (
            <div
              key={card.title}
              className="border-2 border-[#1E1F22] bg-[#FFFFFF] p-5 flex flex-col justify-between shadow-xs hover:border-[#A82222] transition-colors rounded-sm"
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-xs font-black text-[#A82222]">{card.suit}</span>
                  <span className="text-[9px] font-mono text-[#9A8E7E]">VERIFIED</span>
                </div>
                <h3 className="font-bebas text-2xl text-[#1E1F22] mb-1">{card.title}</h3>
                <p className="text-[11px] font-mono text-[#383A40] leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 16 — THE BIG IDEA */}
        <div className="bg-[#1E1F22] text-[#F7F5F0] border-2 border-[#1E1F22] p-8 sm:p-12 relative shadow-lg">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.3em] text-[#C9A84C] uppercase font-bold mb-3">
            <span>THE BIG IDEA</span>
          </div>
          <h2 className="font-bebas text-4xl sm:text-6xl text-[#F7F5F0] tracking-wide leading-none mb-4">
            THIS ISN'T JUST ANOTHER BUY-AND-SELL APP.<br />
            <span className="text-[#A82222]">IT'S A SYSTEM WHERE AI HELPS FASHION KEEP MOVING.</span>
          </h2>
          <p className="text-xs font-mono text-[#9A8E7E] max-w-2xl leading-relaxed mb-6">
            Everything we build has one goal: keep clothes in use, keep money circulating, and keep waste out of landfills.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#383A40] font-mono text-xs">
            <div className="border border-[#383A40] p-3 bg-[#14161C]">
              <span className="text-[#C9A84C] block font-bold mb-1">USE</span>
              <span>Wear them longer. Pass them on.</span>
            </div>
            <div className="border border-[#383A40] p-3 bg-[#14161C]">
              <span className="text-[#C9A84C] block font-bold mb-1">VALUE</span>
              <span>Keep the value flowing between people.</span>
            </div>
            <div className="border border-[#383A40] p-3 bg-[#14161C]">
              <span className="text-[#C9A84C] block font-bold mb-1">PLANET</span>
              <span>Keep textiles out of landfills.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* FINAL MANIFESTO FOOTER */}
      {/* ======================================================== */}
      <footer className="py-20 px-6 sm:px-12 bg-[#1E1F22] text-[#F7F5F0]">
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
          {/* Big Editorial Headline */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.3em] text-[#C9A84C] uppercase">
              <span>FROM US</span>
              <span>●</span>
              <span>TO YOU</span>
            </div>
            <h2 className="font-bebas text-5xl sm:text-7xl lg:text-8xl leading-[0.88] text-[#F7F5F0] tracking-wide">
              FASHION DOESN’T END. <span className="text-[#A82222]">IT KEEPS GOING.</span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-[#C9A84C] font-bold tracking-widest uppercase my-2">
              <span>BUY</span>
              <span>·</span>
              <span>SELL</span>
              <span>·</span>
              <span>RENT</span>
              <span>·</span>
              <span>SWAP</span>
              <span>·</span>
              <span>DISCOVER</span>
            </div>
            <p className="text-xs font-mono text-[#9A8E7E] max-w-xl leading-relaxed">
              Every piece of clothing was made by someone who cared. When we buy, rent, swap, or sell pre-loved fashion, we respect that craft — and help the planet too.
            </p>
          </div>

          {/* Quick Newsletter Signup */}
          <div className="border border-[#383A40] bg-[#14161C] p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col">
              <span className="font-bebas text-2xl text-[#F7F5F0] tracking-wide">
                JOIN US
              </span>
              <span className="text-[11px] font-mono text-[#9A8E7E]">
                Kaphor — pre-loved fashion, made simple. Get early access.
              </span>
            </div>

            <form onSubmit={handleJoinWaitlist} className="flex w-full md:w-auto items-center gap-2">
              <input
                type="email"
                placeholder="agent@kaphor.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="px-4 py-2 border border-[#383A40] bg-[#0E1013] text-xs font-mono text-[#F7F5F0] placeholder:text-[#6C707C] focus:outline-none focus:border-[#C9A84C] w-full md:w-64"
                required
              />
              <button
                type="submit"
                className="px-6 py-2 bg-[#A82222] text-[#F7F5F0] font-mono text-xs font-bold tracking-wider uppercase hover:bg-[#7A1616] transition-all shrink-0"
              >
                JOIN US
              </button>
            </form>
          </div>

          {/* Brand Status Bar Echo */}
          <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-[#9A8E7E] pt-6 border-t border-[#383A40]">
            <span>© 2026 KAPHOR INC.</span>
            <span className="text-[#C9A84C]">ALL TRADES VERIFIED & CIRCULAR.</span>
          </div>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* EARLY ACCESS / WAITLIST MODAL */}
      {/* ======================================================== */}
      {showWaitlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#FFFFFF] border-2 border-[#1E1F22] p-8 text-left shadow-2xl">
            <button
              onClick={() => {
                setShowWaitlistModal(false);
                setSubmittedWaitlist(false);
              }}
              className="absolute top-4 right-4 text-[#1E1F22] hover:text-[#A82222] text-lg font-mono font-bold"
            >
              [✕]
            </button>

            {!submittedWaitlist ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-[10px] tracking-widest text-[#A82222] uppercase font-mono font-bold">
                  <span>EARLY ACCESS</span>
                </div>

                <h3 className="font-bebas text-3xl text-[#1E1F22] tracking-wide">
                  GET EARLY ACCESS
                </h3>
                <p className="text-xs font-mono text-[#383A40] leading-relaxed">
                  Drop your email and we'll let you in early. You'll also get a free ₹500 swap credit to start with.
                </p>

                <form onSubmit={handleJoinWaitlist} className="flex flex-col gap-3 mt-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="px-4 py-3 bg-[#F7F5F0] border border-[#1E1F22] text-[#1E1F22] text-xs font-mono placeholder:text-[#9A8E7E] focus:outline-none focus:border-[#A82222]"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#A82222] text-[#FFFFFF] font-mono font-bold text-xs tracking-wider uppercase hover:bg-[#7A1616] transition-all shadow-md"
                  >
                    SEND ME IN
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center gap-4 py-6 font-mono">
                <div className="w-12 h-12 border-2 border-[#1E1F22] bg-[#EAE6DF] flex items-center justify-center text-[#A82222]">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-bebas text-3xl text-[#1E1F22] tracking-wide">
                  YOU'RE IN!
                </h3>
                <p className="text-xs text-[#383A40] leading-relaxed max-w-xs">
                  Check your inbox — your early access invite is on its way.
                </p>
                <button
                  onClick={() => {
                    setShowWaitlistModal(false);
                    setSubmittedWaitlist(false);
                  }}
                  className="mt-2 px-6 py-2 border border-[#1E1F22] text-xs text-[#1E1F22] hover:bg-[#1E1F22] hover:text-[#F7F5F0] transition-all"
                >
                  BACK TO SITE
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
