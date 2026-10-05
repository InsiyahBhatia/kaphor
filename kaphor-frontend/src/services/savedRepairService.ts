/**
 * Saved Repair Items
 *
 * Keeps saved YouTube tutorials and blog posts on the device (AsyncStorage)
 * so people can come back to them later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlogArticle, T5GuideResult, YouTubeVideo } from './repairService';

const STORAGE_KEY = '@kaphor/saved_repair_sessions';

export interface SavedRepairItem {
  id: string;
  savedAt: string;
  // Blog posts are stored as 'guide' items (title, source and link only)
  type: 'guide' | 'youtube';
  garmentLabel?: string;
  damageTypes?: string[];
  guide?: T5GuideResult;
  video?: YouTubeVideo;
}

interface SavedRepairStore {
  items: SavedRepairItem[];
}

async function writeItems(items: SavedRepairItem[]): Promise<void> {
  const store: SavedRepairStore = { items };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Load all saved items */
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

/** Is this item saved? */
export async function isRepairSaved(id: string): Promise<boolean> {
  const items = await loadSavedRepairs();
  return items.some((i) => i.id === id);
}

/** Remove a saved item */
export async function removeSavedRepair(id: string): Promise<void> {
  const items = await loadSavedRepairs();
  await writeItems(items.filter((i) => i.id !== id));
}

/** Save or unsave an item. Returns the new state. */
async function toggleItem(item: Omit<SavedRepairItem, 'savedAt'>): Promise<{ saved: boolean; id: string }> {
  const items = await loadSavedRepairs();
  if (items.some((i) => i.id === item.id)) {
    await writeItems(items.filter((i) => i.id !== item.id));
    return { saved: false, id: item.id };
  }
  await writeItems([{ ...item, savedAt: new Date().toISOString() }, ...items]);
  return { saved: true, id: item.id };
}

export function youtubeSaveId(video: YouTubeVideo): string {
  return `yt-${video.videoId}`;
}

export function blogSaveId(blog: BlogArticle): string {
  return `blog-${blog.id}`;
}

export function guideSaveId(guide: T5GuideResult): string {
  return `guide-${guide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
}

/** Save or unsave a YouTube video */
export function toggleSaveYouTube(
  video: YouTubeVideo,
  garmentLabel?: string,
  damageTypes?: string[],
) {
  return toggleItem({ id: youtubeSaveId(video), type: 'youtube', garmentLabel, damageTypes, video });
}

/** Save or unsave a blog post */
export function toggleSaveBlog(
  blog: BlogArticle,
  mode: 'repair' | 'upcycle',
  garmentLabel?: string,
  damageTypes?: string[],
) {
  const guide: T5GuideResult = {
    doc_type: mode,
    title: blog.title,
    difficulty: blog.difficulty,
    time_minutes: blog.time_minutes ?? 30,
    technique_style: blog.source,
    tools_required: [],
    steps: [],
    source: 'blog',
    source_url: blog.url,
  };
  return toggleItem({ id: blogSaveId(blog), type: 'guide', garmentLabel, damageTypes, guide });
}

/** Save or unsave a guide (older saved items) */
export function toggleSaveGuide(
  guide: T5GuideResult,
  garmentLabel?: string,
  damageTypes?: string[],
) {
  return toggleItem({ id: guideSaveId(guide), type: 'guide', garmentLabel, damageTypes, guide });
}
