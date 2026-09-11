import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { radius, colors, typography } from '../theme';
import { api } from '../services/api';

interface KaphorImageProps {
  uri?: string | null;
  style?: ImageStyle;
  contentFit?: 'cover' | 'contain';
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Normalizes any image URI:
 * - Handles local device filesystem / base64 / blob / iOS ph URI directly.
 * - Rewrites localhost / 127.0.0.1 / local LAN IPs to active API baseURL.
 * - Handles relative `/uploads/...` paths.
 * - Leaves S3, Cloudinary, Firebase Storage, and external HTTP(S) intact.
 */
export function normalizeImageUri(uri: string): string {
  if (!uri || typeof uri !== 'string') return '';
  const trimmed = uri.trim();
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

  // 5. External URLs (S3, Cloudinary, Firebase Storage, Unsplash, etc.)
  return trimmed;
}

export function KaphorImage({
  uri,
  style,
  contentFit = 'cover',
  fallbackIcon = 'shirt-outline',
}: KaphorImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  if (!uri || typeof uri !== 'string' || uri.trim() === '' || hasError) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <Ionicons
          name={fallbackIcon}
          size={Math.min(32, typeof style?.height === 'number' ? style.height * 0.35 : 28)}
          color="rgba(30,31,34,0.3)"
        />
        <Text style={styles.fallbackBrand}>KAPHOR</Text>
      </View>
    );
  }

  const fullUri = normalizeImageUri(uri);

  return (
    <Image
      source={{ uri: fullUri }}
      style={[{ borderRadius: radius.md }, style]}
      contentFit={contentFit}
      recyclingKey={fullUri}
      cachePolicy="memory-disk"
      priority="high"
      transition={150}
      onError={() => {
        setHasError(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    borderRadius: radius.md,
    backgroundColor: '#EBE8DF',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fallbackBrand: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: 'rgba(30,31,34,0.25)',
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
