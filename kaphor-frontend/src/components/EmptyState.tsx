import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './common/Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  ctaLabel?: string;
  onPressCTA?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, ctaLabel, onPressCTA }) => {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color="#3A2C30" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {ctaLabel && onPressCTA && (
        <Button 
          title={ctaLabel} 
          onPress={onPressCTA} 
          variant="secondary" 
          size="md" 
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    color: '#D4AF37',
    fontSize: 20,
    fontFamily: 'BebasNeue_400Regular',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    color: '#6B5C52',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    width: '100%',
  },
});
