import axios from 'axios';
import { logger } from '../lib/logger';

export interface PhotoroomOptions {
  backgroundColor?: string; // 'transparent' or '#FFFFFF'
  padding?: number; // 0.05 to 0.2 (percentage of padding)
  outputFormat?: 'png' | 'jpeg';
}

/**
 * Removes background using Photoroom API and returns studio-quality cutout buffer.
 * If Photoroom API is unavailable or key is not provided, gracefully returns the input buffer.
 */
export async function removeBackgroundWithPhotoroom(
  imageBuffer: Buffer,
  options: PhotoroomOptions = {}
): Promise<{ buffer: Buffer; mimeType: string; isCutout: boolean }> {
  const apiKey = process.env.PHOTOROOM_API_KEY?.trim();

  if (!apiKey) {
    logger.warn('PHOTOROOM_API_KEY is not configured. Returning original cropped image.');
    return { buffer: imageBuffer, mimeType: 'image/jpeg', isCutout: false };
  }

  const {
    backgroundColor = '#FFFFFF',
    padding = 0.08,
    outputFormat = 'png'
  } = options;

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
    formData.append('image_file', blob, 'garment.jpg');
    
    if (backgroundColor === 'transparent') {
      formData.append('background.color', 'transparent');
    } else {
      formData.append('background.color', backgroundColor);
    }
    formData.append('padding', String(padding));
    formData.append('output_format', outputFormat);

    logger.info('Calling Photoroom API for background removal and studio cutout...');
    
    const response = await axios.post('https://image-api.photoroom.com/v2/edit', formData, {
      headers: {
        'x-api-key': apiKey,
      },
      responseType: 'arraybuffer',
      timeout: 25000,
    });

    const cutoutBuffer = Buffer.from(response.data);
    logger.info(`Photoroom cutout generated successfully (${cutoutBuffer.length} bytes)`);

    return {
      buffer: cutoutBuffer,
      mimeType: outputFormat === 'png' ? 'image/png' : 'image/jpeg',
      isCutout: true,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data ? Buffer.from(err.response.data).toString('utf-8') : err.message;
    logger.warn(`Photoroom API call failed (status: ${status || 'unknown'}, error: ${msg}). Falling back to original image crop.`);
    return { buffer: imageBuffer, mimeType: 'image/jpeg', isCutout: false };
  }
}
