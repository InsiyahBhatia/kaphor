import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { KaphorLogo } from './KaphorLogo';

/**
 * Full-screen splash (the Kaphor logo on paper) shown while the session is restored / the user logs in.
 * Covers the screen (pointer events blocked) and fades out when `visible` turns false.
 */
export function BrandSplash({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, opacity]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityRole="progressbar"
      accessibilityLabel="Kaphor is loading"
    >
      <View style={styles.center}>
        <KaphorLogo size={64} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.paper,
    zIndex: 9999,
    elevation: 9999,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
