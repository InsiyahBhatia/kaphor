import { Image, ImageStyle } from 'expo-image';
import { radius } from '../theme';
import { api } from '../services/api';

interface KaphorImageProps {
  uri: string;
  style?: ImageStyle;
  contentFit?: 'cover' | 'contain';
}

export function KaphorImage({ uri, style, contentFit = 'cover' }: KaphorImageProps) {
  const fullUri = uri?.startsWith('http') 
    ? uri 
    : `${api.defaults.baseURL?.replace('/api/v1', '')}${uri?.startsWith('/') ? '' : '/'}${uri}`;

  return (
    <Image
      source={{ uri: fullUri }}
      style={[{ borderRadius: radius.md }, style]}
      contentFit={contentFit}
      recyclingKey={fullUri}
    />
  );
}
