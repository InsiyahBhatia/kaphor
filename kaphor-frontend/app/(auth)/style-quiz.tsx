import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { aiService } from '../../src/services/aiService';
import { useToastStore } from '../../src/store/toastStore';
import { colors, typography } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { safeBack } from '../../src/utils/navigation';

const QUIZ_DATA = [
  { 
    question: "What's your usual look?", 
    options: ["Simple & Clean", "Sporty/Urban", "Old-school/Retro", "Traditional/Cultural", "Bold & Unique", "Fancy/Polished", "All Black/Dark", "Easy/Loose", "Handmade/Natural", "Classic/Office"],
    sub: "Choose what feels most like you.",
    tokens: ["MINIMALIST", "STREETWEAR", "VINTAGE", "CULTURAL", "BOLD", "LUXURY", "DARK", "BOHO", "ARTISANAL", "PREPPY"]
  },
  { 
    question: "How do your clothes fit?", 
    options: ["Loose & Baggy", "Sharp & Tailored", "Light & Flowing", "Just Right"],
    sub: "Think about the shape you prefer.",
    tokens: ["OVERSIZED", "TAILORED", "FLOWING", "REGULAR"]
  },
  { 
    question: "Which colors do you wear most?", 
    options: ["Black, White & Grey", "Browns, Greens & Tans", "Dark Blues & Reds", "Bright & Loud Colors"],
    sub: "Your go-to color palette.",
    tokens: ["MONOCHROME", "EARTHY", "JEWEL", "BRIGHT"]
  },
  { 
    question: "What fabric feels best on you?", 
    options: ["Easy Cotton & Denim", "Soft Silk & Linen", "Warm Wool & Leather", "Sporty/Technical"],
    sub: "The material matters.",
    tokens: ["COTTON", "SILK", "WOOL", "TECHNICAL"]
  },
  { 
    question: "Do you like patterns or prints?", 
    options: ["No patterns (Plain)", "Traditional Prints", "Big Logos & Graphics", "Simple Stripes/Checks"],
    sub: "Keep it simple or stand out?",
    tokens: ["PLAIN", "CULTURAL", "GRAPHIC", "CLASSIC"]
  },
  { 
    question: "How do you want people to see you?", 
    options: ["Cool & Daring", "Polite & Proper", "Fun & Energetic", "Simple & Easy-going"],
    sub: "The vibe you want to project.",
    tokens: ["BOLD", "LUXURY", "STREETWEAR", "MINIMALIST"]
  },
  { 
    question: "What's your goal when buying clothes?", 
    options: ["Something that lasts forever", "Something rare & unique", "Something eco-friendly", "Something that turns heads"],
    sub: "Why do you shop?",
    tokens: ["LUXURY", "VINTAGE", "ARTISANAL", "BOLD"]
  },
  { 
    question: "Where do you usually find clothes?", 
    options: ["Thrift/Second-hand stores", "Local makers/Artisans", "New online drops", "Shopping malls/Fancy shops"],
    sub: "Your shopping habit.",
    tokens: ["VINTAGE", "ARTISANAL", "STREETWEAR", "LUXURY"]
  },
  { 
    question: "Who is your style twin?", 
    options: ["The 'No-fuss' person", "The 'City/Urban' person", "The 'Old Hollywood' person", "The 'Arty/Gallery' person"],
    sub: "Pick your inspiration.",
    tokens: ["MINIMALIST", "STREETWEAR", "PREPPY", "BOLD"]
  },
  { 
    question: "Do you mix heritage into your style?", 
    options: ["Yes, all the time", "Once in a while", "I mix in textures", "Not really"],
    sub: "Connection to your roots.",
    tokens: ["CULTURAL", "BOHO", "ARTISANAL", "MINIMALIST"]
  },
  { 
    question: "How do you feel about trends?", 
    options: ["I ignore them completely", "I follow them closely", "I pick what I like", "I make my own rules"],
    sub: "Are you a trend-follower?",
    tokens: ["MINIMALIST", "STREETWEAR", "VINTAGE", "BOLD"]
  },
  { 
    question: "How often do you get new clothes?", 
    options: ["Once a month", "Once a week", "Rarely/When needed", "All the time"],
    sub: "Your wardrobe frequency.",
    tokens: ["MINIMALIST", "STREETWEAR", "PREPPY", "LUXURY"]
  }
];

