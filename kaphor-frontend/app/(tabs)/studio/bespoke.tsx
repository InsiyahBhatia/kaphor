import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner } from '../../../src/components/common/Loader';
import { getErrorMessage } from '../../../src/utils/errors';

export default function BespokeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useBackHandler('/(tabs)/circular');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description || !email) {
      Alert.alert('Missing Fields', 'Please describe your request and provide contact email.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/studio/bespoke-request', { description, contactEmail: email });
      Alert.alert('Request Sent!', 'Our team will contact you within 48 hours.', [
        { text: 'OK', onPress: () => safeBack('/(tabs)/circular') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Request failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
          onPress={() => safeBack('/(tabs)/circular')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back-sharp" size={28} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custom consultation</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Custom reconstruction</Text>
        <Text style={styles.subtitle}>
          Our tailors turn your old clothes into something new.
          Every project is handled with care.
        </Text>

        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <Ionicons name="time-sharp" size={24} color={colors.white} />
            <Text style={styles.infoTitle}>Timeline</Text>
            <Text style={styles.infoText}>2-6 WKS</Text>
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.cream, borderColor: colors.charcoal }]}>
            <Ionicons name="shield-checkmark-sharp" size={24} color={colors.charcoal} />
            <Text style={[styles.infoTitle, { color: colors.red }]}>Guarantee</Text>
            <Text style={[styles.infoText, { color: colors.charcoal }]}>Flawless</Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>Describe your vision / specifications</Text>
        <TextInput accessibilityLabel="Describe your request"
          style={[styles.input, { height: 160, textAlignVertical: 'top' }]}
          placeholder="Describe what you want changed..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.inputLabel}>Secure contact email</Text>
        <TextInput accessibilityLabel="Your email"
          style={styles.input}
          placeholder="agent@domain.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <Spinner color={colors.cream} /> : <Text style={styles.submitBtnText}>Start request →</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { 
    paddingTop: 24, paddingHorizontal: 20, flexDirection: 'row', 
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
    paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: colors.charcoal
  },
  headerTitle: { color: colors.charcoal, fontSize: 21, fontFamily: typography.handBold, includeFontPadding: false, },
  content: { padding: 20, paddingBottom: 180 },
  title: { fontSize: 48, fontFamily: typography.headings, color: colors.charcoal, marginBottom: 12 },
  subtitle: { color: colors.textPrimary, fontFamily: typography.handwritten, fontSize: 17, lineHeight: 31, marginBottom: 32, includeFontPadding: false, },
  
  infoCards: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  infoCard: { 
    flex: 1, backgroundColor: colors.charcoal, padding: 20, alignItems: 'center', gap: 8, 
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4
  },
  infoTitle: { color: colors.textMuted, fontFamily: typography.handBold, fontSize: 16, includeFontPadding: false, },
  infoText: { color: colors.white, fontFamily: typography.handBold, fontSize: 21, includeFontPadding: false, },
  
  inputLabel: { color: colors.charcoal, fontFamily: typography.handBold, fontSize: 16, marginBottom: 8, marginTop: 16, includeFontPadding: false, },
  input: { 
    height: 56, borderWidth: 2, borderColor: colors.charcoal, backgroundColor: colors.white, 
    padding: 16, color: colors.charcoal, fontFamily: typography.body, fontSize: 14, marginBottom: 24,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2
  },
  
  footer: { 
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 40, borderTopWidth: 2, borderTopColor: colors.charcoal, backgroundColor: colors.cream 
  },
  submitBtn: { 
    backgroundColor: colors.charcoal, 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4
  },
  submitBtnText: { color: colors.cream, fontFamily: typography.bodyBold, fontSize: 14, letterSpacing: 0.2 },
});
