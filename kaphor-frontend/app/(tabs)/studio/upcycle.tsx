import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

export default function UpcycleSuggestionsScreen() {
  const router = useRouter();
  useBackHandler('/(tabs)/circular');
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (!pick.canceled && pick.assets?.[0]) setImage(pick.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!description && !image) { Alert.alert('Input Required', 'Add a photo or describe your garment.'); return; }
    setLoading(true);
    try {
      let base64Image: string | undefined;
      if (image) {
        const b64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
        base64Image = `data:image/jpeg;base64,${b64}`;
      }

      // Use vision endpoint when image is available, fall back to text-only
      if (base64Image) {
        const { data } = await api.post('/ai/assess-condition', {
          image: base64Image,
          description: description || 'Analyze and provide upcycling ideas'
        }, { timeout: 60000 });
        setResult(data.data?.upcycleSuggestions || []);
      } else {
        const { data } = await api.post('/ai/upcycle-suggestions', { description, imageUrl: undefined });
        setResult(data.data);
      }
    } catch {
      Alert.alert('Error', 'Could not get suggestions. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/studio')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>UPCYCLE STUDIO</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!result ? (
          <>
            <View style={styles.heroSection}>
              <Ionicons name="color-palette" size={40} color="#C9A84C" />
              <Text style={styles.title}>AI Upcycle Ideas</Text>
              <Text style={styles.subtitle}>Upload a photo or describe a garment and our AI will suggest creative ways to transform it.</Text>
            </View>

            <TouchableOpacity style={styles.imageArea} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <View style={styles.cameraCircle}>
                    <Ionicons name="camera" size={28} color="#C9A84C" />
                  </View>
                  <Text style={styles.imageText}>ADD GARMENT PHOTO</Text>
                  <Text style={styles.imageSubtext}>Photos unlock AI vision analysis</Text>
                </View>
              )}
            </TouchableOpacity>
            {image && (
              <TouchableOpacity onPress={() => setImage(null)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={16} color="#F44336" />
                <Text style={styles.removeBtnText}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.input}
              placeholder="Describe the garment (fabric, style, condition)..."
              placeholderTextColor="#6B5C52"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <TouchableOpacity
              style={[styles.mainBtn, (!image && !description) && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={loading || (!image && !description)}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#1A0C10" />
                  <Text style={styles.mainBtnText}>  {image ? 'ANALYZING IMAGE...' : 'GETTING IDEAS...'}</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name="sparkles" size={18} color="#1A0C10" />
                  <Text style={styles.mainBtnText}>  GET AI SUGGESTIONS</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Your Upcycle Ideas</Text>
            <View style={styles.suggestionsContainer}>
              {(Array.isArray(result) ? result : [result]).map((s: any, i: number) => (
                <View key={i} style={styles.suggestionCard}>
                  <View style={styles.suggestionHeader}>
                    <View style={styles.numberBadge}><Text style={styles.numberText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle}>{s.title || `Idea ${i + 1}`}</Text>
                      {s.difficulty && (
                        <View style={styles.metaRow}>
                          <View style={styles.diffBadge}><Text style={styles.diffText}>{s.difficulty}</Text></View>
                          {s.estimatedTime && <Text style={styles.timeText}>⏱ {s.estimatedTime}</Text>}
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.suggestionText}>{s.description || (typeof s === 'string' ? s : s.suggestion || s.idea || JSON.stringify(s))}</Text>
                  {s.materialsNeeded && s.materialsNeeded.length > 0 && (
                    <Text style={styles.materialsText}>Materials: {s.materialsNeeded.join(', ')}</Text>
                  )}
                  {s.sustainabilityImpact && (
                    <View style={styles.impactRow}>
                      <Ionicons name="leaf" size={14} color="#4CAF50" />
                      <Text style={styles.impactText}>{s.sustainabilityImpact}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setResult(null); setDescription(''); setImage(null); }}>
              <Text style={styles.secondaryBtnText}>TRY ANOTHER GARMENT</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0609' },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#1A0C10', paddingBottom: 16 },
  headerTitle: { color: '#C9A84C', fontSize: 14, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 100 },
  heroSection: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontFamily: 'BebasNeue_400Regular', color: '#C9A84C', marginTop: 12, marginBottom: 8 },
  subtitle: { color: '#6B5C52', fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12, marginBottom: 4 },
  imageArea: { width: '100%', height: 200, borderWidth: 1.5, borderColor: '#3A2C30', borderStyle: 'dashed', borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: '#1A0C10' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(201, 168, 76, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(201, 168, 76, 0.2)' },
  imageText: { color: '#C9A84C', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  imageSubtext: { color: '#6B5C52', fontSize: 11, marginTop: 4 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginBottom: 16 },
  removeBtnText: { color: '#F44336', fontSize: 12 },
  input: { borderWidth: 1, borderColor: '#3A2C30', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 24 },
  mainBtn: { width: '100%', height: 56, backgroundColor: '#C9A84C', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#1A0C10', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  suggestionsContainer: { gap: 16, marginBottom: 24, marginTop: 16 },
  suggestionCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, borderLeftWidth: 3, borderLeftColor: '#C9A84C' },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  numberBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#C9A84C', justifyContent: 'center', alignItems: 'center' },
  numberText: { color: '#1A0C10', fontSize: 14, fontWeight: '800' },
  suggestionTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(201, 168, 76, 0.1)', borderWidth: 1, borderColor: 'rgba(201, 168, 76, 0.2)' },
  diffText: { color: '#C9A84C', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  timeText: { color: '#6B5C52', fontSize: 12 },
  suggestionText: { color: '#E0D6C8', fontSize: 14, lineHeight: 22, marginBottom: 10 },
  materialsText: { color: '#6B5C52', fontSize: 12, marginBottom: 8 },
  impactRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  impactText: { color: '#4CAF50', fontSize: 12, flex: 1 },
  secondaryBtn: { width: '100%', height: 56, borderWidth: 1, borderColor: '#3A2C30', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { color: '#6B5C52', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});
