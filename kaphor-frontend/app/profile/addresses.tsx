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
import {
  addressService,
  Address,
  CreateAddressInput,
} from '../../src/services/addressService';
import { DossierLoading } from '../../src/components/common/DossierLoading';

type ScreenMode = 'list' | 'add' | 'edit';

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

export default function AddressBookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Modes
  const [mode, setMode] = useState<ScreenMode>('list');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<CreateAddressInput>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await addressService.list();
      setAddresses(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  // ── Validation ────────────────────────────────────────────────
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

  // ── CRUD handlers ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) {
        await addressService.update(editId, form);
      } else {
        await addressService.create(form);
      }
      setMode('list');
      setForm({ ...EMPTY_FORM });
      setEditId(null);
      setErrors({});
      await loadAddresses();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to save address';
      Alert.alert('Error', msg);
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

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await addressService.delete(id);
            await loadAddresses();
          } catch {
            Alert.alert('Error', 'Failed to delete address');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressService.setDefault(id);
      await loadAddresses();
    } catch {
      Alert.alert('Error', 'Failed to set default address');
    }
  };

  // ── Add/Edit Form View ──────────────────────────────────────────
  if (mode === 'add' || mode === 'edit') {
    const title = mode === 'add' ? 'ADD ADDRESS' : 'EDIT ADDRESS';
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.cream }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Inline header */}
        <View style={[styles.inlineHeader, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={() => { setMode('list'); setErrors({}); setEditId(null); setForm({...EMPTY_FORM}); }}>
            <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.inlineHeaderTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {/* Label selector */}
          <Text style={styles.formLabel}>ADDRESS LABEL</Text>
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

          <Text style={styles.formLabel}>FULL NAME *</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Recipient name"
            placeholderTextColor={colors.textMuted}
            value={form.fullName}
            onChangeText={(t) => { setForm({ ...form, fullName: t }); setErrors({ ...errors, fullName: '' }); }}
          />
          {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

          <Text style={styles.formLabel}>PHONE *</Text>
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="+91 98765 43210"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => { setForm({ ...form, phone: t }); setErrors({ ...errors, phone: '' }); }}
          />
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          <Text style={styles.formLabel}>STREET ADDRESS *</Text>
          <TextInput
            style={[styles.input, errors.line1 && styles.inputError]}
            placeholder="House / Flat / Street"
            placeholderTextColor={colors.textMuted}
            value={form.line1}
            onChangeText={(t) => { setForm({ ...form, line1: t }); setErrors({ ...errors, line1: '' }); }}
          />
          {errors.line1 ? <Text style={styles.errorText}>{errors.line1}</Text> : null}

          <Text style={styles.formLabel}>STREET ADDRESS 2 (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Apartment, suite, etc."
            placeholderTextColor={colors.textMuted}
            value={form.line2 || ''}
            onChangeText={(t) => setForm({ ...form, line2: t })}
          />

          <Text style={styles.formLabel}>LANDMARK (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Nearby landmark"
            placeholderTextColor={colors.textMuted}
            value={form.landmark || ''}
            onChangeText={(t) => setForm({ ...form, landmark: t })}
          />

          <View style={styles.halfRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.formLabel}>CITY *</Text>
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
              <Text style={styles.formLabel}>PINCODE *</Text>
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

          <Text style={styles.formLabel}>STATE *</Text>
          <TextInput
            style={[styles.input, errors.state && styles.inputError]}
            placeholder="State"
            placeholderTextColor={colors.textMuted}
            value={form.state}
            onChangeText={(t) => { setForm({ ...form, state: t }); setErrors({ ...errors, state: '' }); }}
          />
          {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Text style={styles.saveBtnText}>
                {mode === 'add' ? 'SAVE ADDRESS' : 'UPDATE ADDRESS'}
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ADDRESS BOOK</Text>
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
      ) : addresses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>NO ADDRESSES YET</Text>
          <Text style={styles.emptySub}>Add a delivery address to get started.</Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            onPress={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setErrors({}); setMode('add'); }}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.cream} />
            <Text style={styles.addFirstBtnText}>ADD ADDRESS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {addresses.map((addr) => (
            <View key={addr.id} style={[styles.card, addr.isDefault && styles.cardDefault]}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardLabelBadge}>
                  <Ionicons name="location" size={10} color={colors.cream} />
                  <Text style={styles.cardLabelText}>{addr.label}</Text>
                </View>
                {addr.isDefault ? (
                  <View style={styles.defaultBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.forest} />
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => handleSetDefault(addr.id)}>
                    <Text style={styles.setDefaultText}>SET DEFAULT</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Card Body */}
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Ionicons name="person-outline" size={14} color={colors.charcoal} style={{ marginRight: 8 }} />
                  <Text style={styles.cardName}>{addr.fullName}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="call-outline" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={styles.cardDetail}>{addr.phone}</Text>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardRow}>
                  <Ionicons name="home-outline" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={styles.cardDetail} numberOfLines={2}>
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                  </Text>
                </View>
                {addr.landmark && (
                  <View style={styles.cardRow}>
                    <Ionicons name="compass-outline" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                    <Text style={styles.cardDetail}>Near {addr.landmark}</Text>
                  </View>
                )}
                <View style={styles.cardRow}>
                  <Ionicons name="map-outline" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={styles.cardDetail}>
                    {addr.city}, {addr.state} — {addr.pincode}
                  </Text>
                </View>
              </View>

              {/* Card Actions */}
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleEdit(addr)}>
                  <Ionicons name="create-outline" size={16} color={colors.charcoal} />
                  <Text style={styles.cardActionText}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleDelete(addr.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.red} />
                  <Text style={[styles.cardActionText, { color: colors.red }]}>DELETE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Add button at bottom */}
          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setErrors({}); setMode('add'); }}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.charcoal} />
            <Text style={styles.addMoreText}>ADD ANOTHER ADDRESS</Text>
          </TouchableOpacity>
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
  inputError: {
    borderColor: colors.red,
    borderWidth: 2,
  },
  errorText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.red,
    marginTop: 4,
  },
  halfRow: {
    flexDirection: 'row',
  },
  labelRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  labelChipActive: {
    backgroundColor: colors.charcoal,
  },
  labelChipText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.charcoal,
  },
  labelChipTextActive: {
    color: colors.cream,
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
    marginTop: 32,
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
    fontSize: 20,
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

  // Card Header
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
  cardLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardLabelText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
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
  setDefaultText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
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
  cardName: {
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
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(30,31,34,0.1)',
    marginVertical: 4,
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

  // ── Add More ──
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
    paddingBottom: 60,
  },
});
