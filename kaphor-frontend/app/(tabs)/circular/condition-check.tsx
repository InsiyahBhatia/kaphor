import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';

const { width } = Dimensions.get('window');

export default function ConditionCheckScreen() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const pickImage = async (useCamera = false) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
      const pick = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
      if (!pick.canceled) setImageUri(pick.assets[0].uri);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Gallery permission needed'); return; }
      const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: false });
      if (!pick.canceled) setImageUri(pick.assets[0].uri);
    }
  };

  const analyzeGarment = async () => {
    if (!imageUri && !description) {
      Alert.alert('Missing Input', 'Please upload a photo or add a description.');
      return;
    }
    setAnalyzing(true);
    try {
      let base64Image: string | undefined;
      if (imageUri) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
        base64Image = `data:image/jpeg;base64,${base64}`;
      }
      const { data } = await api.post('/ai/assess-condition', {
        image: base64Image,
        description: description || 'Analyze this garment condition'
      }, { timeout: 60000 });
      setResult(data.data);
    } catch (e: any) {
      Alert.alert('Analysis Failed', 'Could not analyze the garment. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'EXCELLENT': return colors.forest;
      case 'GOOD': return colors.orange;
      case 'FAIR': return colors.copper;
      case 'POOR': case 'WORN': return colors.red;
      default: return colors.charcoal;
    }
  };

  if (result) {
    const { condition, circularRecommendation, upcycleSuggestions } = result;
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setResult(null); setImageUri(null); setDescription(''); }}>
            <Ionicons name="chevron-back" size={28} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI ASSESSMENT DOSSIER</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Condition Score Hero */}
          <View style={[styles.cardPanel, styles.heroPanel]}>
            <Text style={styles.heroLabel}>CONDITION SCORE</Text>
            <Text style={[styles.heroScore, { color: getGradeColor(condition?.grade) }]}>{condition?.score ?? '—'}</Text>
            <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(condition?.grade) }]}>
              <Text style={styles.gradeText}>{condition?.grade}</Text>
            </View>
          </View>

          {/* Condition Details */}
          <View style={styles.cardPanel}>
            <Text style={styles.sectionTitle}>DETAILED ANALYSIS</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>FIBER HEALTH</Text>
              <Text style={[styles.detailValue, { color: getGradeColor(condition?.fiberHealth) }]}>{condition?.fiberHealth}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>COLOR FADING</Text>
              <Text style={styles.detailValue}>{condition?.colorFading}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>STRUCTURE</Text>
              <Text style={styles.detailValue}>{condition?.structuralIntegrity?.replace(/_/g, ' ')}</Text>
            </View>
            <View style={styles.wearBox}>
              <Text style={styles.wearText}>{condition?.wearAnalysis}</Text>
            </View>
          </View>

          {/* Circular Recommendation */}
          <View style={[styles.cardPanel, { borderColor: colors.red, borderWidth: 3 }]}>
            <View style={styles.recoHeader}>
              <Text style={styles.recoLabel}>RECOMMENDED ACTION</Text>
              <Text style={styles.recoAction}>{circularRecommendation?.action}</Text>
            </View>
            <Text style={styles.recoReasoning}>{circularRecommendation?.reasoning}</Text>
            
            <View style={styles.metaRow}>
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>EST. VALUE</Text>
                <Text style={styles.metaValue}>{circularRecommendation?.estimatedValue}</Text>
              </View>
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>ECO SCORE</Text>
                <Text style={[styles.metaValue, { color: colors.forest }]}>{circularRecommendation?.sustainabilityScore}/100</Text>
              </View>
            </View>
          </View>

          {/* Upcycle Suggestions */}
          {upcycleSuggestions && upcycleSuggestions.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>SYSTEM SUGGESTIONS // UPCYCLE</Text>
              {upcycleSuggestions.map((s: any, i: number) => (
                <View key={i} style={styles.upcycleCard}>
                  <View style={styles.upcycleHeader}>
                    <Text style={styles.upcycleRank}>{['A', 'K', 'Q'][i % 3] || 'J'}♠</Text>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={styles.upcycleTitle}>{s.title}</Text>
                      <View style={styles.upcycleMeta}>
                        <View style={styles.diffBadge}>
                          <Text style={styles.diffText}>{s.difficulty}</Text>
                        </View>
                        <Text style={styles.timeText}>⏱ {s.estimatedTime}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.upcycleDesc}>{s.description}</Text>
                  {s.materialsNeeded && s.materialsNeeded.length > 0 && (
                    <Text style={styles.materialsText}>MATERIALS: {s.materialsNeeded.join(', ')}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/shop/sell')}>
            <Text style={styles.primaryBtnText}>[ LIST FOR {circularRecommendation?.action || 'SALE'} ]</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setResult(null); setImageUri(null); setDescription(''); }}>
            <Text style={styles.secondaryBtnText}>SCAN ANOTHER ASSET</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI CONDITION CHECK</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.welcomeHero}>
          <Text style={styles.welcomeTitle}>ASSET SCAN</Text>
          <Text style={styles.welcomeSub}>Upload visual data for systemic condition evaluation, fiber analysis, and classified circular routing.</Text>
        </View>

        {/* Image Upload Area */}
        <TouchableOpacity style={styles.imageArea} onPress={() => pickImage(false)}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
               <Ionicons name="scan" size={48} color={colors.charcoal} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Text style={styles.imageMainText}>SYSTEM: UPLOAD_IMAGE</Text>
              <Text style={styles.imageSubText}>Tap to access visual records</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {imageUri && (
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.imageActionBtn} onPress={() => pickImage(false)}>
              <Text style={styles.imageActionText}>[ CHANGE ]</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageActionBtn} onPress={() => pickImage(true)}>
              <Text style={styles.imageActionText}>[ CAMERA ]</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageActionBtn} onPress={() => setImageUri(null)}>
              <Text style={[styles.imageActionText, { color: colors.red }]}>[ DROP ]</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Description Input */}
        <Text style={styles.inputLabel}>MANUAL OVERRIDE / DESCRIBE ASSET</Text>
        <TextInput
          style={styles.descInput}
          placeholder="e.g. Vintage leather flight jacket, minor scuffs on cuffs..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        {/* Analyze Button */}
        <TouchableOpacity
          style={[styles.analyzeBtn, (!imageUri && !description) && { opacity: 0.4 }]}
          onPress={analyzeGarment}
          disabled={analyzing || (!imageUri && !description)}
        >
          {analyzing ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.analyzeBtnText}>  RUNNING ALGORITHMS...</Text>
            </View>
          ) : (
            <View style={styles.analyzingRow}>
               <Text style={styles.analyzeBtnText}>INITIATE SCAN →</Text>
            </View>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { 
    paddingTop: 24, paddingHorizontal: 20, flexDirection: 'row', 
    justifyContent: 'space-between', alignItems: 'center', 
    paddingBottom: 20, backgroundColor: colors.cream,
    borderBottomWidth: 2, borderBottomColor: colors.charcoal
  },
  headerTitle: { color: colors.charcoal, fontSize: 16, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 2 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  
  welcomeHero: { marginBottom: 32, marginTop: 16 },
  welcomeTitle: { fontSize: 48, fontFamily: typography.headings, color: colors.charcoal, marginBottom: 8 },
  welcomeSub: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12, lineHeight: 20 },
  
  imageArea: { 
    width: '100%', height: 260, 
    borderWidth: 2, borderColor: colors.charcoal, borderStyle: 'dashed', 
    backgroundColor: '#E0D6C8', marginBottom: 16,
    justifyContent: 'center', alignItems: 'center'
  },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center' },
  imageMainText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  imageSubText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10 },
  
  imageActions: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 32 },
  imageActionBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  imageActionText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '800' },
  
  inputLabel: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  descInput: { 
    borderWidth: 2, borderColor: colors.charcoal, backgroundColor: colors.white, 
    padding: 16, color: colors.charcoal, fontFamily: typography.mono, fontSize: 13, 
    minHeight: 120, textAlignVertical: 'top', marginBottom: 32,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  
  analyzeBtn: { 
    width: '100%', height: 60, backgroundColor: colors.red, 
    borderWidth: 2, borderColor: colors.charcoal,
    justifyContent: 'center', alignItems: 'center', marginBottom: 32,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  analyzeBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  analyzingRow: { flexDirection: 'row', alignItems: 'center' },

  // Result styles
  cardPanel: { 
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, 
    padding: 24, marginBottom: 24,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  heroPanel: { alignItems: 'center', backgroundColor: colors.charcoal },
  heroLabel: { color: colors.cream, fontFamily: typography.mono, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  heroScore: { fontSize: 80, fontFamily: typography.headings },
  gradeBadge: { paddingHorizontal: 20, paddingVertical: 6, borderWidth: 2, borderColor: colors.white, marginTop: 8 },
  gradeText: { color: colors.white, fontFamily: typography.mono, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  
  sectionTitle: { color: colors.red, fontFamily: typography.mono, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(26,26,26,0.1)', paddingBottom: 8 },
  detailLabel: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 12, fontWeight: '600' },
  detailValue: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '800' },
  wearBox: { paddingTop: 8 },
  wearText: { color: colors.textPrimary, fontFamily: typography.accent, fontSize: 14, lineHeight: 22 },
  
  recoHeader: { marginBottom: 16 },
  recoLabel: { color: colors.red, fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  recoAction: { color: colors.charcoal, fontSize: 48, fontFamily: typography.headings, marginTop: 4 },
  recoReasoning: { color: colors.textPrimary, fontFamily: typography.accent, fontSize: 15, lineHeight: 24, marginBottom: 24 },
  
  metaRow: { flexDirection: 'row', gap: 16, borderTopWidth: 2, borderTopColor: colors.charcoal, paddingTop: 16 },
  metaBox: { flex: 1 },
  metaLabel: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  metaValue: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 18, fontWeight: '800' },
  
  upcycleCard: { 
    backgroundColor: colors.bgMuted, borderWidth: 2, borderColor: colors.charcoal, 
    padding: 20, marginBottom: 16, borderLeftWidth: 8, borderLeftColor: colors.navy 
  },
  upcycleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  upcycleRank: { fontFamily: typography.ranks, fontSize: 32, color: colors.charcoal },
  upcycleTitle: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 14, fontWeight: '800', textTransform: 'uppercase' },
  upcycleMeta: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.charcoal },
  diffText: { color: colors.white, fontFamily: typography.mono, fontSize: 10, fontWeight: '700' },
  timeText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 10 },
  upcycleDesc: { color: colors.textPrimary, fontFamily: typography.accent, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  materialsText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 10, fontWeight: '700' },
  
  primaryBtn: { 
    width: '100%', height: 60, backgroundColor: colors.red, 
    borderWidth: 2, borderColor: colors.charcoal,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 8 
  },
  primaryBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  secondaryBtn: { 
    width: '100%', height: 50, backgroundColor: colors.cream,
    borderWidth: 2, borderColor: colors.charcoal, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 32 
  },
  secondaryBtnText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
