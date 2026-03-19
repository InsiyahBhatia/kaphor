import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';

export default function UpcycleSuggestionsScreen() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!description) { Alert.alert('Describe your garment', 'Tell us what you want to transform.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/ai/upcycle-suggestions', { description, imageUrl: image || undefined });
      setSuggestions(data.data);
    } catch {
      Alert.alert('Error', 'Could not get suggestions. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>UPCYCLE IDEAS</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!suggestions ? (
          <>
            <Text style={styles.title}>Get AI Upcycle Suggestions</Text>
            <Text style={styles.subtitle}>Describe a garment and our AI will suggest creative ways to transform it into something new.</Text>

            <TouchableOpacity style={styles.imageArea} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={40} color="#C9A84C" />
                  <Text style={styles.imageText}>ADD PHOTO (OPTIONAL)</Text>
                </>
              )}
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Describe the garment (fabric, style, condition)..."
              placeholderTextColor="#6B5C52"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <TouchableOpacity style={styles.mainBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#1A0C10" /> : <Text style={styles.mainBtnText}>GET SUGGESTIONS</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Your Upcycle Ideas</Text>
            <View style={styles.suggestionsContainer}>
              {(Array.isArray(suggestions) ? suggestions : [suggestions]).map((s: any, i: number) => (
                <View key={i} style={styles.suggestionCard}>
                  <View style={styles.suggestionHeader}>
                    <Ionicons name="sparkles" size={18} color="#C9A84C" />
                    <Text style={styles.suggestionTitle}>IDEA {i + 1}</Text>
                  </View>
                  <Text style={styles.suggestionText}>{typeof s === 'string' ? s : s.suggestion || s.idea || JSON.stringify(s)}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setSuggestions(null); setDescription(''); setImage(null); }}>
              <Text style={styles.secondaryBtnText}>TRY ANOTHER GARMENT</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 100 },
  title: { fontSize: 26, fontFamily: 'CormorantGaramond_700Bold', color: '#C9A84C', marginBottom: 12 },
  subtitle: { color: '#6B5C52', fontSize: 14, lineHeight: 22, marginBottom: 28 },
  imageArea: { width: '100%', height: 180, borderWidth: 1, borderColor: '#3A2C30', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2A1C20', marginBottom: 20, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imageText: { color: '#6B5C52', fontSize: 11, letterSpacing: 2, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#3A2C30', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 14, marginBottom: 24 },
  mainBtn: { width: '100%', height: 56, backgroundColor: '#C9A84C', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  suggestionsContainer: { gap: 16, marginBottom: 24 },
  suggestionCard: { backgroundColor: '#2A1C20', borderRadius: 12, padding: 20, borderLeftWidth: 3, borderLeftColor: '#C9A84C' },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  suggestionTitle: { color: '#C9A84C', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  suggestionText: { color: '#E0D6C8', fontSize: 14, lineHeight: 22 },
  secondaryBtn: { width: '100%', height: 56, borderWidth: 1, borderColor: '#3A2C30', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { color: '#6B5C52', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});
