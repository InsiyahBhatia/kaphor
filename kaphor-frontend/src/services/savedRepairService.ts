/**
 * Saved Repair Sessions Service
 *
 * Persists saved repair guides and YouTube tutorials to AsyncStorage
 * so users can bookmark sessions to their profile for later reference.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { T5GuideResult, YouTubeVideo } from './repairService';

const STORAGE_KEY = '@kaphor/saved_repair_sessions';

export interface SavedRepairItem {
  id: string;
  savedAt: string;
  type: 'guide' | 'youtube';
  garmentLabel?: string;
  damageTypes?: string[];
  // Guide-specific
  guide?: T5GuideResult;
  // YouTube-specific
  video?: YouTubeVideo;
}

interface SavedRepairStore {
  items: SavedRepairItem[];
}

/**
 * Load all saved repair items from AsyncStorage
 */
export async function loadSavedRepairs(): Promise<SavedRepairItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const store: SavedRepairStore = JSON.parse(raw);
    return store.items || [];
  } catch {
    return [];
  }
}

/**
 * Check if a specific guide or video is saved
 */
export async function isRepairSaved(id: string): Promise<boolean> {
  const items = await loadSavedRepairs();
  return items.some((i) => i.id === id);
}

/**
 * Save a repair guide to local storage
 */
async function saveRepairGuide(
  guide: T5GuideResult,
  garmentLabel?: string,
  damageTypes?: string[],
): Promise<void> {
  const items = await loadSavedRepairs();
  const id = `guide-${guide.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)}`;

  // Don't duplicate
  if (items.some((i) => i.id === id)) return;

  const newItem: SavedRepairItem = {
    id,
    savedAt: new Date().toISOString(),
    type: 'guide',
    garmentLabel,
    damageTypes,
    guide,
  };

  const updated: SavedRepairStore = { items: [newItem, ...items] };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Save a YouTube tutorial to local storage
 */
async function saveRepairYouTube(
  video: YouTubeVideo,
  garmentLabel?: string,
  damageTypes?: string[],
): Promise<void> {
  const items = await loadSavedRepairs();
  const id = `yt-${video.videoId}`;

  // Don't duplicate
  if (items.some((i) => i.id === id)) return;

  const newItem: SavedRepairItem = {
    id,
    savedAt: new Date().toISOString(),
    type: 'youtube',
    garmentLabel,
    damageTypes,
    video,
  };

  const updated: SavedRepairStore = { items: [newItem, ...items] };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Remove a saved repair item by id
 */
export async function removeSavedRepair(id: string): Promise<void> {
  const items = await loadSavedRepairs();
  const updated: SavedRepairStore = {
    items: items.filter((i) => i.id !== id),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Toggle save state for a guide
 */
export async function toggleSaveGuide(
  guide: T5GuideResult,
  garmentLabel?: string,
  damageTypes?: string[],
): Promise<{ saved: boolean; id: string }> {
  const id = `guide-${guide.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)}`;

  const isSaved = await isRepairSaved(id);
  if (isSaved) {
    await removeSavedRepair(id);
    return { saved: false, id };
  } else {
    await saveRepairGuide(guide, garmentLabel, damageTypes);
    return { saved: true, id };
  }
}

/**
 * Toggle save state for a YouTube video
 */
export async function toggleSaveYouTube(
  video: YouTubeVideo,
  garmentLabel?: string,
  damageTypes?: string[],
): Promise<{ saved: boolean; id: string }> {
  const id = `yt-${video.videoId}`;

  const isSaved = await isRepairSaved(id);
  if (isSaved) {
    await removeSavedRepair(id);
    return { saved: false, id };
  } else {
    await saveRepairYouTube(video, garmentLabel, damageTypes);
    return { saved: true, id };
  }
}
