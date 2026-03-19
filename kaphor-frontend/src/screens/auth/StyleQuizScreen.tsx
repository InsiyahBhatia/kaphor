import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../theme';
import api from '../../services/api';

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface StyleQuizAnswers {
  aesthetic: string | null;
  categories: string[];
  colors: string[];
  fit: string | null;
  occasion: string | null;
  fabrics: string[];
  priceMin: number;
  priceMax: number;
  sustainability: number;
  frequency: number;
  brands: string[];
}

const AESTHETIC_OPTIONS = ['Minimalist', 'Vintage', 'Bold', 'Ethnic', 'Streetwear', 'Luxury'];
const CATEGORY_OPTIONS = ['Sarees', 'Jackets', 'Dresses', 'Accessories', 'Knitwear', 'Tailoring'];
const COLOR_SWATCHES = [
  { key: 'ivory', hex: '#F5F0EB' },
  { key: 'black', hex: '#000000' },
  { key: 'crimson', hex: '#8B0000' },
  { key: 'gold', hex: '#C9A84C' },
  { key: 'olive', hex: '#556B2F' },
  { key: 'charcoal', hex: '#333333' },
];
const FIT_OPTIONS = ['Oversized', 'Regular', 'Fitted', 'Tailored'];
const OCCASION_OPTIONS = ['Casual', 'Work', 'Evening', 'Cultural Events'];
const FABRIC_OPTIONS = ['Silk', 'Linen', 'Cotton', 'Wool', 'Leather', 'Synthetic'];

