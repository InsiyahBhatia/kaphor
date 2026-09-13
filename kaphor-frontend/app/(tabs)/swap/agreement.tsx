import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { safeBack } from '../../../src/utils/navigation';
import { useAuth } from '../../../src/context/AuthContext';
import { swapService } from '../../../src/services/swapService';
import { messageService } from '../../../src/services/messageService';
import { addressService, Address } from '../../../src/services/addressService';
import {
  SWAP_AGREEMENT_TERMS,
  SWAP_STATUS_LABELS,
  PLATFORM_LEGAL_DISCLAIMER,
} from '../../../src/types/swap';
import type { SwapTransaction, SwapAddress } from '../../../src/types/swap';

export default function SwapAgreementScreen() {
  const { swapId } = useLocalSearchParams<{ swapId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [swap, setSwap] = useState<SwapTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<Set<number>>(new Set());
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showLegalClauses, setShowLegalClauses] = useState(false);

  // Address Book Integration
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const list = await addressService.list();
      setAddresses(list || []);
      setSelectedAddress((prev) => {
        if (prev && list.some((a) => a.id === prev.id)) {
          return list.find((a) => a.id === prev.id) || prev;
        }
        return list.find((a) => a.isDefault) || list[0] || null;
      });
    } catch (e) {
      console.warn('Failed to load address book for swap agreement', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

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
    if (!selectedAddress) {
      Alert.alert(
        'Delivery Address Required',
        'Please select or add a delivery address from your address book where your swap item will be delivered.',
        [
          { text: 'Choose Address', onPress: () => setShowAddressPicker(true) },
          { text: 'Add New Address', onPress: () => router.push('/profile/addresses' as any) },
        ]
      );
      return;
    }

    setSaving(true);
    try {
      // 1. Sign agreement
      await swapService.signAgreement(swapId!);

      // 2. Automatically share selected address with the partner
      const swapAddrPayload: SwapAddress = {
        fullName: selectedAddress.fullName,
        phone: selectedAddress.phone,
        line1: selectedAddress.line1,
        line2: selectedAddress.line2 || undefined,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
      };
      await swapService.shareAddress(swapId!, swapAddrPayload).catch((err) => {
        console.warn('Auto address share error:', err);
      });

      Alert.alert(
        'Agreement Signed & Address Shared!',
        `Your delivery address has been shared with ${swap?.initiator?.id === swapId ? 'the partner' : 'your swap partner'}. Proceed to escrow deposit & shipment coordination.`,
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

  const fallback = swapId ? `/(tabs)/swap/details?swapId=${swapId}` : '/(tabs)/circular';

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="SWAP AGREEMENT" showBack fallbackPath={fallback} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.charcoal} />
        </View>
      </View>
    );
  }

  if (!swap) {
    return (
      <View style={styles.container}>
        <Header title="SWAP AGREEMENT" showBack fallbackPath={fallback} />
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
      <Header title="SWAP AGREEMENT" showBack fallbackPath={fallback} />

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

        {/* Intermediary Safe Harbour & Legal Disclaimer (Indian Law) */}
        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerBadgeRow}>
            <View style={styles.disclaimerBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.white} />
              <Text style={styles.disclaimerBadgeText}>INDIAN LAW • SAFE HARBOUR</Text>
            </View>
            <Text style={styles.disclaimerStatuteRef}>IT ACT 2000 § 79</Text>
          </View>

          <Text style={styles.disclaimerMainTitle}>
            PLATFORM NON-LIABILITY DISCLAIMER
          </Text>

          <Text style={styles.disclaimerNoticeText}>
            Kaphor operates strictly as a peer-to-peer technology facilitator and electronic intermediary under Section 79 of the Information Technology Act, 2000.
          </Text>

          <View style={styles.nonLiabilityCallout}>
            <Ionicons name="alert-circle" size={16} color={colors.red} style={{ marginTop: 1 }} />
            <Text style={styles.nonLiabilityCalloutText}>
              <Text style={{ fontWeight: '900', color: colors.red }}>PLATFORM IS NOT RESPONSIBLE: </Text>
              Kaphor bears NO responsibility or liability for any transaction in Swapping, Rental, Buying, or Selling. All transactions constitute private bipartite contracts directly between users.
            </Text>
          </View>

          {/* Key Legal Pillars */}
          <View style={styles.legalPillarsRow}>
            <View style={styles.legalPillarChip}>
              <Ionicons name="people-outline" size={12} color={colors.charcoal} />
              <Text style={styles.legalPillarText}>Direct P2P Contract</Text>
            </View>
            <View style={styles.legalPillarChip}>
              <Ionicons name="eye-off-outline" size={12} color={colors.charcoal} />
              <Text style={styles.legalPillarText}>No Item Warranty</Text>
            </View>
            <View style={styles.legalPillarChip}>
              <Ionicons name="scale-outline" size={12} color={colors.charcoal} />
              <Text style={styles.legalPillarText}>Caveat Emptor</Text>
            </View>
            <View style={styles.legalPillarChip}>
              <Ionicons name="business-outline" size={12} color={colors.charcoal} />
              <Text style={styles.legalPillarText}>India Jurisdiction</Text>
            </View>
          </View>

          {/* Expandable Statutory Clauses Toggle */}
          <TouchableOpacity
            style={styles.expandClausesBtn}
            onPress={() => setShowLegalClauses(!showLegalClauses)}
            activeOpacity={0.7}
          >
            <Text style={styles.expandClausesBtnText}>
              {showLegalClauses
                ? 'HIDE STATUTORY CLAUSES ▲'
                : 'READ STATUTORY DISCLAIMER (5 CLAUSES) ▼'}
            </Text>
          </TouchableOpacity>

          {/* Expanded Statutory Clauses */}
          {showLegalClauses && (
            <View style={styles.clausesContainer}>
              {PLATFORM_LEGAL_DISCLAIMER.clauses.map((clause, cIdx) => (
                <View key={cIdx} style={styles.clauseItem}>
                  <Text style={styles.clauseHeading}>{clause.heading}</Text>
                  <Text style={styles.clauseContent}>{clause.content}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Agreement Terms */}
        <View style={styles.termsCard}>
          <Text style={styles.sectionTitle}>MUTUAL AGREEMENT & TRANSACTION CONDITIONS</Text>
          <Text style={styles.sectionDesc}>
            Please review each term carefully. Both parties must accept all conditions,
            including the Indian Law non-liability disclaimer, to execute this agreement.
          </Text>

          {SWAP_AGREEMENT_TERMS.map((term, idx) => {
            const splitIdx = term.indexOf(':');
            const prefix = splitIdx !== -1 ? term.slice(0, splitIdx) : null;
            const body = splitIdx !== -1 ? term.slice(splitIdx + 1).trim() : term;

            return (
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
                <View style={{ flex: 1 }}>
                  {prefix && (
                    <Text style={styles.termPrefix}>{prefix.toUpperCase()}</Text>
                  )}
                  <Text style={styles.termText}>{body}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Accept All Button */}
          <TouchableOpacity
            style={styles.acceptAllBtn}
            onPress={acceptAll}
            activeOpacity={0.7}
          >
            <Text style={styles.acceptAllText}>
              {termsAccepted ? 'ALL 7 CONDITIONS ACCEPTED ✓' : 'ACCEPT ALL CONDITIONS'}
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
              ₹{Math.round(swap.swapFee || 250).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Delivery Address for Swap */}
        <View style={styles.addressSection}>
          <View style={styles.addressSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={16} color={colors.charcoal} />
              <Text style={styles.sectionTitleNoMargin}>YOUR DELIVERY ADDRESS</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddressPicker(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.changeAddressLink}>
                {selectedAddress ? 'CHANGE' : 'SELECT'}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedAddress ? (
            <TouchableOpacity
              style={styles.selectedAddressCard}
              onPress={() => setShowAddressPicker(true)}
              activeOpacity={0.85}
            >
              <View style={styles.addressBadgeRow}>
                <Text style={styles.addressNameText}>{selectedAddress.fullName}</Text>
                <View style={styles.addressTypeBadge}>
                  <Text style={styles.addressTypeBadgeText}>
                    {selectedAddress.label?.toUpperCase() || 'HOME'}
                  </Text>
                </View>
              </View>
              <Text style={styles.addressPhoneText}>{selectedAddress.phone}</Text>
              <Text style={styles.addressFullText}>
                {[
                  selectedAddress.line1,
                  selectedAddress.line2,
                  selectedAddress.city,
                  selectedAddress.state,
                  selectedAddress.pincode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.selectAddressPlaceholder}
              onPress={() => setShowAddressPicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.red} />
              <Text style={styles.selectAddressPlaceholderText}>
                Select delivery address from address book
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Address Picker Modal */}
      {showAddressPicker && (
        <View style={styles.addressModalOverlay}>
          <View style={styles.addressModalContent}>
            <View style={styles.addressModalHeader}>
              <Text style={styles.addressModalTitle}>SELECT DELIVERY ADDRESS</Text>
              <TouchableOpacity
                onPress={() => setShowAddressPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.charcoal} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {addresses.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontFamily: typography.mono, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 12 }}>
                    No addresses found in your address book.
                  </Text>
                  <TouchableOpacity
                    style={styles.addNewAddressBtn}
                    onPress={() => {
                      setShowAddressPicker(false);
                      router.push('/profile/addresses' as any);
                    }}
                  >
                    <Text style={styles.addNewAddressBtnText}>+ ADD NEW ADDRESS</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {addresses.map((addr) => {
                    const isCurrent = selectedAddress?.id === addr.id;
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        style={[styles.addressOptionCard, isCurrent && styles.addressOptionCardActive]}
                        onPress={() => {
                          setSelectedAddress(addr);
                          setShowAddressPicker(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.addressOptionHeader}>
                          <Text style={styles.addressOptionName}>{addr.fullName}</Text>
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>
                              {addr.label?.toUpperCase() || 'SAVED'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.addressOptionPhone}>{addr.phone}</Text>
                        <Text style={styles.addressOptionText}>
                          {[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.addNewAddressBtn, { marginTop: 6, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.charcoal }]}
                    onPress={() => {
                      setShowAddressPicker(false);
                      router.push('/profile/addresses' as any);
                    }}
                  >
                    <Text style={[styles.addNewAddressBtnText, { color: colors.charcoal }]}>+ MANAGE / ADD NEW ADDRESS</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarNoticeRow}>
          <Ionicons name="shield-checkmark" size={13} color={colors.charcoal} />
          <Text style={styles.bottomDisclaimerNotice}>
            Intermediary Safe Harbour: Kaphor is not liable for transactions across swapping, rental, buying, or selling (IT Act §79).
          </Text>
        </View>
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
                  : 'ACCEPT ALL 7 CONDITIONS'}
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

  // Address selection styles
  addressSection: {
    marginBottom: 20,
  },
  addressSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleNoMargin: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  changeAddressLink: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    textDecorationLine: 'underline',
    letterSpacing: 0.8,
  },
  selectedAddressCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addressBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressNameText: {
    fontFamily: typography.headings,
    fontSize: 15,
    color: colors.charcoal,
    fontWeight: '700',
  },
  addressTypeBadge: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  addressTypeBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
  },
  addressPhoneText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  addressFullText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
  },
  selectAddressPlaceholder: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.charcoal,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  selectAddressPlaceholderText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.charcoal,
    textAlign: 'center',
  },

  // Modal styles
  addressModalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  addressModalContent: {
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  addressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.charcoal,
  },
  addressModalTitle: {
    fontFamily: typography.headings,
    fontSize: 14,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  addNewAddressBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  addNewAddressBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.8,
  },
  addressOptionCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    marginBottom: 10,
  },
  addressOptionCardActive: {
    borderWidth: 2.5,
    borderColor: colors.charcoal,
    backgroundColor: '#fffdf5',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addressOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressOptionName: {
    fontFamily: typography.headings,
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoal,
  },
  addressOptionPhone: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
  },
  addressOptionText: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 16,
  },
  defaultBadge: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
  },

  // Intermediary Disclaimer Styles
  disclaimerCard: {
    backgroundColor: '#FAF5EE',
    padding: 18,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  disclaimerBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  disclaimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  disclaimerBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.8,
  },
  disclaimerStatuteRef: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  disclaimerMainTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  disclaimerNoticeText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  nonLiabilityCallout: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(217,4,41,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: colors.red,
    padding: 10,
    marginBottom: 14,
  },
  nonLiabilityCalloutText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 11.5,
    color: colors.charcoal,
    lineHeight: 16.5,
  },
  legalPillarsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  legalPillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.18)',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  legalPillarText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.charcoal,
  },
  expandClausesBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandClausesBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  clausesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.12)',
    gap: 12,
  },
  clauseItem: {
    gap: 3,
  },
  clauseHeading: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  clauseContent: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 16,
  },
  termPrefix: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  bottomBarNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  bottomDisclaimerNotice: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    lineHeight: 12,
  },
});