export default function StyleQuizScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToastStore();

  const currentQuestion = QUIZ_DATA[currentIndex];

  const selectOption = (option: string, index: number) => {
    const newAnswers = [...answers];
    // Map the simple option to the actual token the backend expects
    newAnswers[currentIndex] = currentQuestion.tokens[index]; 
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (!answers[currentIndex]) {
      Alert.alert('Selection Required', 'Please pick an option!');
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
      safeBack('/(tabs)');
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await aiService.submitStyleQuiz(answers);
      showToast('STYLE DNA READY', 'success');
      
      // Update the user in AuthContext so ProtectedRoute sees onboardingDone = true
      if (user) {
        setUser({ ...user, onboardingDone: true });
      }
      
      router.replace('/(tabs)');
    } catch (err: any) {
      showToast('FAILED // RETRY', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await aiService.skipStyleQuiz();
      showToast('PROFILE UPDATED', 'success');
      if (user) {
        setUser({ ...user, onboardingDone: true });
      }
      router.replace('/(tabs)');
    } catch (err) {
      router.replace('/(tabs)'); // Fallback redirect
    } finally {
      setSubmitting(false);
    }
  };

  const currentSelectionToken = answers[currentIndex];
  const currentSelectionIndex = currentQuestion.tokens.indexOf(currentSelectionToken);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HERO SECTION */}
      <View style={styles.heroCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.heroRank}>A♠</Text>
          <TouchableOpacity onPress={handleSkip} disabled={submitting}>
            <Text style={[styles.heroSubTitle, { color: colors.red, fontSize: 10 }]}>[ SKIP QUIZ ]</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>✦ DOSSIER ✦</Text>
        
        <View style={styles.heroBottomBar}>
          <View>
            <Text style={styles.heroSubTitle}>QUIZ ANALYSIS</Text>
            <Text style={styles.heroItalic}>{currentQuestion.sub}</Text>
          </View>
          <Text style={styles.heroZero}>{currentIndex + 1}</Text>
        </View>
      </View>

      {/* QUIZ PANEL */}
      <View style={styles.quizPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelHeaderText}>KAPHOR STYLE PROTOCOL</Text>
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, { backgroundColor: '#FF5F56' }]} />
            <View style={[styles.dot, { backgroundColor: '#FFBD2E' }]} />
            <View style={[styles.dot, { backgroundColor: '#27C93F' }]} />
          </View>
        </View>

        <View style={styles.progressHeader}>
           <Text style={styles.progressText}>SIGNAL {currentIndex + 1} OF {QUIZ_DATA.length}</Text>
           <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((currentIndex + 1) / QUIZ_DATA.length) * 100}%` }]} />
           </View>
        </View>

        <Text style={styles.questionText}>
          {currentQuestion.question}
        </Text>

        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, idx) => {
            const token = currentQuestion.tokens[idx];
            const isActive = answers[currentIndex] === token;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.optionRow, isActive && styles.optionRowActive]}
                onPress={() => selectOption(option, idx)}
                activeOpacity={0.7}
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

        <View style={styles.navButtonsRow}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
                {currentIndex === QUIZ_DATA.length - 1 ? 'REVEAL DNA →' : 'NEXT →'}
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
    paddingTop: 32,
  },
  heroCard: {
    backgroundColor: colors.charcoal,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.charcoal,
    height: 160,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  heroRank: {
    fontFamily: typography.ranks,
    fontSize: 24,
    color: colors.red,
  },
  heroTitle: {
    fontFamily: typography.ranks,
    fontSize: 22,
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
    fontSize: 12,
  },
  heroItalic: {
    fontFamily: typography.mono,
    color: 'rgba(245, 240, 232, 0.6)',
    fontSize: 9,
    marginTop: 2,
  },
  heroZero: {
    fontFamily: typography.ranks,
    fontSize: 40,
    color: colors.red,
    lineHeight: 44,
  },
  quizPanel: {
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingBottom: 24,
    marginBottom: 40,
  },
  panelHeader: {
    backgroundColor: colors.charcoal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
  },
  panelHeaderText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressHeader: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  progressText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.red,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(26,26,26,0.1)',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.red,
  },
  questionText: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    paddingHorizontal: 16,
    marginVertical: 16,
    letterSpacing: 0.5,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,26,0.1)',
    backgroundColor: colors.white,
  },
  optionRowActive: {
    backgroundColor: '#F0E8D5',
    borderColor: colors.red,
  },
  radioOutline: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,26,0.2)',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFilled: {
    borderColor: colors.red,
  },
  radioInner: {
    width: 6,
    height: 6,
    backgroundColor: colors.red,
  },
  optionText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 10,
    color: 'rgba(26,26,26,0.6)',
    fontWeight: '800',
  },
  optionTextActive: {
    color: colors.charcoal,
  },
  suitIcon: {
    fontFamily: typography.ranks,
    fontSize: 14,
    color: 'rgba(26,26,26,0.15)',
  },
  navButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  backBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.charcoal,
    fontWeight: '800',
  },
  nextBtn: {
    flex: 2,
    height: 44,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.cream,
    fontWeight: '800',
  },
});
