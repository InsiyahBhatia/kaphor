import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { SolarIcon } from './common/SolarIcon';
import { radius, colors, typography } from '../theme';
import { api } from '../services/api';

interface KaphorImageProps {
  uri?: string | string[] | null;
  style?: ImageStyle;
  contentFit?: 'cover' | 'contain';
  fallbackIcon?: keyof typeof SolarIcon.glyphMap;
  category?: string | null;
  brand?: string | null;
  fallbackUri?: string | null;
  /** Display width in dp - used to request a right-sized Cloudinary thumbnail (default: from style.width or 600) */
  width?: number;
  /** Stable key for list recycling (defaults to the uri) */
  recyclingKey?: string;
  /** Eager load (detail hero). Lists use the default 'normal' */
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Cloudinary delivery optimisation: injects f_auto,q_auto,w_<2x width> after /upload/.
 * Local file/base64/blob and non-Cloudinary URLs are returned untouched.
 */
export function optimizedUri(uri: string, width?: number): string {
  if (!uri || !uri.includes('res.cloudinary.com') || !uri.includes('/upload/')) return uri;
  const w = Math.max(100, Math.min(1600, Math.round((width ?? 600) * 2 / 50) * 50));
  const idx = uri.indexOf('/upload/');
  const head = uri.slice(0, idx);
  const tail = uri.slice(idx + 8);
  // Already transformed (f_/q_/w_ segment first)? leave alone
  if (/(^|,)(f_|q_|w_)/.test(tail.split('/')[0])) return uri;
  return `${head}/upload/f_auto,q_auto,w_${w}/${tail}`;
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
 * - Leaves Cloudinary, Firebase Storage, and external HTTP(S) intact.
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

  // 2. Cloudinary URL — pass through
  if (trimmed.includes('res.cloudinary.com')) {
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

  // 5. If it's a loopback/localhost/local LAN IP → redirect to the active backend
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

  // 6. Backend URL with /uploads/ — return as-is
  // Already resolved by the backend; pass through unchanged.
  return trimmed;

}


const IMAGE_BG = { backgroundColor: colors.paperDark };

export function KaphorImage({
  uri,
  style,
  contentFit = 'cover',
  fallbackIcon = 'shirt-outline',
  category,
  brand,
  fallbackUri,
  width,
  recyclingKey,
  priority = 'normal',
}: KaphorImageProps) {
  const flatWidth = width ?? (typeof (style as any)?.width === 'number' ? ((style as any).width as number) : undefined);
  const initialUri = React.useMemo(() => optimizedUri(normalizeImageUri(uri), flatWidth), [uri, flatWidth]);
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

  const handleError = React.useCallback(() => {
    const nextIdx = candidateIndex + 1;
    if (nextIdx < candidates.length) {
      setCandidateIndex(nextIdx);
      setCurrentUri(candidates[nextIdx]);
    } else {
      setHasFailedAll(true);
    }
  }, [candidateIndex, candidates]);

  if (!currentUri || hasFailedAll) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <SolarIcon
          name={fallbackIcon}
          size={Math.min(32, typeof style?.height === 'number' ? style.height * 0.35 : 28)}
          color={colors.textMuted}
        />
        <Text style={styles.fallbackBrand}>{brand || 'KAPHOR'}</Text>
        <Text style={styles.fallbackArchive}>PRE-OWNED</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={[IMAGE_BG, { borderRadius: radius.md }, style]}
      contentFit={contentFit}
      recyclingKey={recyclingKey ?? currentUri}
      cachePolicy="memory-disk"
      priority={priority}
      transition={150}
      onError={handleError}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  fallbackBrand: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 6,
  },
  fallbackArchive: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
});
