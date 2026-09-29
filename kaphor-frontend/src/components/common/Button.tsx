import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

import { hapticFeedback } from '../../utils/haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false,
  style
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  return (
    <TouchableOpacity 
      style={[
        styles.base,
        styles[size],
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        style
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? 'white' : '#9B1B30'} />
      ) : (
        <Text style={[
          styles.textBase,
          styles[`${size}Text`],
          isPrimary && styles.primaryText,
          isSecondary && styles.secondaryText,
          isGhost && styles.ghostText,
          disabled && styles.disabledText
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  sm: { height: 36, paddingHorizontal: 12 },
  md: { height: 50, paddingHorizontal: 20 },
  lg: { height: 60, paddingHorizontal: 32 },
  
  primary: { backgroundColor: '#9B1B30' },
  secondary: { borderWidth: 1, borderColor: '#9B1B30' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },

  textBase: { fontWeight: '700', letterSpacing: 1 },
  smText: { fontSize: 12 },
  mdText: { fontSize: 14 },
  lgText: { fontSize: 16 },

  primaryText: { color: 'white' },
  secondaryText: { color: '#9B1B30' },
  ghostText: { color: '#C9A84C' },
  disabledText: { color: '#6B5C52' },
});
