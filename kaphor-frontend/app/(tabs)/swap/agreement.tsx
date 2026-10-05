import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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
import { telemetryService } from '../../../src/services/telemetryService';
import {
  SWAP_AGREEMENT_TERMS,
  SWAP_STATUS_LABELS,
  PLATFORM_LEGAL_DISCLAIMER,
} from '../../../src/types/swap';
import type { SwapTransaction, SwapAddress } from '../../../src/types/swap';
import { KEY_SWAP_PROTECTIONS } from '../../../src/data/legalPolicies';
import { LegalModal } from '../../../src/components/legal/LegalModal';
import { Loader, Spinner } from '../../../src/components/common/Loader';

export default function SwapAgreementScreen() {
  const { swapId } = useLocalSearchParams<{ swapId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [swap, setSwap] = useState<SwapTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);

  // Address Book Integration
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const list = await addressService.list();
      setAddresses(list || []);
      const activeFromService = addressService.getActiveDeliveryAddress();
      setSelectedAddress((prev) => {
        if (activeFromService && list.some((a) => a.id === activeFromService.id)) {
          return list.find((a) => a.id === activeFromService.id) || activeFromService;
        }
        if (prev && list.some((a) => a.id === prev.id)) {
          return list.find((a) => a.id === prev.id) || prev;
        }
        const def = list.find((a) => a.isDefault) || list[0] || null;
        if (def) addressService.setActiveDeliveryAddress(def);
        return def;
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
    const unsub = addressService.onSelectedAddressChange((addr) => {
      if (addr) setSelectedAddress(addr);
    });
    return unsub;
  }, []);

  useEffect(() => {
    loadSwap();
  }, [swapId]);

  const loadSwap = async () => {
    try {
      const data = await swapService.getSwapById(swapId!);
      setSwap(data);
      const wantedId = (data as any)?.wantedGarment?.id || (data as any)?.garmentWanted;
      if (wantedId) {
        telemetryService.trackIntent(wantedId, 'SWAP');
      }
    } catch {
      Alert.alert('Error', 'Failed to load swap details');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!termsAccepted) {
      Alert.alert(
        'Swap Agreement Required',
        'Please review and accept the mutual Swap Agreement terms to proceed with signing.',
        [
          { text: 'Review Terms', onPress: () => setLegalModalVisible(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    if (!selectedAddress) {
      Alert.alert(
        'Delivery Address Required',
        'Please select or add a delivery address from your address book where your swap item will be delivered.',
        [
          { text: 'Choose Address', onPress: () => setShowAddressPicker(true) },
          { text: 'Add New Address', onPress: () => router.push('/profile/addresses?selectMode=true' as any) },
        ]
      );
      return;
    }

    setSaving(true);
    try {
      // 1. Sign agreement
      await swapService.signAgreement(swapId!);
      const wantedId = (swap as any)?.wantedGarment?.id || (swap as any)?.garmentWanted;
      if (wantedId) {
        telemetryService.trackConversion(wantedId, 'SWAP');
      }

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
        `Your delivery address has been shared with ${swap?.initiator?.id === swapId ? 'the partner' : 'your swap partner'}. Next, pay the deposit and arrange shipping.`,
        [
          {
            text: 'Pay Deposit & Ship',
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
        <Loader variant="swap" compact />
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
            <Text style={styles.chatWithPartnerText}>Chat with swap partner</Text>
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

        {/* Streamlined Mutual Swap Protections Card */}
        <View style={styles.protectionsCard}>
          <View style={styles.disclaimerBadgeRow}>
            <View style={styles.disclaimerBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.white} />
              <Text style={styles.disclaimerBadgeText}>INDIAN CONTRACT ACT • BARTER</Text>
            </View>
            <Text style={styles.disclaimerStatuteRef}>IT ACT 2000 § 79</Text>
          </View>

          <Text style={styles.protectionsTitle}>Mutual swap protections</Text>
          <Text style={styles.protectionsSubtitle}>
            Both people agree to these swap rules:
          </Text>

          {/* 4 Protection Pillars */}
          <View style={styles.pillarsGrid}>
            {KEY_SWAP_PROTECTIONS.map((prot, pIdx) => (
              <View key={pIdx} style={styles.pillarItem}>
                <View style={styles.pillarIconWrap}>
                  <Ionicons name={prot.icon as any} size={16} color={colors.charcoal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pillarTitle}>{prot.title}</Text>
                  <Text style={styles.pillarSummary}>{prot.summary}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Master Agreement Acceptance Card */}
        <View style={styles.agreementAcceptanceCard}>
          <TouchableOpacity
            style={[
              styles.agreementCheckboxRow,
              termsAccepted && styles.agreementCheckboxRowActive,
            ]}
            onPress={() => setTermsAccepted(!termsAccepted)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.masterCheckbox,
                termsAccepted && styles.masterCheckboxActive,
              ]}
            >
              {termsAccepted && <Ionicons name="checkmark" size={16} color={colors.cream} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.agreementConsentTitle}>
                {termsAccepted ? 'SWAP AGREEMENT ACCEPTED ✓' : 'I accept the swap agreement'}
              </Text>
              <Text style={styles.agreementConsentDesc}>
                I confirm the offered item strictly matches photos and condition disclosures, agree to ship within 3 business days, and accept mutual barter terms and platform non-liability under Indian law.
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.legalLinksRow}>
            <TouchableOpacity
              style={styles.legalBtn}
              onPress={() => setLegalModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.charcoal} />
              <Text style={styles.legalBtnText}>Read statutory terms (5 clauses)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.legalBtnOutline}
              onPress={() => router.push('/legal?doc=swap-agreement' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-outline" size={14} color={colors.charcoal} />
              <Text style={styles.legalBtnText}>LEGAL CENTER ↗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Signature Status */}
        <View style={styles.signatureCard}>
          <Text style={styles.sectionTitle}>Signature status</Text>

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
            <Text style={styles.depositNoteTitle}>Security deposit</Text>
            <Text style={styles.depositNoteText}>
              A refundable deposit of ₹500 is required from both parties before shipping.
              Deposits are released within 48 hours after both parties confirm receipt.
            </Text>
          </View>
        </View>

        {/* Swap Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Swap summary</Text>
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
              <Text style={styles.sectionTitleNoMargin}>Your delivery address</Text>
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
              <Text style={styles.addressModalTitle}>Select delivery address</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
                onPress={() => setShowAddressPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.charcoal} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {addresses.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontFamily: typography.handwritten, fontSize: 17, color: colors.textMuted, textAlign: 'center', marginBottom: 12, includeFontPadding: false }}>
                    No addresses found in your address book.
                  </Text>
                    <TouchableOpacity
                      style={styles.addNewAddressBtn}
                      onPress={() => {
                        setShowAddressPicker(false);
                        router.push('/profile/addresses?selectMode=true' as any);
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
                          addressService.setActiveDeliveryAddress(addr);
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
                        router.push('/profile/addresses?selectMode=true' as any);
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
            <Spinner color={colors.cream} />
          ) : (
            <>
              <Ionicons name="document-text" size={18} color={colors.cream} />
              <Text style={styles.signBtnText}>
                {termsAccepted
                  ? 'Sign agreement & share address'
                  : 'Agree to swap terms to sign'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Full Statutory Legal Modal */}
      <LegalModal
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        initialDocId="swap-agreement"
        onAccept={() => setTermsAccepted(true)}
        showAcceptButton={!termsAccepted}
        acceptButtonText="Accept swap terms"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontFamily: typography.handwritten, fontSize: 19, color: colors.textMuted, includeFontPadding: false, },

  content: { padding: 20, paddingBottom: 120 },
  sectionTitle: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal,
    marginBottom: 8, includeFontPadding: false, },
  sectionDesc: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 23,
    marginBottom: 20, includeFontPadding: false, },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    marginBottom: 20,
  },
  statusText: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },

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
    borderBottomColor: colors.overlayLight,
  },
  termRowAccepted: {
    backgroundColor: colors.overlayLight,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.2,
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
    backgroundColor: colors.overlayLight,
  },
  signatureDotDone: { backgroundColor: colors.forest },
  signatureLabel: {
    flex: 1,
    fontFamily: typography.handSemi,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },
  signatureStatus: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.textMuted, includeFontPadding: false, },
  signatureStatusDone: { color: colors.forest },
  bothSignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  bothSignedText: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.forest, includeFontPadding: false, },

  depositNote: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    marginBottom: 20,
  },
  depositNoteTitle: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.navy,
    marginBottom: 4, includeFontPadding: false, },
  depositNoteText: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.navy,
    lineHeight: 20, includeFontPadding: false, },

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
    fontFamily: typography.handSemi,
    fontSize: 16,
    color: colors.textMuted, includeFontPadding: false, },
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
    fontFamily: typography.bodyBold,
    fontSize: 13,
    letterSpacing: 0.2,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },

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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },
  changeAddressLink: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    textDecorationLine: 'underline',
    letterSpacing: 0.2,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },
  addressPhoneText: {
    fontFamily: typography.bodyMedium,
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
    fontFamily: typography.handSemi,
    fontSize: 16,
    color: colors.charcoal,
    textAlign: 'center', includeFontPadding: false, },

  // Modal styles
  addressModalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
    letterSpacing: 0.2,
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
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.bodyMedium,
    fontSize: 11,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },

  // Intermediary Disclaimer Styles
  disclaimerCard: {
    backgroundColor: colors.paperLight,
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
  protectionsCard: {
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
  disclaimerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  disclaimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.emeraldDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  disclaimerBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.white, includeFontPadding: false, },
  disclaimerStatuteRef: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.textMuted, includeFontPadding: false, },
  protectionsTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  protectionsSubtitle: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 16,
  },
  pillarsGrid: {
    gap: 12,
  },
  pillarItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.overlayLight,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  pillarIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  pillarTitle: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal,
    marginBottom: 3, includeFontPadding: false, },
  pillarSummary: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  agreementAcceptanceCard: {
    backgroundColor: colors.white,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    gap: 14,
  },
  agreementCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  agreementCheckboxRowActive: {
    backgroundColor: colors.overlayLight,
    borderColor: colors.forest,
  },
  masterCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  masterCheckboxActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  agreementConsentTitle: {
    fontFamily: typography.handBold,
    fontSize: 17,
    color: colors.charcoal,
    marginBottom: 4, includeFontPadding: false, },
  agreementConsentDesc: {
    fontFamily: typography.body,
    fontSize: 11.5,
    color: colors.charcoal,
    lineHeight: 17,
  },
  legalLinksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  legalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  legalBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  legalBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
  bottomBarNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  bottomDisclaimerNotice: {
    flex: 1,
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 19, includeFontPadding: false, },
});
