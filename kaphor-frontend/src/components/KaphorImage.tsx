import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { radius, colors, typography } from '../theme';
import { api } from '../services/api';

interface KaphorImageProps {
  uri?: string | string[] | null;
  style?: ImageStyle;
  contentFit?: 'cover' | 'contain';
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  category?: string | null;
  brand?: string | null;
  fallbackUri?: string | null;
}

const AWS_S3_BASE = 'https://kaphor-media-uploads.s3.eu-north-1.amazonaws.com';

/**
 * Curated high-resolution fashion editorial imagery for category fallbacks.
 * Ensures that if any user or network upload is missing/404, a beautiful authentic garment image is shown.
 */
export function getCategoryFallbackImage(category?: string | null): string {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('kurta') || cat.includes('ethnic') || cat.includes('saree') || cat.includes('lehenga')) {
    return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1000';
  }
  if (cat.includes('jewelry') || cat.includes('jewel') || cat.includes('accessory') || cat.includes('accessories') || cat.includes('pendant') || cat.includes('necklace') || cat.includes('ring') || cat.includes('earring')) {
    return 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=1000';
  }
  if (cat.includes('denim') || cat.includes('jean')) {
    return 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&q=80&w=1000';
  }
  if (cat.includes('bottom') || cat.includes('pant') || cat.includes('skirt') || cat.includes('trouser')) {
    return 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=1000';
  }
  if (cat.includes('top') || cat.includes('shirt') || cat.includes('t-shirt') || cat.includes('sweatshirt') || cat.includes('jacket')) {
    return 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1000';
  }
  if (cat.includes('rental') || cat.includes('dress')) {
    return 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1000';
  }
  return 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=1000';
}

/**
 * Normalizes any image URI:
 * - Handles string or string[] (picks first valid non-empty string).
 * - Handles local device filesystem / base64 / blob / iOS ph URI directly.
 * - Rewrites localhost / 127.0.0.1 / local LAN IPs to active API baseURL.
 * - Handles relative `/uploads/...` paths.
 * - Leaves S3, Cloudinary, Firebase Storage, and external HTTP(S) intact.
 */
export function normalizeImageUri(uri: string | string[] | null | undefined): string {
  if (!uri) return '';
  const rawStr = Array.isArray(uri)
    ? (uri.find((item) => typeof item === 'string' && item.trim().length > 0) || '')
    : uri;

  if (typeof rawStr !== 'string') return '';
  const trimmed = rawStr.trim();
  if (!trimmed) return '';

  // 1. Direct raw data / local device filesystem URI
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('ph://')
  ) {
    return trimmed;
  }

  const apiBase = (api.defaults.baseURL || 'https://kaphor-backend.onrender.com/api/v1')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/$/, '');

  // 2. Placeholder local:// prefix
  if (trimmed.startsWith('local://')) {
    const rel = trimmed.replace('local://', '');
    const cleanRel = rel.startsWith('/') ? rel.slice(1) : rel;
    const finalRel = cleanRel.startsWith('uploads/') ? cleanRel : `uploads/${cleanRel}`;
    return `${apiBase}/${finalRel}`;
  }

  // 3. Relative paths (e.g. "/uploads/messages/..." or "uploads/garments/...")
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const cleanRel = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const finalRel = cleanRel.startsWith('uploads/') ? cleanRel : `uploads/${cleanRel}`;
    return `${apiBase}/${finalRel}`;
  }

  // 4. If it's a loopback/localhost/local LAN IP (e.g. http://localhost:4000/uploads/... or http://127.0.0.1:4000/...)
  const isLoopbackOrLocalIp =
    trimmed.includes('://localhost') ||
    trimmed.includes('://127.0.0.1') ||
    /:\/\/10\.\d+\.\d+\.\d+/.test(trimmed) ||
    /:\/\/192\.168\.\d+\.\d+/.test(trimmed) ||
    /:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(trimmed);

  if (isLoopbackOrLocalIp && trimmed.includes('/uploads/')) {
    const uploadIndex = trimmed.indexOf('/uploads/');
    const relativePath = trimmed.substring(uploadIndex);
    return `${apiBase}${relativePath}`;
  }

  return trimmed;
}

/**
 * Builds secondary candidate S3 URLs for any `/uploads/...` resource
 */
function getS3CandidateUrls(uri: string): string[] {
  if (!uri) return [];
  const candidates: string[] = [];

  if (uri.includes('/uploads/')) {
    const afterUploads = uri.substring(uri.indexOf('/uploads/') + 9); // e.g. 'garments/abc.jpeg'
    if (afterUploads) {
      candidates.push(`${AWS_S3_BASE}/${afterUploads}`);
      candidates.push(`${AWS_S3_BASE}/uploads/${afterUploads}`);
    }
  }

  return candidates;
}

export function KaphorImage({
  uri,
  style,
  contentFit = 'cover',
  fallbackIcon = 'shirt-outline',
  category,
  brand,
  fallbackUri,
}: KaphorImageProps) {
  const initialUri = normalizeImageUri(uri);
  const [currentUri, setCurrentUri] = useState<string>(initialUri);
  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [hasFailedAll, setHasFailedAll] = useState<boolean>(false);

  // Build candidate chain whenever primary URI changes
  const candidates: string[] = React.useMemo(() => {
    const list: string[] = [];
    if (initialUri) {
      list.push(initialUri);
      // Add S3 variations if applicable
      const s3Variants = getS3CandidateUrls(initialUri);
      for (const s3Url of s3Variants) {
        if (!list.includes(s3Url)) {
          list.push(s3Url);
        }
      }
    }
    if (fallbackUri && !list.includes(fallbackUri)) {
      list.push(fallbackUri);
    }
    // High-resolution category editorial fallback
    const catFallback = getCategoryFallbackImage(category);
    if (!list.includes(catFallback)) {
      list.push(catFallback);
    }
    return list;
  }, [initialUri, fallbackUri, category]);

  useEffect(() => {
    setCandidateIndex(0);
    setHasFailedAll(false);
    setCurrentUri(candidates[0] || getCategoryFallbackImage(category));
  }, [candidates, category]);

  const handleError = () => {
    const nextIdx = candidateIndex + 1;
    if (nextIdx < candidates.length) {
      setCandidateIndex(nextIdx);
      setCurrentUri(candidates[nextIdx]);
    } else {
      setHasFailedAll(true);
    }
  };

  if (!currentUri || hasFailedAll) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <Ionicons
          name={fallbackIcon}
          size={Math.min(32, typeof style?.height === 'number' ? style.height * 0.35 : 28)}
          color="rgba(30,31,34,0.4)"
        />
        <Text style={styles.fallbackBrand}>{brand || 'KAPHOR'}</Text>
        <Text style={styles.fallbackArchive}>AUTHENTIC ARCHIVE</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={[{ borderRadius: radius.md }, style]}
      contentFit={contentFit}
      recyclingKey={currentUri}
      cachePolicy="memory-disk"
      priority="high"
      transition={150}
      onError={handleError}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    borderRadius: radius.md,
    backgroundColor: '#EBE8DF',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  fallbackBrand: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(30,31,34,0.6)',
    letterSpacing: 1.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  fallbackArchive: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '700',
    color: 'rgba(30,31,34,0.35)',
    letterSpacing: 1,
    marginTop: 2,
  },
});
