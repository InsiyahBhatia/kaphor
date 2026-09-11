import React, { useState } from 'react';
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
 * - Rewrites localhost / local IPs / obsolete dev URLs to the active API baseURL host.
 * - Handles relative `/uploads/...` paths.
 * - Leaves S3, Cloudinary, data URIs, and external HTTP(S) intact.
 */
function normalizeImageUri(uri: string): string {
  const trimmed = uri.trim();
  const apiBase = (api.defaults.baseURL || 'https://kaphor-backend.onrender.com/api/v1')
    .replace(/\/api\/v1\/?$/, '');

  // 1. If it's a local filesystem / base64 / blob / iOS ph URI, return directly
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('ph://')
  ) {
    return trimmed;
  }

  // 2. If it's a local:// placeholder prefix
  if (trimmed.startsWith('local://')) {
    const rel = trimmed.replace('local://', '');
    return `${apiBase}/uploads/${rel.startsWith('/') ? rel.slice(1) : rel}`;
  }

  // 3. If it contains /uploads/ with localhost or an IP (e.g. http://localhost:4000/uploads/... or http://192.168.x.x:4000/uploads/...)
  if (trimmed.includes('/uploads/')) {
    const uploadIndex = trimmed.indexOf('/uploads/');
    const relativePath = trimmed.substring(uploadIndex);
    return `${apiBase}${relativePath}`;
  }

  // 4. If it's a relative path like "uploads/..." or "/garments/..."
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `${apiBase}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }

  // 5. If it's an external HTTP/HTTPS URL (e.g. S3, Unsplash, Cloudinary), return directly
  return trimmed;
}

export function KaphorImage({
  uri,
  style,
  contentFit = 'cover',
  fallbackIcon = 'shirt-outline',
}: KaphorImageProps) {
  const [hasError, setHasError] = useState(false);

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
      transition={200}
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
