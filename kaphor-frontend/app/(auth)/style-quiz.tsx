import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { aiService } from '../../src/services/aiService';
import { userService } from '../../src/services/userService';
import { useToastStore } from '../../src/store/toastStore';
import { colors, typography } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { safeStorage } from '../../src/utils/storage';
import { safeBack } from '../../src/utils/navigation';
import { hapticFeedback } from '../../src/utils/haptics';
import {
  AestheticId,
  AestheticMatchResult,
  calculateAestheticMatch,
  AestheticAnswers,
} from '../../src/services/aestheticRecommendationService';
import { Spinner } from '../../src/components/common/Loader';
import { KaphorMark } from '../../src/components/common/KaphorLogo';

export const AESTHETIC_IMAGES: Record<string, any> = {
  'Y2K': require('../../assets/style-guide/1.png'),
  'Acubi': require('../../assets/style-guide/2.png'),
  'Business Comfort': require('../../assets/style-guide/3.png'),
  'Cottagecore': require('../../assets/style-guide/4.png'),
  'Dark Academia': require('../../assets/style-guide/5.png'),
  'Dark Coquette': require('../../assets/style-guide/6.png'),
  'Fleur Noire': require('../../assets/style-guide/7.png'),
  'Grunge': require('../../assets/style-guide/8.png'),
  'Mermaid Core': require('../../assets/style-guide/9.png'),
  'Office Siren': require('../../assets/style-guide/10.png'),
  'Rockstar Girlfriend': require('../../assets/style-guide/11.png'),
  'Sade Girl': require('../../assets/style-guide/12.png'),
  'Vintage': require('../../assets/style-guide/13.png'),
  'Minimal Desi': require('../../assets/style-guide/14.png'),
  'Maximal Desi': require('../../assets/style-guide/15.png'),
  'Soft Girl': require('../../assets/style-guide/16.png'),
};

interface QuestionDef {
  id: number;
  question: string;
  sub: string;
  isMulti: boolean;
  isRanked?: boolean;
  options: { key: string; label: string; sub?: string }[];
}

