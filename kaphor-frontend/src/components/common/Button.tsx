import React from 'react';
import { colors } from '../../theme';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

import { hapticFeedback } from '../../utils/haptics';
import { Spinner } from './Loader';

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
        <Spinner color={isPrimary ? colors.white : colors.rose} />
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
  
  primary: { backgroundColor: colors.rose },
  secondary: { borderWidth: 1, borderColor: colors.rose },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },

  textBase: { fontWeight: '700', letterSpacing: 1 },
  smText: { fontSize: 12 },
  mdText: { fontSize: 14 },
  lgText: { fontSize: 16 },

  primaryText: { color: colors.white },
  secondaryText: { color: colors.rose },
  ghostText: { color: colors.gold },
  disabledText: { color: colors.textMuted },
});