export function StyleQuizScreen() {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandInput, setBrandInput] = useState('');
  const [answers, setAnswers] = useState<StyleQuizAnswers>({
    aesthetic: null,
    categories: [],
    colors: [],
    fit: null,
    occasion: null,
    fabrics: [],
    priceMin: 50,
    priceMax: 600,
    sustainability: 3,
    frequency: 3,
    brands: [],
  });

  const totalSteps = 10;

  const progress = useMemo(() => (step + 1) / totalSteps, [step]);

  const goNext = () => {
    if (step < totalSteps - 1) {
      setStep((prev) => (prev + 1) as StepIndex);
      setError(null);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep((prev) => (prev - 1) as StepIndex);
      setError(null);
    }
  };

  const toggleChip = (field: keyof StyleQuizAnswers, value: string) => {
    setAnswers((prev) => {
      const current = (prev[field] as string[]) ?? [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter((v) => v !== value) };
      }
      return { ...prev, [field]: [...current, value] };
    });
  };

  const toggleColor = (key: string) => toggleChip('colors', key);
  const toggleCategory = (value: string) => toggleChip('categories', value);
  const toggleFabric = (value: string) => toggleChip('fabrics', value);

  const setSingle = (field: keyof StyleQuizAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const updateNumeric = (field: keyof StyleQuizAnswers, delta: number, min: number, max: number) => {
    setAnswers((prev) => {
      const current = (prev[field] as number) ?? 0;
      const next = Math.min(max, Math.max(min, current + delta));
      return { ...prev, [field]: next };
    });
  };

  const handleAddBrand = () => {
    const trimmed = brandInput.trim();
    if (!trimmed) return;
    setAnswers((prev) => ({
      ...prev,
      brands: prev.brands.includes(trimmed) ? prev.brands : [...prev.brands, trimmed],
    }));
    setBrandInput('');
  };

  const handleRemoveBrand = (brand: string) => {
    setAnswers((prev) => ({
      ...prev,
      brands: prev.brands.filter((b) => b !== brand),
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/ai/style-quiz', { answers });
      router.replace('/(tabs)/');
    } catch (err: unknown) {
      setError('We could not save your style profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.questionTitle}>Select Your Aesthetic</Text>
            <View style={styles.cardGrid}>
              {AESTHETIC_OPTIONS.map((option) => {
                const selected = answers.aesthetic === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.aestheticCard, selected && styles.aestheticCardSelected]}
                    onPress={() => setSingle('aesthetic', option)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.aestheticImagePlaceholder} />
                    <Text style={[styles.aestheticLabel, selected && styles.aestheticLabelSelected]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.questionTitle}>Preferred Clothing Categories</Text>
            <View style={styles.chipRowWrap}>
              {CATEGORY_OPTIONS.map((option) => {
                const selected = answers.categories.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleCategory(option)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.questionTitle}>Most Worn Colours</Text>
            <View style={styles.colorGrid}>
              {COLOR_SWATCHES.map((swatch) => {
                const selected = answers.colors.includes(swatch.key);
                return (
                  <TouchableOpacity
                    key={swatch.key}
                    style={[
                      styles.swatchOuter,
                      selected && styles.swatchOuterSelected,
                    ]}
                    onPress={() => toggleColor(swatch.key)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.swatchInner, { backgroundColor: swatch.hex }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.questionTitle}>Fit Preference</Text>
            <View style={styles.chipRowWrap}>
              {FIT_OPTIONS.map((option) => {
                const selected = answers.fit === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSingle('fit', option)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.questionTitle}>Primary Occasion</Text>
            <View style={styles.chipRowWrap}>
              {OCCASION_OPTIONS.map((option) => {
                const selected = answers.occasion === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSingle('occasion', option)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 5:
        return (
          <>
            <Text style={styles.questionTitle}>Favourite Fabrics</Text>
            <View style={styles.chipRowWrap}>
              {FABRIC_OPTIONS.map((option) => {
                const selected = answers.fabrics.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleFabric(option)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 6:
        return (
          <>
            <Text style={styles.questionTitle}>Price Range Comfort</Text>
            <Text style={styles.helperText}>
              Typical spend per piece: ${answers.priceMin} – ${answers.priceMax}
            </Text>
            <View style={styles.sliderRow}>
              <View style={styles.sliderSegment}>
                <Text style={styles.sliderLabel}>Min</Text>
                <View style={styles.sliderControls}>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => updateNumeric('priceMin', -50, 50, answers.priceMax)}
                  >
                    <Text style={styles.sliderButtonLabel}>–</Text>
                  </TouchableOpacity>
                  <Text style={styles.sliderValue}>${answers.priceMin}</Text>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => updateNumeric('priceMin', 50, 50, answers.priceMax)}
                  >
                    <Text style={styles.sliderButtonLabel}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.sliderSegment}>
                <Text style={styles.sliderLabel}>Max</Text>
                <View style={styles.sliderControls}>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => updateNumeric('priceMax', -50, answers.priceMin, 2000)}
                  >
                    <Text style={styles.sliderButtonLabel}>–</Text>
                  </TouchableOpacity>
                  <Text style={styles.sliderValue}>${answers.priceMax}</Text>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => updateNumeric('priceMax', 50, answers.priceMin, 2000)}
                  >
                    <Text style={styles.sliderButtonLabel}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );
      case 7:
        return (
          <>
            <Text style={styles.questionTitle}>Sustainability Priority</Text>
            <Text style={styles.helperText}>How important is sustainability in your decisions?</Text>
            <View style={styles.scaleRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const selected = answers.sustainability === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.scaleDot, selected && styles.scaleDotSelected]}
                    onPress={() =>
                      setAnswers((prev) => ({ ...prev, sustainability: value }))
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.scaleLabel, selected && styles.scaleLabelSelected]}>
                      {value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 8:
        return (
          <>
            <Text style={styles.questionTitle}>How Often Do You Shop?</Text>
            <Text style={styles.helperText}>Roughly, how often do you buy or rent new pieces?</Text>
            <View style={styles.sliderRowSingle}>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => updateNumeric('frequency', -1, 1, 7)}
              >
                <Text style={styles.sliderButtonLabel}>–</Text>
              </TouchableOpacity>
              <Text style={styles.sliderValue}>{answers.frequency} / month</Text>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => updateNumeric('frequency', 1, 1, 7)}
              >
                <Text style={styles.sliderButtonLabel}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      case 9:
        return (
          <>
            <Text style={styles.questionTitle}>Brands You Love</Text>
            <Text style={styles.helperText}>
              Mention labels you’re drawn to (e.g. Lemaire, Totême, Maison Margiela).
            </Text>
            <View style={styles.brandInputRow}>
              <TextInput
                value={brandInput}
                onChangeText={setBrandInput}
                placeholder="Type a brand and tap +"
                placeholderTextColor={colors.textMuted}
                style={styles.brandInput}
              />
              <TouchableOpacity
                style={styles.brandAddButton}
                onPress={handleAddBrand}
                activeOpacity={0.85}
              >
                <Text style={styles.brandAddLabel}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.brandChips}>
              {answers.brands.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  style={styles.brandChip}
                  onPress={() => handleRemoveBrand(brand)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.brandChipText}>{brand}</Text>
                  <Text style={styles.brandChipRemove}>×</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressTrack]} />
        <View style={[styles.progressFill, { flex: progress }]} />
        <Text style={styles.progressLabel}>
          Step {step + 1} / {totalSteps}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={step}
          style={styles.stepContainer}
          entering={FadeInRight.duration(400)}
          exiting={FadeOutLeft.duration(300)}
        >
          {renderStep()}
        </Animated.View>
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, step === 0 && styles.navButtonDisabled]}
          onPress={goBack}
          disabled={step === 0 || isSubmitting}
          activeOpacity={0.85}
        >
          <Text style={styles.navButtonLabel}>Back</Text>
        </TouchableOpacity>
        {step < totalSteps - 1 ? (
          <TouchableOpacity
            style={styles.navButtonPrimary}
            onPress={goNext}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.navButtonPrimaryLabel}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navButtonPrimary}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.navButtonPrimaryLabel}>
              {isSubmitting ? 'Saving…' : 'Finish & Enter Kaphor'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  progressBarContainer: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    flex: 1,
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: spacing.lg + 14,
  },
  progressFill: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  progressLabel: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    marginBottom: spacing.sm,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  stepContainer: {
    minHeight: 260,
  },
  questionTitle: {
    fontFamily: typography.headings,
    fontStyle: 'italic',
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  helperText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.textSecond,
    marginBottom: spacing.md,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  aestheticCard: {
    width: '46%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  aestheticCardSelected: {
    borderColor: colors.gold,
  },
  aestheticImagePlaceholder: {
    height: 90,
    backgroundColor: colors.bgMuted,
  },
  aestheticLabel: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.textSecond,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  aestheticLabelSelected: {
    color: colors.textPrimary,
  },
  chipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  chipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
  },
  chipLabel: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
  },
  chipLabelSelected: {
    color: colors.textPrimary,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatchOuter: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchOuterSelected: {
    borderColor: colors.gold,
  },
  swatchInner: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
  },
  sliderRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  sliderRowSingle: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  sliderSegment: {
    flex: 1,
  },
  sliderLabel: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    marginBottom: spacing.xs,
  },
  sliderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  sliderButtonLabel: {
    fontFamily: typography.body,
    fontSize: 16,
    color: colors.textPrimary,
  },
  sliderValue: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  scaleDot: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  scaleDotSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.14)',
  },
  scaleLabel: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.textSecond,
  },
  scaleLabelSelected: {
    color: colors.textPrimary,
  },
  brandInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  brandInput: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  brandAddButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAddLabel: {
    fontFamily: typography.body,
    fontSize: 20,
    color: colors.textPrimary,
  },
  brandChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  brandChipText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textPrimary,
  },
  brandChipRemove: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  error: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  navButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonLabel: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textSecond,
  },
  navButtonPrimary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.crimson,
  },
  navButtonPrimaryLabel: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
});

export default StyleQuizScreen;

