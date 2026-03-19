import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string | null;
  bio?: string | null;
  role: string;
  tier?: string;
}

interface UserState {
  profile: UserProfile | null;
  impact: {
    carbonSavedKg: number;
    waterSavedL: number;
    itemsCirculated: number;
    itemsUpcycled: number;
    itemsRecycled: number;
  } | null;
  setProfile: (profile: UserProfile | null) => void;
  setImpact: (impact: UserState['impact']) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  impact: null,
  setProfile: (profile) => set({ profile }),
  setImpact: (impact) => set({ impact }),
  reset: () => set({ profile: null, impact: null }),
}));
