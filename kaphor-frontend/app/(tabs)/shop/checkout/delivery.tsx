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
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../../../src/theme';
import { Header } from '../../../../src/components/common/Header';
import {
  addressService,
  Address,
  CreateAddressInput,
} from '../../../../src/services/addressService';

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
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();

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
      setAddresses(data);
      // Auto-select default or first address
      const defaultAddr = data.find((a) => a.isDefault) || data[0];
      if (defaultAddr) setSelectedId(defaultAddr.id);
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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.fullName.trim()) errs.fullName = 'Required';
    else if (form.fullName.trim().length < 2) errs.fullName = 'Too short';

    if (!form.phone.trim()) errs.phone = 'Required';
    else if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(form.phone.trim()))
      errs.phone = 'Invalid Indian mobile number';

    if (!form.line1.trim()) errs.line1 = 'Required';
    else if (form.line1.trim().length < 5) errs.line1 = 'Too short';

    if (!form.city.trim()) errs.city = 'Required';
    if (!form.state.trim()) errs.state = 'Required';

    if (!form.pincode.trim()) errs.pincode = 'Required';
    else if (!/^[1-9][0-9]{5}$/.test(form.pincode.trim()))
      errs.pincode = 'Invalid pincode (6 digits)';

    if (!form.label.trim()) errs.label = 'Required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) {
        await addressService.update(editId, form);
      } else {
        const addr = await addressService.create(form);
        setSelectedId(addr.id);
      }
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
    if (!selectedId || !orderId) {
      Alert.alert('Selection Required', 'Please select or add a delivery address.');
      return;
    }
    setSaving(true);
    try {
      // Save shipping address to the order
      await addressService.setOrderShippingAddress(orderId, selectedId);
      setSaving(false);
      router.replace({
        pathname: '/(tabs)/shop/checkout/[orderId]',
        params: { orderId },
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to set delivery address';
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
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {/* Label selector */}
          <Text style={styles.label}>ADDRESS LABEL</Text>
          <View style={styles.labelRow}>
            {LABEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.labelChip, form.label === opt && styles.labelChipActive]}
                onPress={() => setForm({ ...form, label: opt })}
              >
                <Text style={[styles.labelChipText, form.label === opt && styles.labelChipTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>FULL NAME *</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Recipient name"
            placeholderTextColor={colors.textMuted}
            value={form.fullName}
            onChangeText={(t) => { setForm({ ...form, fullName: t }); setErrors({ ...errors, fullName: '' }); }}
          />
          {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

          <Text style={styles.label}>PHONE *</Text>
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="+91 98765 43210"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => { setForm({ ...form, phone: t }); setErrors({ ...errors, phone: '' }); }}
          />
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          <Text style={styles.label}>STREET ADDRESS *</Text>
          <TextInput
            style={[styles.input, errors.line1 && styles.inputError]}
            placeholder="House / Flat / Street"
            placeholderTextColor={colors.textMuted}
            value={form.line1}
            onChangeText={(t) => { setForm({ ...form, line1: t }); setErrors({ ...errors, line1: '' }); }}
          />
          {errors.line1 ? <Text style={styles.errorText}>{errors.line1}</Text> : null}

          <Text style={styles.label}>STREET ADDRESS 2 (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Apartment, suite, etc."
            placeholderTextColor={colors.textMuted}
            value={form.line2 || ''}
            onChangeText={(t) => setForm({ ...form, line2: t })}
          />

          <Text style={styles.label}>LANDMARK (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Nearby landmark"
            placeholderTextColor={colors.textMuted}
            value={form.landmark || ''}
            onChangeText={(t) => setForm({ ...form, landmark: t })}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.label}>CITY *</Text>
              <TextInput
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
              <TextInput
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
          <TextInput
            style={[styles.input, errors.state && styles.inputError]}
            placeholder="State"
            placeholderTextColor={colors.textMuted}
            value={form.state}
            onChangeText={(t) => { setForm({ ...form, state: t }); setErrors({ ...errors, state: '' }); }}
          />
          {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Text style={styles.primaryBtnText}>{mode === 'add' ? 'SAVE ADDRESS' : 'UPDATE ADDRESS'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Select Address View ────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.cream }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="DELIVERY" showBack />

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepDone]}>
            <Ionicons name="checkmark" size={14} color={colors.cream} />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>CART</Text>
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
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.charcoal} />
          </View>
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
                    {addr.isDefault && <Text style={styles.defaultBadge}>DEFAULT</Text>}
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
                  <TouchableOpacity onPress={() => handleEdit(addr)} style={styles.actionBtn}>
                    <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    Alert.alert('Delete Address', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(addr.id) },
                    ]);
                  }} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.red} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {addresses.length === 0 && (
              <View style={styles.emptyBox}>
                <Ionicons name="location-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No saved addresses</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setErrors({}); setMode('add'); }}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.charcoal} />
              <Text style={styles.addBtnText}>ADD NEW ADDRESS</Text>
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
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={styles.infoText}>
                Delivery usually takes 3-5 business days after the seller confirms the order.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!selectedId || saving) && styles.primaryBtnDisabled]}
          onPress={handleContinue}
          disabled={!selectedId || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <Text style={styles.primaryBtnText}>CONTINUE TO PAYMENT →</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 140 },
  formContent: { padding: 20, paddingBottom: 140 },

  // Progress Bar
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  step: { alignItems: 'center' },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.charcoal,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.cream,
  },
  stepDone: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  stepActive: { backgroundColor: colors.red, borderColor: colors.red },
  stepNumber: { fontFamily: typography.mono, fontSize: 11, fontWeight: 'bold', color: colors.cream },
  stepLabel: { marginTop: 6, fontFamily: typography.mono, fontSize: 8, fontWeight: '800', color: colors.textMuted, letterSpacing: 1 },
  stepLabelDone: { color: colors.charcoal },
  stepLabelActive: { color: colors.red },
  progressLine: { width: 40, height: 2, backgroundColor: colors.charcoal, marginHorizontal: 6, marginBottom: 18, opacity: 0.2 },
  progressLineDone: { opacity: 0.6 },

  sectionTitle: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 14 },

  // Address Card
  addressCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 12,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addressCardSelected: {
    borderColor: colors.red,
    backgroundColor: '#FFF8F8',
  },
  addressRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.charcoal,
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
  addressLabelText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.charcoal },
  defaultBadge: { fontFamily: typography.mono, fontSize: 8, fontWeight: '900', color: colors.forest, letterSpacing: 0.5 },
  addressName: { fontFamily: typography.mono, fontSize: 14, fontWeight: '800', color: colors.charcoal, marginBottom: 4 },
  addressDetail: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 2 },
  addressPhone: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  addressActions: { justifyContent: 'center', gap: 12, marginLeft: 8 },
  actionBtn: { padding: 6, borderWidth: 1, borderColor: 'rgba(30,31,34,0.15)', alignItems: 'center', justifyContent: 'center' },

  // Empty
  emptyBox: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { fontFamily: typography.mono, fontSize: 14, color: colors.textMuted },

  // Add Button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.charcoal, marginBottom: 24,
  },
  addBtnText: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800', color: colors.charcoal },

  // Selected Summary
  selectedSummary: {
    backgroundColor: colors.white, padding: 16, borderWidth: 2,
    borderColor: colors.forest, marginBottom: 20,
    borderLeftWidth: 6,
  },
  summaryTitle: { fontFamily: typography.mono, fontSize: 8, fontWeight: '900', color: colors.forest, letterSpacing: 1, marginBottom: 6 },
  summaryName: { fontFamily: typography.mono, fontSize: 15, fontWeight: '800', color: colors.charcoal, marginBottom: 4 },
  summaryDetail: { fontFamily: typography.body, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  summaryPhone: { fontFamily: typography.mono, fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // Info Box
  infoBox: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: 'rgba(30,31,34,0.04)', borderLeftWidth: 4, borderLeftColor: colors.textMuted },
  infoText: { flex: 1, fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, lineHeight: 16 },

  // Form
  label: { fontFamily: typography.mono, fontSize: 9, fontWeight: '900', color: colors.textMuted, marginBottom: 6, marginTop: 16, letterSpacing: 1 },
  input: { borderWidth: 1.5, borderColor: colors.charcoal, padding: 14, fontFamily: typography.body, fontSize: 14, color: colors.charcoal, backgroundColor: colors.white },
  inputError: { borderColor: colors.red, borderWidth: 2 },
  errorText: { fontFamily: typography.mono, fontSize: 9, color: colors.red, marginTop: 4 },
  row: { flexDirection: 'row' },
  labelRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  labelChip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, borderColor: colors.charcoal, backgroundColor: colors.white },
  labelChipActive: { backgroundColor: colors.charcoal },
  labelChipText: { fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.charcoal },
  labelChipTextActive: { color: colors.cream },

  // Loading
  loadingBox: { alignItems: 'center', padding: 60 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: colors.cream, borderTopWidth: 2, borderTopColor: colors.charcoal,
  },
  primaryBtn: {
    backgroundColor: colors.charcoal, height: 56,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});
