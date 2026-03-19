import { Image, ImageStyle } from 'expo-image';
import { radius } from '../theme';

interface KaphorImageProps {
  uri: string;
  style?: ImageStyle;
  contentFit?: 'cover' | 'contain';
}

export function KaphorImage({ uri, style, contentFit = 'cover' }: KaphorImageProps) {
  return (
    <Image
      source={{ uri }}
      style={[{ borderRadius: radius.md }, style]}
      contentFit={contentFit}
      recyclingKey={uri}
    />
  );
}
