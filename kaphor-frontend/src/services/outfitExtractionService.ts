import api from './api';
import * as FileSystem from 'expo-file-system';

export interface ExtractedGarment {
  id: string;
  title: string;
  brand: string;
  category: string;
  subCategory?: string;
  description?: string;
  size?: string;
  condition: string;
  color: string[];
  material: string[];
  estimatedPrice: number;
  suggestedRentalPriceDay: number;
  suggestedRentalPriceWeek: number;
  imageUrl: string;
  isCutout: boolean;
}

export const outfitExtractionService = {
  /**
   * Scans a full-body outfit photo or mirror selfie:
   * Uses Gemini Vision to segment garments + Photoroom API to create clean studio cutouts.
   */
  async extractFromOutfit(imageUri: string): Promise<ExtractedGarment[]> {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    const { data } = await api.post(
      '/ai/extract-outfit-items',
      { image: `data:image/jpeg;base64,${base64}` },
      { timeout: 90000 } // Allow ample time for Gemini + Photoroom processing
    );

    return data.data || [];
  },

  /**
   * Ingests one or more extracted garments directly into the user's private digital wardrobe.
   */
  async addItemsToWardrobe(items: ExtractedGarment[]): Promise<any[]> {
    const { data } = await api.post('/users/me/wardrobe/items', { items });
    return data.data || [];
  },
};
