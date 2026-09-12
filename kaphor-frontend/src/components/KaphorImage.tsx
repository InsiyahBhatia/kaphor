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



/**
 * Returns empty string for category fallback so mock Unsplash photos are NEVER shown.
 * When no image exists or image is broken, KaphorImage displays the authentic brutalist Kaphor card.
 */
export function getCategoryFallbackImage(category?: string | null): string {
  return '';
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

  // 1. Direct raw data / local device filesystem URI — pass through
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('ph://')
  ) {
    return trimmed;
  }

  // 2. S3 presigned or direct URL — pass through (presigned URLs contain ?X-Amz-... params)
  if (trimmed.includes('amazonaws.com')) {
    return trimmed;
  }

  const apiBase = (api.defaults.baseURL || 'https://kaphor-backend.onrender.com/api/v1')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/$/, '');

  // 3. Placeholder local:// prefix → resolve against backend
  if (trimmed.startsWith('local://')) {
    const rel = trimmed.replace('local://', '').replace(/^\//, '');
    const finalRel = rel.startsWith('uploads/') ? rel : `uploads/${rel}`;
    return `${apiBase}/${finalRel}`;
  }

  // 4. Relative paths — resolve against backend
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const cleanRel = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const finalRel = cleanRel.startsWith('uploads/') ? cleanRel : `uploads/${cleanRel}`;
    return `${apiBase}/${finalRel}`;
  }

  // 5. If it's a loopback/localhost/local LAN IP → redirect to S3
  const isLoopbackOrLocalIp =
    trimmed.includes('://localhost') ||
    trimmed.includes('://127.0.0.1') ||
    /:\/\/10\.\d+\.\d+\.\d+/.test(trimmed) ||
    /:\/\/192\.168\.\d+\.\d+/.test(trimmed) ||
    /:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(trimmed);

  if (isLoopbackOrLocalIp && trimmed.includes('/uploads/')) {
    const relativePath = trimmed.substring(trimmed.indexOf('/uploads/'));
    return `${apiBase}${relativePath}`;
  }

  // 6. Old Render backend URL with /uploads/ — return as-is (backend presigns)
  // These should already be presigned by backend; pass through unchanged.
  return trimmed;

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

  // Build candidate chain: primary URI, then optional explicit fallbackUri
  const candidates: string[] = React.useMemo(() => {
    const list: string[] = [];
    if (initialUri) {
      list.push(initialUri);
    }
    if (fallbackUri && !list.includes(fallbackUri)) {
      list.push(fallbackUri);
    }
    return list;
  }, [initialUri, fallbackUri]);

  useEffect(() => {
    setCandidateIndex(0);
    setHasFailedAll(false);
    setCurrentUri(candidates[0] || '');
  }, [candidates]);

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
    color: 'rgba(30,31,34,0.7)',
    letterSpacing: 1.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  fallbackArchive: {
    fontFamily: typography.mono,
    fontSize: 7,
    color: 'rgba(30,31,34,0.4)',
    letterSpacing: 1,
    marginTop: 2,
  },
});
