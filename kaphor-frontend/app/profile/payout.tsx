import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../src/theme';
import paymentService from '../../src/services/paymentService';
import type { SellerPayoutAccount } from '../../src/types/payment';
import { DossierLoading } from '../../src/components/common/DossierLoading';
import { safeBack, useBackHandler } from '../../src/utils/navigation';

type ScreenMode = 'list' | 'add' | 'edit';
type PayoutMethod = 'BANK' | 'UPI';

interface PayoutForm {
  method: PayoutMethod;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
  bankName: string;
  upiId: string;
  isDefault: boolean;
}

const EMPTY_FORM: PayoutForm = {
  method: 'BANK',
  accountHolderName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifsc: '',
  bankName: '',
  upiId: '',
  isDefault: false,
};

export default function PayoutAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<ScreenMode>('list');
  const [showHistory, setShowHistory] = useState(false);

  const handleBack = () => {
    if (showHistory) {
      setShowHistory(false);
      return true;
    }
    if (mode !== 'list') {
      setMode('list');
      setErrors({});
      setEditId(null);
      setForm({ ...EMPTY_FORM });
      return true;
    }
    safeBack('/(tabs)/profile');
    return true;
  };

  useBackHandler('/(tabs)/profile', handleBack);

  const [accounts, setAccounts] = useState<SellerPayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);

  const [form, setForm] = useState<PayoutForm>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await paymentService.getPayoutAccounts();
      setAccounts(data);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await paymentService.getPayoutHistory();
      setPayoutHistory(data);
    } catch {
      setPayoutHistory([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  // ── Validation ────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.accountHolderName.trim()) {
      errs.accountHolderName = 'Required';
    } else if (form.accountHolderName.trim().length < 3) {
      errs.accountHolderName = 'Enter full name as per bank records';
    }

    if (form.method === 'BANK') {
      if (!form.accountNumber.trim()) {
        errs.accountNumber = 'Required';
      } else if (form.accountNumber.trim().length < 9 || form.accountNumber.trim().length > 18) {
        errs.accountNumber = 'Account number should be 9–18 digits';
      } else if (!/^\d+$/.test(form.accountNumber.trim())) {
        errs.accountNumber = 'Only digits allowed';
      }

      if (!form.confirmAccountNumber.trim()) {
        errs.confirmAccountNumber = 'Please re-enter account number';
      } else if (form.accountNumber.trim() !== form.confirmAccountNumber.trim()) {
        errs.confirmAccountNumber = 'Account numbers do not match';
      }

      if (!form.ifsc.trim()) {
        errs.ifsc = 'Required';
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase())) {
        errs.ifsc = 'Invalid IFSC (e.g., SBIN0001234)';
      }

      if (!form.bankName.trim()) {
        errs.bankName = 'Required';
      }
    } else {
      if (!form.upiId.trim()) {
        errs.upiId = 'Required';
      } else if (!/^[\w.\-_]{2,}@[\w.\-_]{2,}$/.test(form.upiId.trim())) {
        errs.upiId = 'Invalid UPI ID (e.g., name@upi)';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── CRUD Handlers ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = form.method === 'BANK'
        ? {
            accountHolderName: form.accountHolderName.trim(),
            accountNumber: form.accountNumber.trim(),
            ifsc: form.ifsc.trim().toUpperCase(),
            bankName: form.bankName.trim(),
            isDefault: form.isDefault,
          }
        : {
            accountHolderName: form.accountHolderName.trim(),
            upiId: form.upiId.trim(),
            isDefault: form.isDefault,
            accountNumber: 'UPI',
            ifsc: 'UPI',
            bankName: 'UPI',
          };

      if (editId) {
        // Update by delete + re-add (the API might not support update)
        await paymentService.removePayoutAccount(editId);
      }
      await paymentService.savePayoutAccount(payload);
      setMode('list');
      setForm({ ...EMPTY_FORM });
      setEditId(null);
      setErrors({});
      await loadAccounts();
      Alert.alert('Saved', 'Your payout account has been added.');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to save payout account';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (acct: SellerPayoutAccount) => {
    const isUpi = !!acct.upiId;
    // For security, clear account number fields on edit — user must re-enter
    setForm({
      method: isUpi ? 'UPI' : 'BANK',
      accountHolderName: acct.accountHolderName,
      accountNumber: '',
      confirmAccountNumber: '',
      ifsc: acct.ifsc === 'UPI' ? '' : acct.ifsc,
      bankName: acct.bankName === 'UPI' ? '' : acct.bankName,
      upiId: acct.upiId || '',
      isDefault: acct.isDefault,
    });
    setEditId(acct.id);
    setMode('edit');
    setErrors({});
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Remove Payout Account',
      'Are you sure you want to remove this account? You will not be able to receive payouts until you add a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentService.removePayoutAccount(id);
              await loadAccounts();
            } catch {
              Alert.alert('Error', 'Failed to remove account');
            }
          },
        },
      ],
    );
  };

  const maskAccount = (num: string): string => {
    if (num === 'UPI') return '';
    const last4 = num.slice(-4);
    return `••••••${last4}`;
  };

  // ── Add/Edit Form View ──────────────────────────────────────────
  if (mode === 'add' || mode === 'edit') {
    const title = mode === 'add' ? 'ADD PAYOUT ACCOUNT' : 'EDIT ACCOUNT';
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.cream }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.inlineHeader, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={() => { setMode('list'); setErrors({}); setEditId(null); setForm({...EMPTY_FORM}); }}>
            <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.inlineHeaderTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
        >
          {/* Account Holder Name */}
          <Text style={styles.formLabel}>ACCOUNT HOLDER NAME *</Text>
          <TextInput
            style={[styles.input, errors.accountHolderName && styles.inputError]}
            placeholder="Name as on bank account"
            placeholderTextColor={colors.textMuted}
            value={form.accountHolderName}
            onChangeText={(t) => { setForm({...form, accountHolderName: t}); setErrors({...errors, accountHolderName: ''}); }}
            autoCapitalize="words"
          />
          {errors.accountHolderName ? <Text style={styles.errorText}>{errors.accountHolderName}</Text> : null}

          {/* Method Toggle */}
          <Text style={styles.formLabel}>PAYOUT METHOD</Text>
          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[styles.methodChip, form.method === 'BANK' && styles.methodChipActive]}
              onPress={() => setForm({...form, method: 'BANK', upiId: '', accountNumber: '', confirmAccountNumber: '', ifsc: '', bankName: ''})}
            >
              <Ionicons name="business" size={16} color={form.method === 'BANK' ? colors.cream : colors.charcoal} />
              <Text style={[styles.methodChipText, form.method === 'BANK' && styles.methodChipTextActive]}>BANK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodChip, form.method === 'UPI' && styles.methodChipActive]}
              onPress={() => setForm({...form, method: 'UPI', accountNumber: '', confirmAccountNumber: '', ifsc: '', bankName: ''})}
            >
              <Ionicons name="phone-portrait" size={16} color={form.method === 'UPI' ? colors.cream : colors.charcoal} />
              <Text style={[styles.methodChipText, form.method === 'UPI' && styles.methodChipTextActive]}>UPI</Text>
            </TouchableOpacity>
          </View>

          {form.method === 'BANK' ? (
            <>
              {/* Edit-mode security note: ask to re-enter account number */}
              {editId && (
                <View style={styles.editSecurityNote}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.navy} />
                  <Text style={styles.editSecurityNoteText}>
                    For security, please re-enter your account number to confirm the update.
                  </Text>
                </View>
              )}
              {/* Bank Account Number */}
              <Text style={styles.formLabel}>ACCOUNT NUMBER *</Text>
              <TextInput
                style={[styles.input, errors.accountNumber && styles.inputError]}
                placeholder="9–18 digit account number"
                placeholderTextColor={colors.textMuted}
                value={form.accountNumber}
                onChangeText={(t) => { setForm({...form, accountNumber: t}); setErrors({...errors, accountNumber: ''}); }}
                keyboardType="numeric"
                maxLength={18}
              />
              {errors.accountNumber ? <Text style={styles.errorText}>{errors.accountNumber}</Text> : null}

              {/* Confirm Account Number */}
              <Text style={styles.formLabel}>CONFIRM ACCOUNT NUMBER *</Text>
              <TextInput
                style={[styles.input, errors.confirmAccountNumber && styles.inputError]}
                placeholder="Re-enter account number"
                placeholderTextColor={colors.textMuted}
                value={form.confirmAccountNumber}
                onChangeText={(t) => { setForm({...form, confirmAccountNumber: t}); setErrors({...errors, confirmAccountNumber: ''}); }}
                keyboardType="numeric"
                maxLength={18}
              />
              {errors.confirmAccountNumber ? <Text style={styles.errorText}>{errors.confirmAccountNumber}</Text> : null}

              {/* IFSC Code */}
              <Text style={styles.formLabel}>IFSC CODE *</Text>
              <TextInput
                style={[styles.input, errors.ifsc && styles.inputError]}
                placeholder="e.g., SBIN0001234"
                placeholderTextColor={colors.textMuted}
                value={form.ifsc}
                onChangeText={(t) => { setForm({...form, ifsc: t.toUpperCase()}); setErrors({...errors, ifsc: ''}); }}
                autoCapitalize="characters"
                maxLength={11}
              />
              {errors.ifsc ? <Text style={styles.errorText}>{errors.ifsc}</Text> : null}
              <Text style={styles.hintText}>
                First 4 letters = bank code, 5th = '0', last 6 = branch
              </Text>

              {/* Bank Name */}
              <Text style={styles.formLabel}>BANK NAME *</Text>
              <TextInput
                style={[styles.input, errors.bankName && styles.inputError]}
                placeholder="e.g., State Bank of India"
                placeholderTextColor={colors.textMuted}
                value={form.bankName}
                onChangeText={(t) => { setForm({...form, bankName: t}); setErrors({...errors, bankName: ''}); }}
              />
              {errors.bankName ? <Text style={styles.errorText}>{errors.bankName}</Text> : null}
            </>
          ) : (
            <>
              {/* UPI ID */}
              <Text style={styles.formLabel}>UPI ID *</Text>
              <TextInput
                style={[styles.input, errors.upiId && styles.inputError]}
                placeholder="e.g., name@upi"
                placeholderTextColor={colors.textMuted}
                value={form.upiId}
                onChangeText={(t) => { setForm({...form, upiId: t}); setErrors({...errors, upiId: ''}); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {errors.upiId ? <Text style={styles.errorText}>{errors.upiId}</Text> : null}
              <Text style={styles.hintText}>
                Supported: Google Pay (name@okhdfcbank), PhonePe (name@ybl), Paytm (name@paytm)
              </Text>
            </>
          )}

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={14} color={colors.forest} />
            <Text style={styles.securityNoteText}>
              Your account details are encrypted end-to-end. We never show full account numbers.
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Text style={styles.saveBtnText}>
                {mode === 'add' ? 'SAVE ACCOUNT' : 'UPDATE ACCOUNT'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── List View ──────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/profile')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PAYOUT ACCOUNTS</Text>
        <TouchableOpacity
          onPress={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setErrors({}); setMode('add'); }}
        >
          <Ionicons name="add" size={28} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <DossierLoading variant="cart" compact />
        </View>
      ) : accounts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>NO PAYOUT ACCOUNTS</Text>
          <Text style={styles.emptySub}>
            Add a bank account or UPI ID to receive payments when your items sell.
          </Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            onPress={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setErrors({}); setMode('add'); }}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.cream} />
            <Text style={styles.addFirstBtnText}>ADD ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={16} color={colors.navy} />
            <Text style={styles.infoBannerText}>
              Payouts are processed within 48 hours after the buyer confirms delivery. Commission is deducted before transfer.
            </Text>
          </View>

          {accounts.map((acct) => {
            const isUpi = !!acct.upiId;
            return (
              <View key={acct.id} style={[styles.card, acct.isDefault && styles.cardDefault]}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardMethodBadge}>
                    <Ionicons
                      name={isUpi ? 'phone-portrait' : 'business'}
                      size={12}
                      color={colors.cream}
                    />
                    <Text style={styles.cardMethodText}>{isUpi ? 'UPI' : 'BANK'}</Text>
                  </View>
                  {acct.isDefault ? (
                    <View style={styles.defaultBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.forest} />
                      <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Body */}
                <View style={styles.cardBody}>
                  <View style={styles.cardRow}>
                    <Ionicons name="person-outline" size={14} color={colors.charcoal} style={{ marginRight: 8 }} />
                    <Text style={styles.cardTitle}>{acct.accountHolderName}</Text>
                  </View>
                  {isUpi ? (
                    <View style={styles.cardRow}>
                      <Ionicons name="phone-portrait" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                      <Text style={styles.cardDetail}>{acct.upiId}</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.cardRow}>
                        <Ionicons name="card-outline" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                        <Text style={styles.cardDetail}>
                          {maskAccount(acct.accountNumber)}
                        </Text>
                      </View>
                      <View style={styles.cardRow}>
                        <Ionicons name="globe-outline" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                        <Text style={styles.cardDetail}>
                          {acct.bankName} • {acct.ifsc}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Card Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleEdit(acct)}>
                    <Ionicons name="create-outline" size={16} color={colors.charcoal} />
                    <Text style={styles.cardActionText}>EDIT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleDelete(acct.id)}>
                    <Ionicons name="trash-outline" size={16} color={colors.red} />
                    <Text style={[styles.cardActionText, { color: colors.red }]}>REMOVE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Add another */}
          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setErrors({}); setMode('add'); }}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.charcoal} />
            <Text style={styles.addMoreText}>ADD ANOTHER ACCOUNT</Text>
          </TouchableOpacity>

          {/* Payout History Toggle */}
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
          >
            <Ionicons name="time-outline" size={18} color={colors.charcoal} />
            <Text style={styles.historyToggleText}>
              {showHistory ? 'HIDE PAYOUT HISTORY' : 'VIEW PAYOUT HISTORY'}
            </Text>
            <Ionicons
              name={showHistory ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.charcoal}
            />
          </TouchableOpacity>

          {showHistory && (
            payoutHistory.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>No payouts yet</Text>
              </View>
            ) : (
              payoutHistory.map((p: any) => (
                <View key={p.id} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyAmount}>
                      {paymentService.formatAmount(p.netAmount || p.amount)}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={[styles.historyStatus, {
                    backgroundColor: p.status === 'PAID' ? colors.forest :
                      p.status === 'PROCESSING' ? colors.copper : colors.red,
                  }]}>
                    <Text style={styles.historyStatusText}>{p.status}</Text>
                  </View>
                </View>
              ))
            )
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Shared ──
  formLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 16,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.red, borderWidth: 2 },
  errorText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.red,
    marginTop: 4,
  },
  hintText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 14,
  },
  editSecurityNote: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(28,43,74,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(28,43,74,0.2)',
    marginBottom: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  editSecurityNoteText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.navy,
    lineHeight: 14,
  },
  securityNote: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(30,59,47,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(30,59,47,0.15)',
    marginTop: 24,
    alignItems: 'center',
  },
  securityNoteText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.forest,
    lineHeight: 14,
  },
  saveBtn: {
    backgroundColor: colors.charcoal,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginTop: 20,
    marginBottom: 40,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  methodChipActive: {
    backgroundColor: colors.charcoal,
  },
  methodChipText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
  },
  methodChipTextActive: {
    color: colors.cream,
  },

  // ── List Mode ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  headerTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: typography.headings,
    fontSize: 28,
    color: colors.charcoal,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.charcoal,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginTop: 16,
  },
  addFirstBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // ── Info Banner ──
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(28,43,74,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(28,43,74,0.12)',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoBannerText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.navy,
    lineHeight: 14,
  },

  // ── List Content ──
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    overflow: 'hidden',
  },
  cardDefault: {
    borderLeftWidth: 6,
    borderLeftColor: colors.forest,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
    backgroundColor: colors.cream,
  },
  cardMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardMethodText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  defaultBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  // Card Body
  cardBody: {
    padding: 16,
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
    color: colors.charcoal,
  },
  cardDetail: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 18,
    flex: 1,
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.1)',
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(30,31,34,0.1)',
  },
  cardActionText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },

  // Add More
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.charcoal,
    marginTop: 4,
  },
  addMoreText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },

  // Payout History
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.1)',
  },
  historyToggleText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  emptyHistory: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.charcoal,
    marginBottom: 8,
  },
  historyLeft: {
    gap: 4,
  },
  historyAmount: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
    color: colors.charcoal,
  },
  historyDate: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  historyStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyStatusText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },

  // ── Form Mode ──
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  inlineHeaderTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 160,
  },
});
