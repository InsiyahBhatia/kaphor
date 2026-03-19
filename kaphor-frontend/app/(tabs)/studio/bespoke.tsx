import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';

export default function BespokeScreen() {
  const router = useRouter();
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
      Alert.alert('Request Sent!', 'Our artisan team will contact you within 48 hours.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BESPOKE CONSULTATION</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Custom Upcycling Request</Text>
        <Text style={styles.subtitle}>
          Our heritage artisans transform your existing pieces into contemporary statement garments.
          Each project is handcrafted with museum-grade care.
        </Text>

        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={24} color="#C9A84C" />
            <Text style={styles.infoTitle}>TIMELINE</Text>
            <Text style={styles.infoText}>2-6 weeks</Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#C9A84C" />
            <Text style={styles.infoTitle}>GUARANTEE</Text>
            <Text style={styles.infoText}>100% satisfaction</Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>DESCRIBE YOUR VISION</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
          placeholder="Tell us about the garment and the transformation you envision..."
          placeholderTextColor="#6B5C52"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.inputLabel}>CONTACT EMAIL</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor="#6B5C52"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#1A0C10" /> : <Text style={styles.submitBtnText}>REQUEST CONSULTATION</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 120 },
  title: { fontSize: 28, fontFamily: 'CormorantGaramond_700Bold', color: '#C9A84C', marginBottom: 12 },
  subtitle: { color: '#6B5C52', fontSize: 14, lineHeight: 22, marginBottom: 32 },
  infoCards: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  infoCard: { flex: 1, backgroundColor: '#2A1C20', borderRadius: 12, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)' },
  infoTitle: { color: '#6B5C52', fontSize: 10, letterSpacing: 2 },
  infoText: { color: 'white', fontSize: 14, fontWeight: '700' },
  inputLabel: { color: '#6B5C52', fontSize: 11, letterSpacing: 2, marginBottom: 8, marginTop: 8 },
  input: { height: 52, borderWidth: 1, borderColor: '#3A2C30', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: 'white', fontSize: 14, marginBottom: 20 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#3A2C30', backgroundColor: '#1A0C10' },
  submitBtn: { backgroundColor: '#C9A84C', height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
});
