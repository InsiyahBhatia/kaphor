import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps {
  label?: string;
  error?: string;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  style?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  placeholder,
  secureTextEntry,
  value,
  onChangeText,
  leftIcon,
  rightIcon,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  style
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.focused,
        error ? styles.errorBorder : null,
        multiline && { height: 100, alignItems: 'flex-start', paddingTop: 12 }
      ]}>
        {leftIcon && <Ionicons name={leftIcon} size={20} color="#6B5C52" style={styles.icon} />}
        
        <TextInput
          style={[styles.input, multiline && { textAlignVertical: 'top' }]}
          placeholder={placeholder}
          placeholderTextColor="#6B5C52"
          secureTextEntry={secureTextEntry && !showPassword}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
        />

        {secureTextEntry ? (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons 
              name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
              size={20} 
              color="#6B5C52" 
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <Ionicons name={rightIcon} size={20} color="#6B5C52" />
        ) : null}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 12 },
  label: { color: '#C9A84C', fontSize: 12, marginBottom: 8, letterSpacing: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0C10',
    borderBottomWidth: 1,
    borderBottomColor: '#3A2C30',
    height: 50,
    paddingHorizontal: 12,
  },
  focused: { borderBottomColor: '#9B1B30' },
  errorBorder: { borderBottomColor: '#FF4D4D' },
  input: { flex: 1, color: '#FFF5E1', fontSize: 14, letterSpacing: 1 },
  icon: { marginRight: 12 },
  errorText: { color: '#FF4D4D', fontSize: 10, marginTop: 4 },
});
