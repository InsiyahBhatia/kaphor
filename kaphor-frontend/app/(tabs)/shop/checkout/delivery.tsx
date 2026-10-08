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
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../../../src/components/common/SolarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../../../src/theme';
import { Header } from '../../../../src/components/common/Header';
import {
  addressService,
  Address,
  CreateAddressInput,
} from '../../../../src/services/addressService';
import api from '../../../../src/services/api';
import { Spinner, Loader } from '../../../../src/components/common/Loader';

type ScreenMode = 'select' | 'add' | 'edit';

const EMPTY_FORM: CreateAddressInput = {
  label: 'Home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
};

const LABEL_OPTIONS = ['Home', 'Work', 'Other'];

export default function DeliveryScreen() {
  const { orderId: paramOrderId, garmentId } = useLocalSearchParams<{ orderId?: string; garmentId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentOrderId, setCurrentOrderId] = useState<string | undefined>(paramOrderId);
  const [mode, setMode] = useState<ScreenMode>('select');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add / Edit form state
  const [form, setForm] = useState<CreateAddressInput>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await addressService.list();
      setAddresses(data || []);
      const activeAddr = addressService.getActiveDeliveryAddress();
      if (activeAddr && data.some((a) => a.id === activeAddr.id)) {
        setSelectedId(activeAddr.id);
      } else {
        const defaultAddr = data.find((a) => a.isDefault) || data[0];
        if (defaultAddr) {
          setSelectedId(defaultAddr.id);
          addressService.setActiveDeliveryAddress(defaultAddr);
        }
      }
    } catch (e) {
      console.error('Failed to load addresses', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  const validateField = (field: keyof CreateAddressInput, value: string): string => {
    const val = (value || '').trim();
    switch (field) {
      case 'fullName':
        if (!val) return 'Full recipient name is required';
        if (val.length < 2) return 'Name must be at least 2 characters';
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return 'Letters and spaces only';
        return '';
      case 'phone': {
        if (!val) return 'Mobile number is required';
        const digits = val.replace(/[\s-+]/g, '').replace(/^91/, '').replace(/^0/, '');
        if (digits.length !== 10) return 'Must be exactly 10 digits';
        if (!/^[6-9]\d{9}$/.test(digits)) return 'Must be a valid 10-digit Indian number (starts 6-9)';
        return '';
      }
      case 'line1':
        if (!val) return 'Street address is required';
        if (val.length < 5) return 'Complete address required (min 5 chars)';
        return '';
      case 'city':
        if (!val) return 'City is required';
        if (val.length < 2) return 'City must be at least 2 characters';
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return 'Letters only';
        return '';
      case 'state':
        if (!val) return 'State is required';
        if (val.length < 2) return 'State must be at least 2 characters';
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return 'Letters only';
        return '';
      case 'pincode': {
        if (!val) return 'PIN code is required';
        if (val.length !== 6) return 'Must be 6 digits';
        if (!/^[1-9][0-9]{5}$/.test(val)) return 'Enter valid 6-digit Indian PIN code';
        return '';
      }
      case 'label':
        if (!val) return 'Label is required';
        return '';
      default:
        return '';
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const reqs: (keyof CreateAddressInput)[] = ['fullName', 'phone', 'line1', 'city', 'state', 'pincode', 'label'];
    for (const f of reqs) {
      const err = validateField(f, String(form[f] || ''));
      if (err) errs[f] = err;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      Alert.alert('Incomplete Address', 'Please correct the highlighted fields before saving.');
    }
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let saved: Address;
      if (editId) {
        saved = await addressService.update(editId, form);
      } else {
        saved = await addressService.create(form);
      }
      setSelectedId(saved.id);
      addressService.setActiveDeliveryAddress(saved);
      setMode('select');
      setForm({ ...EMPTY_FORM });
      setEditId(null);
      setErrors({});
      await loadAddresses();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addr: Address) => {
    setForm({
      label: addr.label,
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || '',
      landmark: addr.landmark || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: addr.isDefault,
    });
    setEditId(addr.id);
    setMode('edit');
    setErrors({});
  };

  const handleDelete = async (id: string) => {
    try {
      await addressService.delete(id);
      if (selectedId === id) setSelectedId(null);
      await loadAddresses();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to delete address');
    }
  };

  const handleContinue = async () => {
    if (!selectedId) {
      Alert.alert('Selection Required', 'Please select or add a delivery address.');
      return;
    }
    setSaving(true);
    try {
let resolvedOrderId = currentOrderId || paramOrderId;
      if (!resolvedOrderId && garmentId) {
        // Direct buy-now: create order if not already initialized
        const { data } = await api.post('/orders', { garmentId });
        resolvedOrderId = data?.data?.orderId || data?.data?.id;
        if (resolvedOrderId) {
          setCurrentOrderId(resolvedOrderId);
        }
      }

      if (!resolvedOrderId) {
        Alert.alert('Order Session Error', 'Could not locate your order checkout session. Please restart checkout.');
        setSaving(false);
        return;
      }

      // Save shipping address to the order
      await addressService.setOrderShippingAddress(resolvedOrderId, selectedId);
      if (selectedAddr) {
        addressService.setActiveDeliveryAddress(selectedAddr);
      }
      setSaving(false);
      router.replace({
        pathname: '/(tabs)/shop/checkout/[orderId]',
        params: { orderId: resolvedOrderId },
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to set delivery address';
      Alert.alert('Error', msg);
      setSaving(false);
    }
  };

  const selectedAddr = addresses.find((a) => a.id === selectedId);

  // ── Add/Edit Form View ─────────────────────────────────────────
  if (mode === 'add' || mode === 'edit') {
    const title = mode === 'add' ? 'ADD ADDRESS' : 'EDIT ADDRESS';
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.cream }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Header title={title} showBack onBack={() => { setMode('select'); setErrors({}); setEditId(null); setForm({...EMPTY_FORM}); }} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Label selector */}
          <Text style={styles.label}>ADDRESS LABEL</Text>
          <View style={styles.labelRow}>
            {LABEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.labelChip, form.label === opt && styles.labelChipActive]}
                onPress={() => setForm({ ...form, label: opt })}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.labelChipText, form.label === opt && styles.labelChipTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>FULL NAME *</Text>
          <TextInput accessibilityLabel="Recipient name"
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Recipient name"
            placeholderTextColor={colors.textMuted}
            value={form.fullName}
            onChangeText={(t) => { setForm({ ...form, fullName: t }); setErrors({ ...errors, fullName: '' }); }}
          />
          {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

          <Text style={styles.label}>PHONE *</Text>
          <TextInput accessibilityLabel="+91 98765 43210"
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="+91 98765 43210"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => { setForm({ ...form, phone: t }); setErrors({ ...errors, phone: '' }); }}
          />
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          <Text style={styles.label}>STREET ADDRESS *</Text>
          <TextInput accessibilityLabel="House / Flat / Street"
            style={[styles.input, errors.line1 && styles.inputError]}
            placeholder="House / Flat / Street"
            placeholderTextColor={colors.textMuted}
            value={form.line1}
            onChangeText={(t) => { setForm({ ...form, line1: t }); setErrors({ ...errors, line1: '' }); }}
          />
          {errors.line1 ? <Text style={styles.errorText}>{errors.line1}</Text> : null}

          <Text style={styles.label}>STREET ADDRESS 2 (OPTIONAL)</Text>
          <TextInput accessibilityLabel="Apartment, suite, etc"
            style={styles.input}
            placeholder="Apartment, suite, etc."
            placeholderTextColor={colors.textMuted}
            value={form.line2 || ''}
            onChangeText={(t) => setForm({ ...form, line2: t })}
          />

          <Text style={styles.label}>LANDMARK (OPTIONAL)</Text>
          <TextInput accessibilityLabel="Nearby landmark"
            style={styles.input}
            placeholder="Nearby landmark"
            placeholderTextColor={colors.textMuted}
            value={form.landmark || ''}
            onChangeText={(t) => setForm({ ...form, landmark: t })}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.label}>CITY *</Text>
              <TextInput accessibilityLabel="City"
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="City"
                placeholderTextColor={colors.textMuted}
                value={form.city}
                onChangeText={(t) => { setForm({ ...form, city: t }); setErrors({ ...errors, city: '' }); }}
              />
              {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>PINCODE *</Text>
              <TextInput accessibilityLabel="600001"
                style={[styles.input, errors.pincode && styles.inputError]}
                placeholder="600001"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={6}
                value={form.pincode}
                onChangeText={(t) => { setForm({ ...form, pincode: t }); setErrors({ ...errors, pincode: '' }); }}
              />
              {errors.pincode ? <Text style={styles.errorText}>{errors.pincode}</Text> : null}
            </View>
          </View>

          <Text style={styles.label}>STATE *</Text>
          <TextInput accessibilityLabel="State"
            style={[styles.input, errors.state && styles.inputError]}
            placeholder="State"
            placeholderTextColor={colors.textMuted}
            value={form.state}
            onChangeText={(t) => { setForm({ ...form, state: t }); setErrors({ ...errors, state: '' }); }}
          />
          {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={[styles.formFooter, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <Spinner color={colors.cream} />
            ) : (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.primaryBtnText}>{mode === 'add' ? 'SAVE ADDRESS' : 'UPDATE ADDRESS'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Select Address View ────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title="DELIVERY" showBack fallbackPath="/(tabs)/shop" />

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepDone]}>
            <SolarIcon name="checkmark" size={14} color={colors.cream} />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>REQUEST</Text>
        </View>
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>DELIVERY</Text>
        </View>
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={styles.step}>
          <View style={styles.stepCircle}>
            <Text style={[styles.stepNumber, { color: colors.charcoal }]}>3</Text>
          </View>
          <Text style={styles.stepLabel}>PAY</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Loader variant="default" compact />
        ) : (
          <>
            <Text style={styles.sectionTitle}>SAVED ADDRESSES</Text>

            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addressCard, selectedId === addr.id && styles.addressCardSelected]}
                onPress={() => setSelectedId(addr.id)}
                activeOpacity={0.7}
              >
                <View style={styles.addressRadio}>
                  {selectedId === addr.id && <View style={styles.addressRadioInner} />}
                </View>
                <View style={styles.addressBody}>
                  <View style={styles.addressHeader}>
                    <View style={styles.addressLabelBadge}>
                      <Text style={styles.addressLabelText}>{addr.label}</Text>
                    </View>
                    {addr.isDefault && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.defaultBadge}>DEFAULT</Text>}
                  </View>
                  <Text style={styles.addressName}>{addr.fullName}</Text>
                  <Text style={styles.addressDetail} numberOfLines={2}>
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                  </Text>
                  <Text style={styles.addressDetail}>
                    {addr.city}, {addr.state} — {addr.pincode}
                  </Text>
                  <Text style={styles.addressPhone}>{addr.phone}</Text>
                </View>
                <View style={styles.addressActions}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => handleEdit(addr)} style={styles.actionBtn}>
                    <SolarIcon name="create-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => {
                    Alert.alert('Delete Address', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(addr.id) },
                    ]);
                  }} style={styles.actionBtn}>
                    <SolarIcon name="trash-outline" size={18} color={colors.red} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {addresses.length === 0 && (
              <View style={styles.emptyBox}>
                <SolarIcon name="location-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No saved addresses</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setErrors({}); setMode('add'); }}
            >
              <SolarIcon name="add-circle-outline" size={20} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.addBtnText}>ADD NEW ADDRESS</Text>
            </TouchableOpacity>

            {/* Selected Address Summary */}
            {selectedAddr && (
              <View style={styles.selectedSummary}>
                <Text style={styles.summaryTitle}>DELIVERING TO</Text>
                <Text style={styles.summaryName}>{selectedAddr.fullName}</Text>
                <Text style={styles.summaryDetail}>
                  {selectedAddr.line1}, {selectedAddr.city}, {selectedAddr.state} — {selectedAddr.pincode}
                </Text>
                <Text style={styles.summaryPhone}>{selectedAddr.phone}</Text>
              </View>
            )}

            <View style={styles.infoBox}>
              <SolarIcon name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={styles.infoText}>
                Delivery usually takes 3-5 business days after the seller confirms the order.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, Platform.OS === 'ios' ? 36 : 20) }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!selectedId || saving) && styles.primaryBtnDisabled]}
          onPress={handleContinue}
          disabled={!selectedId || saving}
        >
          {saving ? (
            <Spinner color={colors.cream} />
          ) : (
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.primaryBtnText}>CONTINUE TO PAYMENT →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 140 },
  formContent: { padding: 20, paddingBottom: 160 },
  formFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  // Progress Bar
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  step: { alignItems: 'center' },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: colors.borderLight,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.cream,
  },
  stepDone: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  stepActive: { backgroundColor: colors.red, borderColor: colors.red },
  stepNumber: { fontFamily: typography.mono, fontSize: 11, fontWeight: 'bold', color: colors.cream },
  stepLabel: { marginTop: 6, fontFamily: typography.handBold, fontSize: 13, color: colors.textMuted, includeFontPadding: false },
  stepLabelDone: { color: colors.charcoal },
  stepLabelActive: { color: colors.red },
  progressLine: { width: 40, height: 2, backgroundColor: colors.charcoal, marginHorizontal: 6, marginBottom: 18, opacity: 0.2 },
  progressLineDone: { opacity: 0.6 },

  sectionTitle: { fontFamily: typography.handBold, fontSize: 13, color: colors.textMuted, marginBottom: 14, includeFontPadding: false },

  // Address Card
  addressCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  addressCardSelected: {
    borderColor: colors.red,
    backgroundColor: colors.paperLight,
  },
  addressRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: colors.borderLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14, marginTop: 4,
  },
  addressRadioInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.red,
  },
  addressBody: { flex: 1 },
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  addressLabelBadge: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.charcoal },
  addressLabelText: { fontFamily: typography.handBold, fontSize: 13, color: colors.charcoal, includeFontPadding: false },
  defaultBadge: { fontFamily: typography.handBold, fontSize: 13, color: colors.forest, includeFontPadding: false },
  addressName: { fontFamily: typography.handBold, fontSize: 14, color: colors.charcoal, marginBottom: 4, includeFontPadding: false },
  addressDetail: { fontFamily: typography.handwritten, fontSize: 13, color: colors.textMuted, lineHeight: 21, marginBottom: 2, includeFontPadding: false },
  addressPhone: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  addressActions: { justifyContent: 'center', gap: 12, marginLeft: 8 },
  actionBtn: { padding: 6, borderWidth: 1, borderColor: colors.overlayLight, alignItems: 'center', justifyContent: 'center' },

  // Empty
  emptyBox: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { fontFamily: typography.handwritten, fontSize: 14, color: colors.textMuted, includeFontPadding: false },

  // Add Button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.charcoal, marginBottom: 24,
  },
  addBtnText: { fontFamily: typography.handBold, fontSize: 14, color: colors.charcoal, includeFontPadding: false },

  // Selected Summary
  selectedSummary: {
    backgroundColor: colors.white, padding: 16, borderWidth: 1,
    borderColor: colors.forest, marginBottom: 20,
    borderLeftWidth: 6,
  },
  summaryTitle: { fontFamily: typography.handBold, fontSize: 13, color: colors.forest, marginBottom: 6, includeFontPadding: false },
  summaryName: { fontFamily: typography.handBold, fontSize: 15, color: colors.charcoal, marginBottom: 4, includeFontPadding: false },
  summaryDetail: { fontFamily: typography.body, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  summaryPhone: { fontFamily: typography.mono, fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // Info Box
  infoBox: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.overlayLight, borderLeftWidth: 4, borderLeftColor: colors.textMuted },
  infoText: { flex: 1, fontFamily: typography.handwritten, fontSize: 13, color: colors.textMuted, lineHeight: 21, includeFontPadding: false },

  // Form
  label: { fontFamily: typography.handBold, fontSize: 13, color: colors.textMuted, marginBottom: 6, marginTop: 16, includeFontPadding: false },
  input: { borderWidth: 1, borderColor: colors.borderLight, padding: 14, fontFamily: typography.body, fontSize: 14, color: colors.charcoal, backgroundColor: colors.white },
  inputError: { borderColor: colors.red, borderWidth: 1 },
  errorText: { fontFamily: typography.handwritten, fontSize: 13, color: colors.red, marginTop: 4, includeFontPadding: false },
  row: { flexDirection: 'row' },
  labelRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  labelChip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.white },
  labelChipActive: { backgroundColor: colors.charcoal },
  labelChipText: { fontFamily: typography.handBold, fontSize: 13, color: colors.charcoal, includeFontPadding: false },
  labelChipTextActive: { color: colors.cream },

  // Loading
  loadingBox: { alignItems: 'center', padding: 60 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: colors.cream, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  primaryBtn: {
    backgroundColor: colors.charcoal, height: 56,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 15, includeFontPadding: false },
});
