import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { aiService } from '../../src/services/aiService';

const STYLES = ['MINIMALIST', 'VINTAGE', 'BOLD', 'LUXURY', 'STREETWEAR'];

export default function StyleQuizScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (style: string) => {
    setSelected((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const handleFinish = async () => {
    if (selected.length === 0) {
      Alert.alert('Select at least one style', 'This helps us curate your feed.');
      return;
    }
    setSubmitting(true);
    try {
      await aiService.submitStyleQuiz(selected);
    } catch (err) {
      // Non-blocking: quiz data is a nice-to-have, don't block onboarding
      console.warn('Style quiz submission failed, continuing to home', err);
    } finally {
      setSubmitting(false);
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>STEP 1 OF 1</Text>
        <Text style={styles.title}>Define your Aesthetic</Text>
        <Text style={styles.subtitle}>
          Select the styles that resonate most with your heritage
        </Text>
      </View>

      <View style={styles.options}>
        {STYLES.map((style) => {
          const isActive = selected.includes(style);
          return (
            <TouchableOpacity
              key={style}
              style={[styles.optionButton, isActive && styles.optionButtonActive]}
              onPress={() => toggle(style)}
            >
              <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                {style}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.nextButton, selected.length === 0 && styles.nextButtonDisabled]}
        onPress={handleFinish}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#1A0C10" />
        ) : (
          <Text style={styles.nextButtonText}>FINISH & EXPLORE</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 60,
  },
  step: {
    color: '#D4AF37',
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B5C52',
    marginTop: 8,
  },
  options: {
    gap: 12,
  },
  optionButton: {
    height: 60,
    borderWidth: 1,
    borderColor: '#6B5C52',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  optionButtonActive: {
    borderColor: '#C9A84C',
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
  },
  optionText: {
    color: 'white',
    fontSize: 16,
    letterSpacing: 1,
  },
  optionTextActive: {
    color: '#C9A84C',
    fontWeight: '700',
  },
  nextButton: {
    backgroundColor: '#C9A84C',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#1A0C10',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
