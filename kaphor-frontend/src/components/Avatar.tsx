import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Badge } from './Badge';

interface AvatarProps {
  uri: string;
  size?: number;
  tier?: string;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, size = 60, tier, style }) => {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image 
        source={{ uri }} 
        style={[styles.image, { borderRadius: size / 2 }]} 
      />
      {tier && (
        <View style={styles.badgeContainer}>
          <Badge variant="tier" label={tier.toUpperCase()} subType={tier} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
    borderColor: '#C9A84C', // Gold border
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    zIndex: 10,
  },
});
