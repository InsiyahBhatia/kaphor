import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { colors, typography } from '../../src/theme';
import { Header } from '../../src/components/common/Header';
import { verificationService, VerificationData } from '../../src/services/verificationService';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { Loader, Spinner } from '../../src/components/common/Loader';

const DOC_TYPES = [
  { id: 'AADHAAR', label: 'Aadhaar Card', icon: 'card-outline' as const },
  { id: 'PASSPORT', label: 'Passport', icon: 'airplane-outline' as const },
  { id: 'VOTER_ID', label: 'Voter ID', icon: 'newspaper-outline' as const },
  { id: 'RESELLER_PERMIT', label: 'Fashion Reseller / GST', icon: 'business-outline' as const },
];

export default function VerifyIdentityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<VerificationData | null>(null);

  const [selectedDocType, setSelectedDocType] = useState('AADHAAR');
  const [legalName, setLegalName] = useState('');
  const [idNumber, setIdNumber] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await verificationService.getStatus();
      setStatus(data);
    } catch (e) {
      console.error('Failed to load verification status', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!legalName.trim()) {
      Alert.alert('Missing Field', 'Please enter your full legal name as it appears on your ID.');
      return;
    }
    if (!idNumber.trim() || idNumber.trim().length < 4) {
      Alert.alert('Missing Field', 'Please enter a valid document ID number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await verificationService.submitVerification({
        verificationType: selectedDocType,
        idNumber: idNumber.trim(),
      });
      setStatus(res.data);
      Alert.alert('Verification Activated', res.message);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Verification submission failed.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Loader variant="default" layout="form" />
      </View>
    );
  }

  const isVerified = status?.isVerified || status?.verificationStatus === 'VERIFIED';
  const isPending = status?.verificationStatus === 'PENDING_REVIEW';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="IDENTITY VERIFICATION" showBack fallbackPath="/(tabs)/profile" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {/* Status Card */}
        {isVerified ? (
          <View style={styles.verifiedCard}>
            <View style={styles.verifiedHeader}>
              <View style={styles.verifiedIconWrap}>
                <SolarIcon name="shield-checkmark" size={32} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifiedTitle}>VERIFIED MEMBER</Text>
                <Text style={styles.verifiedSub}>
                  Your identity has been authenticated. You enjoy top-tier community trust and verified badges across your listings and profile.
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>DOC TYPE</Text>
                <Text style={styles.detailValue}>{status?.verificationType || 'GOVERNMENT ID'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>LAST 4 DIGITS</Text>
                <Text style={styles.detailValue}>•••• {status?.idNumberLast4 || 'XXXX'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>STATUS</Text>
                <Text style={[styles.detailValue, { color: colors.forest }]}>ACTIVE</Text>
              </View>
            </View>
          </View>
        ) : isPending ? (
          <View style={styles.pendingCard}>
            <SolarIcon name="time-outline" size={28} color={colors.gold} />
            <Text style={styles.pendingTitle}>VERIFICATION IN PROGRESS</Text>
            <Text style={styles.pendingText}>
              Your document submission is being processed by the Kaphor Trust & Safety team. Verification typically completes within 24 hours.
            </Text>
          </View>
        ) : (
          <>
            {/* Trust Intro */}
            <View style={styles.introCard}>
              <View style={styles.introHeader}>
                <SolarIcon name="shield-checkmark" size={20} color={colors.gold} />
                <Text style={styles.introTitle}>KAPHOR TRUST & VERIFICATION</Text>
              </View>
              <Text style={styles.introBody}>
                Get verified to earn the official Gold Shield badge on your profile and marketplace listings. Verified members receive 3x more buyer inquiries and higher conversion rates.
              </Text>
            </View>

            {/* Perks Grid */}
            <View style={styles.perksGrid}>
              <View style={styles.perkItem}>
                <SolarIcon name="ribbon-outline" size={18} color={colors.charcoal} />
                <Text style={styles.perkTitle}>Gold Trust Badge</Text>
                <Text style={styles.perkDesc}>Featured prominently across your profile and products</Text>
              </View>
              <View style={styles.perkItem}>
                <SolarIcon name="lock-closed-outline" size={18} color={colors.charcoal} />
                <Text style={styles.perkTitle}>Bank-Grade Privacy</Text>
                <Text style={styles.perkDesc}>256-bit encrypted; ID numbers are never stored in full</Text>
              </View>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>1. SELECT DOCUMENT TYPE</Text>
              <View style={styles.docTypesList}>
                {DOC_TYPES.map((doc) => {
                  const isSelected = selectedDocType === doc.id;
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={[styles.docTypeCard, isSelected && styles.docTypeCardActive]}
                      onPress={() => setSelectedDocType(doc.id)}
                      activeOpacity={0.7}
                    >
                      <SolarIcon
                        name={doc.icon}
                        size={18}
                        color={isSelected ? colors.cream : colors.charcoal}
                      />
                      <Text
                        style={[styles.docTypeLabel, isSelected && styles.docTypeLabelActive]}
                      >
                        {doc.label}
                      </Text>
                      {isSelected && (
                        <SolarIcon name="checkmark-circle" size={16} color={colors.gold} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.formSectionTitle, { marginTop: 24 }]}>
                2. ENTER CREDENTIAL DETAILS
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FULL LEGAL NAME</Text>
                <TextInput accessibilityLabel="Insiyah Bhatia"
                  style={styles.input}
                  placeholder="e.g. Insiyah Bhatia"
                  placeholderTextColor={colors.textMuted}
                  value={legalName}
                  onChangeText={setLegalName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DOCUMENT ID NUMBER</Text>
                <TextInput accessibilityLabel="12-digit Aadhaar / Passport No"
                  style={styles.input}
                  placeholder="e.g. 12-digit Aadhaar / Passport No."
                  placeholderTextColor={colors.textMuted}
                  value={idNumber}
                  onChangeText={setIdNumber}
                  autoCapitalize="characters"
                />
                <Text style={styles.privacyNote}>
                  🔒 For your privacy, only the last 4 digits are retained for compliance logs.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <Spinner color={colors.cream} size="small" />
                ) : (
                  <>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.submitButtonText}>ACTIVATE VERIFIED STATUS</Text>
                    <SolarIcon name="shield-checkmark" size={18} color={colors.gold} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 160,
  },
  verifiedCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  verifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  verifiedIconWrap: {
    width: 52,
    height: 52,
    backgroundColor: colors.charcoal,
    borderWidth: 1.5,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 15,
    color: colors.charcoal,
    marginBottom: 4,
  },
  verifiedSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
    paddingTop: 16,
  },
  detailItem: {
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  detailValue: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
  },
  pendingCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  pendingTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 15,
    color: colors.charcoal,
  },
  pendingText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  introCard: {
    backgroundColor: colors.charcoal,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  introTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.gold,
  },
  introBody: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.goldDark,
    lineHeight: 18,
  },
  perksGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  perkItem: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    gap: 6,
  },
  perkTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  perkDesc: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  formSection: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  formSectionTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  docTypesList: {
    gap: 8,
  },
  docTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.overlayLight,
    backgroundColor: colors.cream,
  },
  docTypeCardActive: {
    borderColor: colors.charcoal,
    backgroundColor: colors.charcoal,
  },
  docTypeLabel: {
    flex: 1,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  docTypeLabelActive: {
    color: colors.cream,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    height: 48,
    paddingHorizontal: 14,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
  },
  privacyNote: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: colors.charcoal,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.cream,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
  },
});
