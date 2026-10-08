import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToastStore } from '../../store/toastStore';
import { colors, typography } from '../../theme';

export function Toast() {
  const { message, type, isVisible } = useToastStore();
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(translateY, {
        toValue: 20,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  if (!message) return null;

  return (
    <SafeAreaView style={styles.container} pointerEvents="none">
      <Animated.View 
        style={[
          styles.toastBox, 
          { transform: [{ translateY }] },
          type === 'error' && styles.errorBox,
          type === 'success' && styles.successBox
        ]}
      >
        <Text style={[
          styles.toastText,
          type === 'error' && styles.errorText,
          type === 'success' && styles.successText
        ]}>
          {message}
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toastBox: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    width: '100%',
  },
  errorBox: {
    backgroundColor: colors.red,
  },
  successBox: {
    backgroundColor: colors.white,
  },
  toastText: {
    fontFamily: typography.handSemi,
    color: colors.white,
    fontSize: 15,
    lineHeight: 24,
  },
  errorText: {
    color: colors.white,
  },
  successText: {
    color: colors.charcoal,
  },
});
