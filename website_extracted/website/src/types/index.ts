export type ZoneId = 'studio' | 'inspection' | 'styling' | 'swap' | 'marketplace' | 'ecosystem';

export interface CameraWaypoint {
  pos: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export interface DefectItem {
  id: string;
  type: string;
  location: string;
  confidence: number;
  grade: string;
  estimatedCostImpact: string;
  coordinates: [number, number, number];
}

export interface AccessoryItem {
  id: string;
  name: string;
  category: 'sunglasses' | 'bag' | 'sneakers';
  styleMatch: number;
  dockPosition: [number, number, number];
  orbitPosition: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  isActive: boolean;
}

export interface RackGarment {
  id: string;
  title: string;
  brand: string;
  category: string;
  condition: string;
  conditionScore: number;
  price: number;
  marketPrice: number;
  co2SavedKg: number;
  position: [number, number, number];
  rotation: [number, number, number];
}
