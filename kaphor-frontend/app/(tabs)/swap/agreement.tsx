import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { safeBack } from '../../../src/utils/navigation';
import { swapService } from '../../../src/services/swapService';
import { messageService } from '../../../src/services/messageService';
import { SWAP_AGREEMENT_TERMS, SWAP_STATUS_LABELS } from '../../../src/types/swap';
import type { SwapTransaction } from '../../../src/types/swap';

export default function SwapAgreementScreen() {
  const { swapId } = useLocalSearchParams<{ swapId: string }>();
  const router = useRouter();

  const [swap, setSwap] = useState<SwapTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<Set<number>>(new Set());
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    loadSwap();
  }, [swapId]);

  const loadSwap = async () => {
    try {
      const data = await swapService.getSwapById(swapId!);
      setSwap(data);
    } catch {
      Alert.alert('Error', 'Failed to load swap details');
    } finally {
      setLoading(false);
    }
  };

  const toggleTerm = (idx: number) => {
    const next = new Set(acceptedTerms);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setAcceptedTerms(next);
    setTermsAccepted(next.size === SWAP_AGREEMENT_TERMS.length);
  };

  const acceptAll = () => {
    const all = new Set(SWAP_AGREEMENT_TERMS.map((_, i) => i));
    setAcceptedTerms(all);
    setTermsAccepted(true);
  };

  const handleSign = async () => {
    if (!termsAccepted) {
      Alert.alert('Accept All Terms', 'Please read and accept all terms to proceed.');
      return;
    }
    setSaving(true);
    try {
      await swapService.signAgreement(swapId!);
      Alert.alert(
        'Agreement Signed',
        'You have accepted the swap terms. Proceed to deposit refundable ₹500 escrow and arrange shipping.',
        [
          {
            text: 'Go to Escrow & Shipping',
            onPress: () => router.replace(`/(tabs)/swap/shipping?swapId=${swapId}` as any),
          },
          { text: 'Done', onPress: () => safeBack(`/(tabs)/swap/details?swapId=${swapId}`) },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to sign agreement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="SWAP AGREEMENT" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.charcoal} />
        </View>
      </View>
    );
  }

  if (!swap) {
    return (
      <View style={styles.container}>
        <Header title="SWAP AGREEMENT" showBack />
        <View style={styles.center}>
          <Text style={styles.errorText}>Swap not found</Text>
        </View>
      </View>
    );
  }

  const initiatorAccepted = swap.initiatorAcceptedTerms;
  const receiverAccepted = swap.receiverAcceptedTerms;

  const handleChatWithPartner = async () => {
    const partner = (swap as any)?.initiator || (swap as any)?.receiver;
    if (!partner?.id) {
      Alert.alert('Notice', 'Partner profile information is currently unavailable.');
      return;
    }
    try {
      const garmentId = (swap?.garmentWanted as any)?.id || (swap?.garmentOffered as any)?.id;
      const conversation = await messageService.getOrCreateConversation(partner.id, garmentId);
      router.push(`/messages/${conversation.id}` as any);
    } catch {
      Alert.alert('Error', 'Could not open conversation with partner.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="SWAP AGREEMENT" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Chat With Partner Bar */}
        <TouchableOpacity style={styles.chatWithPartnerBar} onPress={handleChatWithPartner} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="chatbubbles-outline" size={16} color={colors.charcoal} />
            <Text style={styles.chatWithPartnerText}>CHAT WITH SWAP PARTNER</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Status Header */}
        <View style={styles.statusBar}>
          <Ionicons name="document-text" size={20} color={colors.charcoal} />
          <Text style={styles.statusText}>
            Step 2 of 5: Review & Sign Agreement
          </Text>
        </View>

        {/* Agreement Terms */}
        <View style={styles.termsCard}>
          <Text style={styles.sectionTitle}>SWAP TERMS</Text>
          <Text style={styles.sectionDesc}>
            Please read each term carefully. Both parties must accept all terms
            before proceeding to address exchange and shipping.
          </Text>

          {SWAP_AGREEMENT_TERMS.map((term, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.termRow,
                acceptedTerms.has(idx) && styles.termRowAccepted,
              ]}
              onPress={() => toggleTerm(idx)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.termCheckbox,
                  acceptedTerms.has(idx) && styles.termCheckboxActive,
                ]}
              >
                {acceptedTerms.has(idx) && (
                  <Ionicons name="checkmark" size={14} color={colors.cream} />
                )}
              </View>
              <Text style={styles.termText}>{term}</Text>
            </TouchableOpacity>
          ))}

          {/* Accept All Button */}
          <TouchableOpacity
            style={styles.acceptAllBtn}
            onPress={acceptAll}
            activeOpacity={0.7}
          >
            <Text style={styles.acceptAllText}>
              {termsAccepted ? 'ALL TERMS ACCEPTED ✓' : 'ACCEPT ALL TERMS'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Signature Status */}
        <View style={styles.signatureCard}>
          <Text style={styles.sectionTitle}>SIGNATURE STATUS</Text>

          <View style={styles.signatureRow}>
            <View style={[styles.signatureDot, initiatorAccepted && styles.signatureDotDone]} />
            <Text style={styles.signatureLabel}>
              {swap.initiator?.displayName || 'Initiator'}
            </Text>
            <Text style={[styles.signatureStatus, initiatorAccepted && styles.signatureStatusDone]}>
              {initiatorAccepted ? '✓ SIGNED' : '— PENDING'}
            </Text>
          </View>

          <View style={styles.signatureRow}>
            <View style={[styles.signatureDot, receiverAccepted && styles.signatureDotDone]} />
            <Text style={styles.signatureLabel}>
              {swap.receiver?.displayName || 'Receiver'}
            </Text>
            <Text style={[styles.signatureStatus, receiverAccepted && styles.signatureStatusDone]}>
              {receiverAccepted ? '✓ SIGNED' : '— PENDING'}
            </Text>
          </View>

          {initiatorAccepted && receiverAccepted && (
            <View style={styles.bothSignedBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.forest} />
              <Text style={styles.bothSignedText}>Both parties have signed</Text>
            </View>
          )}
        </View>

        {/* Security Deposit Notice */}
        <View style={styles.depositNote}>
          <Ionicons name="shield-checkmark" size={18} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.depositNoteTitle}>SECURITY DEPOSIT</Text>
            <Text style={styles.depositNoteText}>
              A refundable deposit of ₹500 is required from both parties before shipping.
              Deposits are released within 48 hours after both parties confirm receipt.
            </Text>
          </View>
        </View>

        {/* Swap Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>SWAP SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>You give:</Text>
            <Text style={styles.summaryValue}>
              {swap.garmentOffered?.title || 'Your garment'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>You receive:</Text>
            <Text style={styles.summaryValue}>
              {swap.garmentWanted?.title || 'Their garment'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Swap fee:</Text>
            <Text style={styles.summaryValue}>
              ₹{((swap.swapFee || 0) / 100).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.signBtn,
            (!termsAccepted || saving) && styles.signBtnDisabled,
          ]}
          onPress={handleSign}
          disabled={!termsAccepted || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <>
              <Ionicons name="document-text" size={18} color={colors.cream} />
              <Text style={styles.signBtnText}>
                {termsAccepted
                  ? 'SIGN AGREEMENT'
                  : 'ACCEPT ALL TERMS FIRST'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontFamily: typography.mono, fontSize: 14, color: colors.textMuted },

  content: { padding: 20, paddingBottom: 120 },
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionDesc: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 20,
  },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(30,31,34,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
    marginBottom: 20,
  },
  statusText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },

  termsCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.06)',
  },
  termRowAccepted: {
    backgroundColor: 'rgba(30,59,47,0.03)',
  },
  termCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  termCheckboxActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  termText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
  },
  acceptAllBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  acceptAllText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },

  signatureCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 20,
    gap: 12,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signatureDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(30,31,34,0.15)',
  },
  signatureDotDone: { backgroundColor: colors.forest },
  signatureLabel: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.charcoal,
  },
  signatureStatus: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  signatureStatusDone: { color: colors.forest },
  bothSignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(30,59,47,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(30,59,47,0.15)',
  },
  bothSignedText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.forest,
  },

  depositNote: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(28,43,74,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(28,43,74,0.12)',
    marginBottom: 20,
  },
  depositNoteTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.navy,
    letterSpacing: 1,
    marginBottom: 4,
  },
  depositNoteText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.navy,
    lineHeight: 14,
  },

  summaryCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 20,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  summaryValue: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    flex: 1,
    textAlign: 'right',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
  },
  signBtn: {
    backgroundColor: colors.charcoal,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  signBtnDisabled: { opacity: 0.6 },
  signBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chatWithPartnerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  chatWithPartnerText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
});