const QUESTIONS: QuestionDef[] = [
  {
    id: 1,
    question: 'Which colours do you find yourself reaching for most?',
    sub: 'Multiple options allowed',
    isMulti: true,
    options: [
      { key: 'neutrals', label: 'Neutrals', sub: 'Black, white, grey, beige' },
      { key: 'earthy', label: 'Earthy tones', sub: 'Olive, rust, mustard, terracotta' },
      { key: 'pastels', label: 'Pastels', sub: 'Baby pink, lavender, mint, powder blue' },
      { key: 'jewel', label: 'Jewel tones', sub: 'Emerald, wine, sapphire, deep purple' },
      { key: 'bold', label: 'Bold and bright', sub: 'Red, cobalt, orange, yellow' },
      { key: 'monochrome', label: 'Monochrome looks', sub: 'All-black or all-white' },
      { key: 'metallics', label: 'Metallics', sub: 'Gold, silver, bronze' },
    ],
  },
  {
    id: 2,
    question: 'Do you lean towards lighter or darker shades?',
    sub: 'Choose one option',
    isMulti: false,
    options: [
      { key: 'light', label: 'Mostly light / pastel' },
      { key: 'medium', label: 'Medium, muted tones' },
      { key: 'dark', label: 'Mostly dark, deep shades' },
      { key: 'mix', label: 'A mix of both' },
      { key: 'depends', label: 'Depends on the season or occasion' },
    ],
  },
  {
    id: 3,
    question: 'What silhouettes make you feel your best?',
    sub: 'Multiple options allowed',
    isMulti: true,
    options: [
      { key: 'fitted', label: 'Fitted / body-hugging' },
      { key: 'a_line', label: 'A-line' },
      { key: 'straight_cut', label: 'Straight-cut / boxy' },
      { key: 'wrap', label: 'Wrap-style' },
      { key: 'structured', label: 'Structured / tailored' },
      { key: 'flowy', label: 'Flowy / draped' },
      { key: 'relaxed', label: 'Relaxed / oversized' },
    ],
  },
  {
    id: 4,
    question: 'How would you describe your body shape?',
    sub: 'Only used for fit and sizing',
    isMulti: false,
    options: [
      { key: 'pear', label: 'Pear', sub: 'Hips wider than bust' },
      { key: 'apple', label: 'Apple', sub: 'Fuller midsection' },
      { key: 'hourglass', label: 'Hourglass', sub: 'Balanced bust and hips, defined waist' },
      { key: 'rectangle', label: 'Rectangle', sub: 'Balanced, minimal waist definition' },
      { key: 'inverted_triangle', label: 'Inverted triangle', sub: 'Shoulders/bust wider than hips' },
      { key: 'prefer_not_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 5,
    question: 'How do you like your clothes to fit?',
    sub: 'Choose one option',
    isMulti: false,
    options: [
      { key: 'body_con', label: 'Body-con / skin-tight' },
      { key: 'fitted_comfortable', label: 'Fitted but comfortable' },
      { key: 'regular', label: 'Regular / true-to-size' },
      { key: 'relaxed', label: 'Relaxed / loose' },
      { key: 'oversized', label: 'Oversized' },
      { key: 'depends', label: 'Depends on the piece' },
    ],
  },
  {
    id: 6,
    question: 'Which fabrics do you love wearing?',
    sub: 'Multiple options allowed',
    isMulti: true,
    options: [
      { key: 'cotton', label: 'Cotton' },
      { key: 'linen', label: 'Linen' },
      { key: 'denim', label: 'Denim' },
      { key: 'silk', label: 'Silk' },
      { key: 'wool', label: 'Wool / wool-blend' },
      { key: 'knits', label: 'Knits / jersey' },
      { key: 'rayon', label: 'Rayon / viscose' },
      { key: 'leather', label: 'Leather — real or faux' },
      { key: 'polyester', label: 'Polyester / synthetic blends' },
      { key: 'no_preference', label: 'No strong preference' },
    ],
  },
  {
    id: 7,
    question: 'Which prints or patterns do you gravitate towards?',
    sub: 'Multiple options allowed',
    isMulti: true,
    options: [
      { key: 'solids', label: 'Solids — no print' },
      { key: 'florals', label: 'Florals' },
      { key: 'stripes', label: 'Stripes' },
      { key: 'checks', label: 'Checks / plaid' },
      { key: 'polka_dots', label: 'Polka dots' },
      { key: 'animal', label: 'Animal print' },
      { key: 'abstract', label: 'Abstract / geometric' },
      { key: 'ethnic', label: 'Ethnic prints — block print, ikat, bandhani' },
      { key: 'typography', label: 'Typography / graphic prints' },
      { key: 'not_prints', label: 'Not really a prints person' },
    ],
  },
  {
    id: 8,
    question: 'What do you vibe with?',
    sub: 'Choose and rank up to 3 aesthetics (or select "I don\'t know / Nothing")',
    isMulti: false,
    isRanked: true,
    options: [
      { key: 'Y2K', label: 'Y2K nostalgia', sub: 'Playful retro-futurism, metallic sheen & 2000s energy' },
      { key: 'Office Siren', label: 'Office Siren', sub: 'Tailored corporate chic with razor-sharp sensual edge' },
      { key: 'Rockstar Girlfriend', label: 'Rockstar Girlfriend', sub: 'Edgy grunge-glam, vintage leather & backstage energy' },
      { key: 'Sade Girl', label: 'Sade Girl', sub: 'Timeless, quiet style, backless turtlenecks & gold hoops' },
      { key: 'Vintage', label: 'Vintage', sub: 'Retro looks, classic shapes & thrifted finds' },
      { key: 'Acubi', label: 'Acubi', sub: 'Subversive minimalism, cyber-basics & muted neutral tones' },
      { key: 'Business Comfort', label: 'Business Comfort', sub: 'Relaxed modern tailoring, easy, breathable & confident' },
      { key: 'Cottagecore', label: 'Cottagecore', sub: 'Romantic rural simplicity, puff sleeves & prairie florals' },
      { key: 'Dark Academia', label: 'Dark Academia', sub: 'Tweed, oxfords and a bookish look' },
      { key: 'Dark Coquette', label: 'Dark Coquette', sub: 'Gothic romanticism, black lace ribbons & bittersweet charm' },
      { key: 'Fleur Noire', label: 'Fleur Noire', sub: 'Dark florals and moody, night-time style' },
      { key: 'Grunge', label: 'Grunge', sub: 'Raw 90s anti-fashion, distressed flannel & effortless angst' },
      { key: 'Mermaid Core', label: 'Mermaid Core', sub: 'Whimsical ocean sheen, iridescent drapery & seafoam shimmer' },
      { key: 'Minimal Desi', label: 'Minimal Desi', sub: 'Refined modern Indian silhouettes, clean lines & understated grace' },
      { key: 'Maximal Desi', label: 'Maximal Desi', sub: 'Opulent Indian craftsmanship, brocades, zari & royal colors' },
      { key: 'Soft Girl', label: 'Soft Girl', sub: 'Sweet pastel femininity, cozy knits & delicate playful charm' },
      { key: 'IDK', label: "I don't know / Nothing fits me", sub: "I'm unsure or none of these match — decide purely from my other answers" },
    ],
  },
];

export default function StyleQuizScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const showToast = useToastStore((s) => s.showToast);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [rankedVibes, setRankedVibes] = useState<AestheticId[]>([]);
  const [isIdkSelected, setIsIdkSelected] = useState(false);
  const [fullscreenAesthetic, setFullscreenAesthetic] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<AestheticMatchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = QUESTIONS[currentIndex];
  const currentSelections = answers[currentIndex] || [];

  const handleToggleOption = (key: string) => {
    hapticFeedback.light();
    if (currentQuestion.isRanked) {
      if (key === 'IDK') {
        const nextIdk = !isIdkSelected;
        setIsIdkSelected(nextIdk);
        if (nextIdk) {
          setRankedVibes([]);
        }
        return;
      }

      // If choosing an aesthetic, uncheck IDK
      setIsIdkSelected(false);
      const aestheticKey = key as AestheticId;
      if (rankedVibes.includes(aestheticKey)) {
        setRankedVibes(rankedVibes.filter((v) => v !== aestheticKey));
      } else {
        if (rankedVibes.length >= 3) {
          Alert.alert('Maximum 3', 'You can pick and rank up to 3 aesthetic vibes.');
          return;
        }
        setRankedVibes([...rankedVibes, aestheticKey]);
      }
      return;
    }

    if (currentQuestion.isMulti) {
      const exists = currentSelections.includes(key);
      const updated = exists
        ? currentSelections.filter((k) => k !== key)
        : [...currentSelections, key];
      setAnswers({ ...answers, [currentIndex]: updated });
    } else {
      setAnswers({ ...answers, [currentIndex]: [key] });
    }
  };

  const handleNext = () => {
    if (currentQuestion.isRanked) {
      if (rankedVibes.length === 0 && !isIdkSelected) {
        Alert.alert(
          'Selection Required',
          'Please select up to 3 vibes, or pick "I don\'t know / Nothing fits me" to continue.'
        );
        return;
      }
    } else if (currentSelections.length === 0) {
      Alert.alert('Selection Required', 'Please pick an option to continue.');
      return;
    }

    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      computeAndShowResult();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      safeBack('/(tabs)');
    }
  };

  const computeAndShowResult = async () => {
    setSubmitting(true);
    hapticFeedback.medium();

    const formattedAnswers: AestheticAnswers = {
      q1_colours: answers[0] || [],
      q2_shades: answers[1]?.[0] || 'medium',
      q3_silhouettes: answers[2] || [],
      q4_body_shape: answers[3]?.[0] || undefined,
      q5_fitting: answers[4]?.[0] || 'fitted_comfortable',
      q6_fabrics: answers[5] || [],
      q7_prints: answers[6] || [],
      q8_vibe_ranked: isIdkSelected ? [] : rankedVibes,
    };

    const result = calculateAestheticMatch(formattedAnswers);
    setMatchResult(result);

    try {
      // Submit User Style Vector to backend AI engine
      await aiService.submitStyleQuiz([
        result.primary.aesthetic.name,
        result.closeSecond ? result.closeSecond.aesthetic.name : '',
        ...formattedAnswers.q1_colours,
        ...formattedAnswers.q3_silhouettes,
        ...formattedAnswers.q6_fabrics,
        ...formattedAnswers.q7_prints,
      ]);

      // Directly persist styleAesthetic on user profile
      try {
        await userService.updateMe({ styleAesthetic: result.primary.aesthetic.id });
      } catch {
        // Non-blocking
      }

      if (user) {
        const updatedUser = {
          ...user,
          styleAesthetic: result.primary.aesthetic.id,
          onboardingDone: true,
        };
        setUser(updatedUser);

        try {
          const storedAccess = await safeStorage.getItem('kaphor_access_token');
          const storedRefresh = await safeStorage.getItem('kaphor_refresh_token');
          await safeStorage.setItem(
            'auth_data',
            JSON.stringify({
              accessToken: storedAccess || '',
              refreshToken: storedRefresh || '',
              user: updatedUser,
            })
          );
        } catch (storageErr) {
          console.warn('Failed to update auth_data storage for style quiz', storageErr);
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToApp = () => {
    hapticFeedback.success();
    showToast('Aesthetic match applied', 'success');
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await aiService.skipStyleQuiz();
      if (user) {
        setUser({ ...user, onboardingDone: true });
      }
      router.replace('/(tabs)');
    } catch {
      router.replace('/(tabs)');
    } finally {
      setSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RESULT VIEW
  // ══════════════════════════════════════════════════════════════════════════════
  if (matchResult) {
    const { primary, closeSecond } = matchResult;

    return (
      <>
        <ScrollView style={styles.container} contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          {/* Header Badge */}
          <View style={styles.resultHeaderCard}>
            <KaphorMark size={44} />
            <Text style={styles.resultSubtitle}>Kaphor details — aesthetic-match verified</Text>
            <Text style={styles.resultMainTitle}>Your style archetype</Text>
          </View>

          {/* Primary Match Card */}
          <View style={styles.primaryAestheticCard}>
            <View style={styles.primaryBadgeRow}>
              <View style={styles.aestheticPill}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.aestheticPillText}>Primary archetype</Text>
              </View>
            </View>

            <Text style={styles.aestheticNameTitle}>{primary.aesthetic.name.toUpperCase()}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.aestheticTagline}>{primary.aesthetic.tagline}</Text>
            <Text style={styles.aestheticDescription}>{primary.aesthetic.description}</Text>

            {/* High-Resolution Style Guide Moodboard Poster (Tap for Full Screen) */}
            {AESTHETIC_IMAGES[primary.aesthetic.id] && (
              <TouchableOpacity
                style={styles.primaryAestheticHeroWrap}
                onPress={() => setFullscreenAesthetic(primary.aesthetic.id)}
                activeOpacity={0.92}
              >
                <Image
                  source={AESTHETIC_IMAGES[primary.aesthetic.id]}
                  style={styles.primaryAestheticHeroImage}
                  contentFit="contain"
                />
                <View style={styles.tapToExpandOverlay}>
                  <SolarIcon name="expand" size={13} color={colors.cream} />
                  <Text style={styles.tapToExpandText}>Tap to expand full screen</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.dividerLine} />

            {/* Essentials */}
            <Text style={styles.essentialsHeading}>■ YOUR ESSENTIALS</Text>
            <View style={styles.essentialsList}>
              {primary.aesthetic.essentials.map((item, idx) => (
                <View key={idx} style={styles.essentialRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.essentialItemText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Close Second Card (if applicable) */}
          {closeSecond && (
            <View style={styles.secondaryAestheticCard}>
              <View style={styles.secondaryHeaderRow}>
                <View style={styles.closeSecondBadge}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.closeSecondBadgeText}>Close second</Text>
                </View>
              </View>
              <Text style={styles.secondaryName}>{closeSecond.aesthetic.name.toUpperCase()}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.secondaryTagline}>{closeSecond.aesthetic.tagline}</Text>

              {AESTHETIC_IMAGES[closeSecond.aesthetic.id] && (
                <TouchableOpacity
                  style={styles.secondaryAestheticThumbWrap}
                  onPress={() => setFullscreenAesthetic(closeSecond.aesthetic.id)}
                  activeOpacity={0.92}
                >
                  <Image
                    source={AESTHETIC_IMAGES[closeSecond.aesthetic.id]}
                    style={styles.secondaryAestheticThumb}
                    contentFit="contain"
                  />
                  <View style={styles.tapToExpandOverlay}>
                    <SolarIcon name="expand" size={13} color={colors.cream} />
                    <Text style={styles.tapToExpandText}>Tap for full screen</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={styles.exploreMarketplaceBtn}
            onPress={handleProceedToApp}
            activeOpacity={0.85}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.exploreBtnText}>Explore selected closet →</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* FULL SCREEN LIGHTBOX MODAL ON FINAL SCREEN */}
        <Modal
          visible={Boolean(fullscreenAesthetic)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullscreenAesthetic(null)}
        >
          <View style={styles.fullscreenModalBackdrop}>
            {/* Top Header */}
            <View style={styles.fullscreenTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullscreenAestheticTitle}>
                  {fullscreenAesthetic?.toUpperCase()}
                </Text>
                <Text style={styles.fullscreenAestheticSub}>
                  Aesthetic style guide & moodboard poster
                </Text>
              </View>

              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Close"
                style={styles.fullscreenCloseBtn}
                onPress={() => setFullscreenAesthetic(null)}
                activeOpacity={0.8}
              >
                <SolarIcon name="close" size={26} color={colors.cream} />
              </TouchableOpacity>
            </View>

            {/* Centered Large Image */}
            {Boolean(fullscreenAesthetic && AESTHETIC_IMAGES[fullscreenAesthetic]) && (
              <View style={styles.fullscreenImageContainer}>
                <Image
                  source={AESTHETIC_IMAGES[fullscreenAesthetic!]}
                  style={styles.fullscreenImage}
                  contentFit="contain"
                />
              </View>
            )}

            {/* Bottom Actions */}
            <View style={styles.fullscreenBottomBar}>
              <TouchableOpacity
                style={styles.fullscreenSelectBtn}
                onPress={() => setFullscreenAesthetic(null)}
                activeOpacity={0.85}
              >
                <SolarIcon name="checkmark-circle" size={18} color={colors.charcoal} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.fullscreenSelectBtnText}>Close full screen view</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // QUESTIONNAIRE VIEW
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HERO SECTION */}
      <View style={styles.heroCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <KaphorMark size={36} />
          <TouchableOpacity onPress={handleSkip} disabled={submitting}>
            <Text style={[styles.heroSubTitle, { color: colors.red, fontSize: 11 }]}>[ SKIP QUIZ ]</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>✦ DETAILS ✦</Text>

        <View style={styles.heroBottomBar}>
          <View>
            <Text style={styles.heroSubTitle}>Aesthetic-match engine</Text>
            <Text style={styles.heroItalic}>{currentQuestion.sub}</Text>
          </View>
          <Text style={styles.heroZero}>{currentIndex + 1}</Text>
        </View>
      </View>

      {/* QUIZ PANEL */}
      <View style={styles.quizPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelHeaderText}>Kaphor style protocol</Text>
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, { backgroundColor: colors.rose }]} />
            <View style={[styles.dot, { backgroundColor: colors.gold }]} />
            <View style={[styles.dot, { backgroundColor: colors.forest }]} />
          </View>
        </View>

        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>
            QUESTION {currentIndex + 1} OF {QUESTIONS.length}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentIndex + 1) / QUESTIONS.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        <Text style={styles.questionText}>{currentQuestion.question}</Text>

        {/* Options */}
        <View style={currentQuestion.isRanked ? styles.vibeCardsContainer : styles.optionsContainer}>
          {currentQuestion.options.map((opt) => {
            if (currentQuestion.isRanked) {
              const isIdk = opt.key === 'IDK';
              const rankIndex = rankedVibes.indexOf(opt.key as AestheticId);
              const isSelected = isIdk ? isIdkSelected : rankIndex !== -1;
              const imgSource = AESTHETIC_IMAGES[opt.key];

              if (isIdk) {
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.idkOptionCard, isSelected && styles.idkOptionCardActive]}
                    onPress={() => handleToggleOption(opt.key)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.idkIconCircle, isSelected && styles.idkIconCircleActive]}>
                      <SolarIcon
                        name={isSelected ? 'checkmark' : 'help-outline'}
                        size={18}
                        color={isSelected ? colors.cream : colors.charcoal}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.idkTitle, isSelected && styles.idkTitleActive]}>
                        {opt.label}
                      </Text>
                      {Boolean(opt.sub) && (
                        <Text style={styles.idkSubtitle}>{opt.sub}</Text>
                      )}
                    </View>
                    <View style={[styles.idkRadio, isSelected && styles.idkRadioActive]}>
                      {isSelected && <View style={styles.idkRadioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              }

              return (
                <View
                  key={opt.key}
                  style={[styles.vibeCardLarge, isSelected && styles.vibeCardLargeActive]}
                >
                  {/* Card Header with Rank & Full Screen CTA */}
                  <View style={styles.vibeCardHeader}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      onPress={() => handleToggleOption(opt.key)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.vibeRankBadge, isSelected && styles.vibeRankBadgeActive]}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.vibeRankBadgeText, isSelected && styles.vibeRankBadgeTextActive]}>
                          {isSelected ? `#${rankIndex + 1}` : '○'}
                        </Text>
                      </View>
                      <Text style={[styles.vibeCardTitle, isSelected && styles.vibeCardTitleActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.expandFullscreenBtn}
                      onPress={() => setFullscreenAesthetic(opt.key)}
                      activeOpacity={0.7}
                    >
                      <SolarIcon name="scan-outline" size={13} color={colors.charcoal} />
                      <Text style={styles.expandFullscreenText}>Full screen</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Big Lookbook Moodboard Poster (Tap for Full Screen) */}
                  {imgSource && (
                    <TouchableOpacity
                      style={styles.vibeImageWrapLarge}
                      onPress={() => setFullscreenAesthetic(opt.key)}
                      activeOpacity={0.92}
                    >
                      <Image
                        source={imgSource}
                        style={styles.vibeImageLarge}
                        contentFit="contain"
                      />
                      <View style={styles.tapToExpandOverlay}>
                        <SolarIcon name="expand" size={13} color={colors.cream} />
                        <Text style={styles.tapToExpandText}>Tap to expand full screen</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Subtitle / Description */}
                  {Boolean(opt.sub) && (
                    <Text style={styles.vibeCardSubLarge}>{opt.sub}</Text>
                  )}

                  {/* Tap to Select / Rank Button */}
                  <TouchableOpacity
                    style={[styles.vibeSelectPill, isSelected && styles.vibeSelectPillActive]}
                    onPress={() => handleToggleOption(opt.key)}
                    activeOpacity={0.8}
                  >
                    <SolarIcon
                      name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={15}
                      color={isSelected ? colors.white : colors.charcoal}
                    />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.vibeSelectPillText, isSelected && styles.vibeSelectPillTextActive]}>
                      {isSelected
                        ? `SELECTED AS VIBE #${rankIndex + 1} (TAP TO REMOVE)`
                        : 'Select as aesthetic vibe'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // Standard options for Questions 1-7
            const isSelected = currentSelections.includes(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, isSelected && styles.optionRowActive]}
                onPress={() => handleToggleOption(opt.key)}
                activeOpacity={0.8}
              >
                {/* Checkbox / Radio */}
                <View style={[styles.radioOutline, isSelected && styles.radioFilled]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                    {opt.label}
                  </Text>
                  {Boolean(opt.sub) && (
                    <Text style={styles.optionSubText}>{opt.sub}</Text>
                  )}
                </View>

                {isSelected && (
                  <SolarIcon name="checkmark" size={16} color={colors.red} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Nav Buttons */}
        <View style={styles.navButtonsRow}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.backBtnText}>Prev</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} disabled={submitting}>
            {submitting ? (
              <Spinner color={colors.cream} size="small" />
            ) : (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.nextBtnText}>
                {currentIndex === QUESTIONS.length - 1 ? 'Generate style profile →' : 'Next step →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

    {/* FULL SCREEN LIGHTBOX MODAL */}
    <Modal
      visible={Boolean(fullscreenAesthetic)}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setFullscreenAesthetic(null)}
    >
      <View style={styles.fullscreenModalBackdrop}>
        {/* Top Header */}
        <View style={styles.fullscreenTopBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fullscreenAestheticTitle}>
              {fullscreenAesthetic?.toUpperCase()}
            </Text>
            <Text style={styles.fullscreenAestheticSub}>
              Aesthetic style guide & moodboard
            </Text>
          </View>

          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Close"
            style={styles.fullscreenCloseBtn}
            onPress={() => setFullscreenAesthetic(null)}
            activeOpacity={0.8}
          >
            <SolarIcon name="close" size={26} color={colors.cream} />
          </TouchableOpacity>
        </View>

        {/* Centered Large Image */}
        {Boolean(fullscreenAesthetic && AESTHETIC_IMAGES[fullscreenAesthetic]) && (
          <View style={styles.fullscreenImageContainer}>
            <Image
              source={AESTHETIC_IMAGES[fullscreenAesthetic!]}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
          </View>
        )}

        {/* Bottom Actions */}
        <View style={styles.fullscreenBottomBar}>
          {fullscreenAesthetic && (
            <TouchableOpacity
              style={[
                styles.fullscreenSelectBtn,
                rankedVibes.includes(fullscreenAesthetic as AestheticId) && styles.fullscreenSelectBtnActive,
              ]}
              onPress={() => {
                if (fullscreenAesthetic) {
                  handleToggleOption(fullscreenAesthetic);
                }
              }}
              activeOpacity={0.85}
            >
              <SolarIcon
                name={
                  rankedVibes.includes(fullscreenAesthetic as AestheticId)
                    ? 'checkmark-circle'
                    : 'add-circle-outline'
                }
                size={20}
                color={
                  rankedVibes.includes(fullscreenAesthetic as AestheticId)
                    ? colors.white
                    : colors.charcoal
                }
              />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                style={[
                  styles.fullscreenSelectBtnText,
                  rankedVibes.includes(fullscreenAesthetic as AestheticId) &&
                    styles.fullscreenSelectBtnTextActive,
                ]}
              >
                {rankedVibes.includes(fullscreenAesthetic as AestheticId)
                  ? `SELECTED AS VIBE #${
                      rankedVibes.indexOf(fullscreenAesthetic as AestheticId) + 1
                    } — TAP TO REMOVE`
                  : `CHOOSE ${fullscreenAesthetic.toUpperCase()} AS VIBE`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  heroCard: {
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.red,
    padding: 16,
    marginBottom: 16,
  },
  heroRank: {
    fontFamily: typography.ranks,
    fontSize: 20,
    color: colors.cream,
    fontWeight: 'bold',
  },
  heroTitle: {
    fontFamily: typography.headings,
    fontSize: 32,
    color: colors.cream,
    textAlign: 'center',
    marginVertical: 12,
    letterSpacing: 3,
  },
  heroBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.paperGlass,
    paddingTop: 8,
  },
  heroSubTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.cream, includeFontPadding: false, },
  heroItalic: {
    fontFamily: typography.handwritten,
    color: colors.paperGlass,
    fontSize: 13,
    marginTop: 2, includeFontPadding: false, },
  heroZero: {
    fontFamily: typography.ranks,
    fontSize: 28,
    color: colors.red,
    lineHeight: 34,
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
    fontFamily: typography.handwritten,
    fontSize: 13, includeFontPadding: false, },
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
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.red,
    marginBottom: 4, includeFontPadding: false, },
  progressTrack: {
    height: 2,
    backgroundColor: colors.overlayLight,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.red,
  },
  questionText: {
    fontFamily: typography.headings,
    fontSize: 20,
    color: colors.charcoal,
    paddingHorizontal: 16,
    marginVertical: 14,
    letterSpacing: 0.5,
    lineHeight: 26,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.overlayLight,
    backgroundColor: colors.white,
    borderRadius: 4,
  },
  optionRowActive: {
    backgroundColor: colors.goldLight,
    borderColor: colors.red,
  },
  radioOutline: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: colors.overlay,
    marginRight: 10,
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
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankCircleActive: {
    borderColor: colors.red,
    backgroundColor: colors.red,
  },
  rankCircleText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  rankCircleTextActive: {
    color: colors.cream,
  },
  optionText: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  optionTextActive: {
    color: colors.charcoal,
  },
  optionSubText: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  /* Vibe Cards & Lookbook Images */
  vibeCardsContainer: {
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 20,
  },
  vibeCardLarge: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.overlayLight,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  vibeCardLargeActive: {
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    backgroundColor: colors.paperLight,
  },
  vibeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vibeCardTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 16,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  vibeCardTitleActive: {
    fontWeight: '900',
    color: colors.charcoal,
  },
  vibeRankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  vibeRankBadgeActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  vibeRankBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  vibeRankBadgeTextActive: {
    color: colors.cream,
  },
  expandFullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  expandFullscreenText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  vibeImageWrapLarge: {
    width: '100%',
    height: 320,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vibeImageLarge: {
    width: '100%',
    height: '100%',
  },
  tapToExpandOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: colors.overlay,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tapToExpandText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.cream, includeFontPadding: false, },
  vibeCardSubLarge: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  vibeSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.overlayLight,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.overlay,
  },
  vibeSelectPillActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  vibeSelectPillText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  vibeSelectPillTextActive: {
    color: colors.cream,
  },

  /* Full Screen Lightbox Modal */
  fullscreenModalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  fullscreenTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  fullscreenAestheticTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.cream,
    letterSpacing: 1,
  },
  fullscreenAestheticSub: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.paperGlass,
    marginTop: 2, includeFontPadding: false, },
  fullscreenCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
    maxWidth: 950,
    maxHeight: '94%',
  },
  fullscreenBottomBar: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  fullscreenSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.cream,
    height: 48,
    borderRadius: 4,
  },
  fullscreenSelectBtnActive: {
    backgroundColor: colors.crimson,
  },
  fullscreenSelectBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
  fullscreenSelectBtnTextActive: {
    color: colors.white,
  },
  idkOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.overlay,
    backgroundColor: colors.paperLight,
    borderRadius: 6,
    gap: 12,
    marginTop: 6,
  },
  idkOptionCardActive: {
    backgroundColor: colors.paperDark,
    borderColor: colors.charcoal,
    borderStyle: 'solid',
  },
  idkIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  idkIconCircleActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  idkTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.charcoal,
    fontWeight: '700',
  },
  idkTitleActive: {
    fontWeight: '900',
    color: colors.charcoal,
  },
  idkSubtitle: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 19, includeFontPadding: false, },
  idkRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  idkRadioActive: {
    borderColor: colors.charcoal,
    backgroundColor: colors.charcoal,
  },
  idkRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cream,
  },
  primaryAestheticHeroWrap: {
    width: '100%',
    height: 440,
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.paperLight,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAestheticHeroImage: {
    width: '100%',
    height: '100%',
  },
  secondaryAestheticThumbWrap: {
    width: '100%',
    height: 320,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.paperLight,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAestheticThumb: {
    width: '100%',
    height: '100%',
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
    backgroundColor: colors.white,
  },
  backBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
  },
  nextBtn: {
    flex: 2.5,
    height: 44,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // RESULTS STYLING
  // ══════════════════════════════════════════════════════════════════════════════
  resultScroll: {
    paddingBottom: 60,
  },
  resultHeaderCard: {
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  resultHeaderRank: {
    fontFamily: typography.ranks,
    fontSize: 28,
    color: colors.gold,
  },
  resultSubtitle: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.cream,
    marginTop: 4, includeFontPadding: false, },
  resultMainTitle: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.cream,
    letterSpacing: 2,
    marginTop: 6,
  },

  primaryAestheticCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 18,
    borderRadius: 8,
    marginBottom: 16,
  },
  primaryBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aestheticPill: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  aestheticPillText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.cream, includeFontPadding: false, },
  matchPercentBadge: {
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.red,
  },
  aestheticNameTitle: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.charcoal,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  aestheticTagline: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.red,
    marginBottom: 8, includeFontPadding: false, },
  aestheticDescription: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.overlay,
    lineHeight: 20,
    marginBottom: 14,
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.overlayLight,
    marginVertical: 12,
  },
  essentialsHeading: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal,
    marginBottom: 8, includeFontPadding: false, },
  essentialsList: {
    gap: 6,
  },
  essentialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletDot: {
    color: colors.red,
    fontSize: 14,
    lineHeight: 18,
      fontFamily: typography.body,
  },
  essentialItemText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
  },

  secondaryAestheticCard: {
    backgroundColor: colors.paperGlass,
    borderWidth: 1.5,
    borderColor: colors.overlay,
    padding: 14,
    borderRadius: 6,
    marginBottom: 20,
  },
  secondaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  closeSecondBadge: {
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  closeSecondBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  secondaryMatchPercent: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.charcoal,
  },
  secondaryName: {
    fontFamily: typography.bodyBold,
    fontSize: 16,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  secondaryTagline: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  exploreMarketplaceBtn: {
    backgroundColor: colors.red,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  exploreBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.cream,
    letterSpacing: 0.2,
  },
});
