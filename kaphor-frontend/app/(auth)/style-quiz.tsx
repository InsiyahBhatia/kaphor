import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { aiService } from '../../src/services/aiService';
import { useToastStore } from '../../src/store/toastStore';
import { colors, typography } from '../../src/theme';

const QUIZ_DATA = [
  { question: "What best describes your style?", options: ["Casual", "Streetwear", "Ethnic/Traditional", "Minimal", "Chic/Trendy", "Vintage"] },
  { question: "What type of outfits do you prefer?", options: ["Trendy & fashionable", "Timeless & classic"] },
  { question: "Which fit do you like the most?", options: ["Loose/Relaxed", "Fitted", "Oversized", "Tailored"] },
  { question: "Which color palette do you prefer?", options: ["Neutrals (black, white, beige)", "Bright colors", "Dark tones", "Pastels"] },
  { question: "What kind of silhouettes do you prefer?", options: ["Flowing & loose", "Structured & sharp", "Body-hugging", "Layered styles"] },
  { question: "What kind of prints do you prefer?", options: ["Solid/Plain", "Floral", "Graphic/Printed", "Patterns (stripes, checks)"] },
  { question: "What fabric do you prefer?", options: ["Cotton", "Denim", "Silk", "Linen"] },
  { question: "What fashion vibe do you connect with the most?", options: ["Clean & minimal", "Edgy & bold", "Elegant & refined", "Fun & experimental"] },
  { question: "How do you like your outfits styled?", options: ["Simple & minimal", "Layered & detailed", "Statement pieces", "Balanced"] },
  { question: "What kind of outfits attract you the most while browsing?", options: ["Simple everyday looks", "Eye-catching statement outfits", "Classy and polished styles", "Unique and experimental fits"] }
];

export default function StyleQuizScreen() {
  const router = useRouter();
  
  // Array of answers, one string per question index
  const [answers, setAnswers] = useState<string[]>(Array(QUIZ_DATA.length).fill(''));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToastStore();

  const currentQuestion = QUIZ_DATA[currentIndex];

  const toggleOption = (option: string) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = option; // Single selection per question
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (!answers[currentIndex]) {
      Alert.alert('Selection Required', 'Please select an option to proceed.');
      return;
    }
    if (currentIndex < QUIZ_DATA.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      router.back();
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await aiService.submitStyleQuiz(answers);
      showToast('PROFILE GENERATION COMPLETE', 'success');
      router.replace('/(tabs)');
    } catch (err: any) {
      showToast(err?.message || 'CLASSIFICATION FAILED // RETRY', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
      
      {/* HERO CARD */}
      <View style={styles.heroCard}>
        <Text style={styles.heroRank}>A♠</Text>
        <Text style={styles.heroTitle}>✦ DOSSIER ✦</Text>
        
        <View style={styles.heroBottomBar}>
          <View>
            <Text style={styles.heroSubTitle}>PROFILE GENERATION</Text>
            <Text style={styles.heroItalic}>Answer truthfully. We are watching.</Text>
          </View>
          <Text style={styles.heroZero}>{currentIndex + 1}</Text>
        </View>
      </View>

      {/* QUIZ PANEL */}
      <View style={styles.quizPanel}>
        {/* Panel Header */}
        <View style={styles.panelHeader}>
          <Text style={styles.panelHeaderText}>STYLE QUIZ · KAPHOR AGENCY</Text>
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, { backgroundColor: '#FF5F56' }]} />
            <View style={[styles.dot, { backgroundColor: '#FFBD2E' }]} />
            <View style={[styles.dot, { backgroundColor: '#27C93F' }]} />
          </View>
        </View>

        {/* Progress Indicator */}
        <Text style={styles.progressLabel}>QUERY #{currentIndex + 1} OF #{QUIZ_DATA.length}</Text>

        {/* Question Text */}
        <Text style={styles.questionText}>
          {currentQuestion.question}
        </Text>

        {/* Answer Options */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option) => {
            const isActive = answers[currentIndex] === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.optionRow, isActive && styles.optionRowActive]}
                onPress={() => toggleOption(option)}
              >
                <View style={[styles.radioOutline, isActive && styles.radioFilled]}>
                  {isActive && <View style={styles.radioInner} />}
                </View>
                
                <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                  {option.toUpperCase()}
                </Text>
                
                <Text style={[styles.suitIcon, isActive && { color: colors.red }]}>
                  {isActive ? '♥' : '♦'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Nav Buttons */}
        <View style={styles.navButtonsRow}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={handleBack}
          >
            <Text style={styles.backBtnText}>[← BACK]</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.nextBtn, !answers[currentIndex] && { opacity: 0.5 }]}
            onPress={handleNext}
            disabled={submitting || !answers[currentIndex]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.nextBtnText}>
                {currentIndex === QUIZ_DATA.length - 1 ? 'FINISH CLASSIFICATION →' : 'NEXT QUERY →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0609', 
    padding: 16,
    paddingTop: 24,
  },
  heroCard: {
    backgroundColor: colors.charcoal,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.charcoal,
    height: 180,
    padding: 16,
    marginBottom: 24,
    justifyContent: 'space-between',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  heroRank: {
    fontFamily: typography.ranks,
    fontSize: 28,
    color: colors.red,
  },
  heroTitle: {
    fontFamily: typography.ranks,
    fontSize: 24,
    color: colors.cream,
    textAlign: 'center',
    letterSpacing: 4,
  },
  heroBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroSubTitle: {
    fontFamily: typography.headings,
    color: colors.cream,
    fontSize: 16,
    letterSpacing: 1,
  },
  heroItalic: {
    fontFamily: typography.mono,
    color: 'rgba(245, 240, 232, 0.6)',
    fontSize: 10,
    marginTop: 4,
  },
  heroZero: {
    fontFamily: typography.ranks,
    fontSize: 48,
    color: colors.red,
    lineHeight: 52,
  },
  quizPanel: {
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingBottom: 24,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  panelHeader: {
    backgroundColor: colors.charcoal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
  },
  panelHeaderText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressLabel: {
    fontFamily: typography.mono,
    color: colors.red,
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    letterSpacing: 1,
  },
  questionText: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.charcoal,
    paddingHorizontal: 16,
    marginBottom: 24,
    lineHeight: 28,
    letterSpacing: 1,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 32,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: 'rgba(26,26,26,0.2)',
    backgroundColor: colors.cream,
  },
  optionRowActive: {
    backgroundColor: '#F0E8D5',
    borderColor: colors.red,
  },
  radioOutline: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: 'rgba(26,26,26,0.4)',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFilled: {
    borderColor: colors.red,
  },
  radioInner: {
    width: 8,
    height: 8,
    backgroundColor: colors.red,
  },
  optionText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 11,
    color: 'rgba(26,26,26,0.6)',
    fontWeight: '800',
    letterSpacing: 1,
  },
  optionTextActive: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  suitIcon: {
    fontFamily: typography.ranks,
    fontSize: 16,
    color: 'rgba(26,26,26,0.3)',
  },
  navButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: {
    flex: 1,
    height: 48,
    borderWidth: 2,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1,
  },
  nextBtn: {
    flex: 2,
    height: 48,
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: typography.mono,
    color: colors.cream,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1,
  },
});
