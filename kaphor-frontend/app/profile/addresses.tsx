import React, { useState, useCallback, useEffect } from 'react';
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
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../src/theme';
import {
  addressService,
  Address,
  CreateAddressInput,
} from '../../src/services/addressService';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { hapticFeedback } from '../../src/utils/haptics';
import { Spinner, Loader } from '../../src/components/common/Loader';

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
  const params = useLocalSearchParams<{ selectMode?: string; returnTo?: string }>();
  const isSelectMode = params.selectMode === 'true';

  // Modes
  const [mode, setMode] = useState<ScreenMode>('list');

  const handleBack = () => {
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

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    addressService.getActiveDeliveryAddress()?.id || null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<CreateAddressInput>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await addressService.list();
      setAddresses(data || []);

      // If no address is selected yet, sync with active or default
      const currentActive = addressService.getActiveDeliveryAddress();
      if (currentActive && data.some((a) => a.id === currentActive.id)) {
        setSelectedId(currentActive.id);
      } else if (data.length > 0) {
        const def = data.find((a) => a.isDefault) || data[0];
        setSelectedId(def.id);
        addressService.setActiveDeliveryAddress(def);
      }
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

  // ── Field-by-Field Validation Rules ───────────────────────────
  const validateField = (field: keyof CreateAddressInput, value: string): string => {
    const val = (value || '').trim();
    switch (field) {
      case 'fullName':
        if (!val) return 'Full recipient name is required';
        if (val.length < 2) return 'Full name must be at least 2 characters';
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return 'Name should contain letters and spaces only';
        return '';
      case 'phone': {
        if (!val) return 'Mobile number is required';
        const digitsOnly = val.replace(/[\s-+]/g, '').replace(/^91/, '').replace(/^0/, '');
        if (digitsOnly.length !== 10) return 'Mobile number must be exactly 10 digits';
        if (!/^[6-9]\d{9}$/.test(digitsOnly)) return 'Must be a valid Indian mobile number starting with 6, 7, 8, or 9';
        return '';
      }
      case 'line1':
        if (!val) return 'Street address / building number is required';
        if (val.length < 5) return 'Please enter complete street details (min 5 characters)';
        return '';
      case 'city':
        if (!val) return 'City is required';
        if (val.length < 2) return 'City must be at least 2 characters';
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return 'City name should contain letters only';
        return '';
      case 'state':
        if (!val) return 'State is required';
        if (val.length < 2) return 'State must be at least 2 characters';
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return 'State name should contain letters only';
        return '';
      case 'pincode': {
        if (!val) return '6-digit PIN code is required';
        if (val.length !== 6) return 'PIN code must be exactly 6 digits';
        if (!/^[1-9][0-9]{5}$/.test(val)) return 'Enter valid Indian PIN code (cannot start with 0)';
        return '';
      }
      case 'label':
        if (!val) return 'Address label is required';
        return '';
      default:
        return '';
    }
  };

  const validateAll = (): boolean => {
    const errs: Record<string, string> = {};
    const requiredFields: (keyof CreateAddressInput)[] = [
      'fullName',
      'phone',
      'line1',
      'city',
      'state',
      'pincode',
      'label',
    ];

    for (const f of requiredFields) {
      const err = validateField(f, String(form[f] || ''));
      if (err) errs[f] = err;
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      hapticFeedback.warning();
      Alert.alert(
        'Incomplete Address',
        'Please correct the highlighted fields before saving your address.'
      );
    }
    return Object.keys(errs).length === 0;
  };

  // ── Address Selection Handler ──────────────────────────────────
  const handleSelectAddress = (addr: Address) => {
    hapticFeedback.selection();
    setSelectedId(addr.id);
    addressService.setActiveDeliveryAddress(addr);

    if (isSelectMode) {
      hapticFeedback.success();
      router.back();
    }
  };

  // ── CRUD handlers ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!validateAll()) return;
    setSaving(true);
    try {
      let saved: Address;
      if (editId) {
        saved = await addressService.update(editId, form);
      } else {
        saved = await addressService.create(form);
      }

      // Automatically select newly saved address
      setSelectedId(saved.id);
      addressService.setActiveDeliveryAddress(saved);

      setMode('list');
      setForm({ ...EMPTY_FORM });
      setEditId(null);
      setErrors({});
      setTouched({});
      await loadAddresses();

      hapticFeedback.success();

      if (isSelectMode) {
        Alert.alert(
          'Address Selected',
          `"${saved.label}" is set as your delivery destination.`,
          [{ text: 'Continue', onPress: () => router.back() }]
        );
      }
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
    setTouched({});
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
            if (selectedId === id) {
              setSelectedId(null);
            }
            await loadAddresses();
          } catch {
            Alert.alert('Error', 'Failed to delete address');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (addr: Address) => {
    try {
      hapticFeedback.selection();
      const updated = await addressService.setDefault(addr.id);
      setSelectedId(updated.id);
      addressService.setActiveDeliveryAddress(updated);
      await loadAddresses();
    } catch {
      Alert.alert('Error', 'Failed to set default address');
    }
  };

  // ── Add/Edit Form View ──────────────────────────────────────────
  if (mode === 'add' || mode === 'edit') {
    const title = mode === 'add' ? 'ADD DELIVERY ADDRESS' : 'EDIT ADDRESS';
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.cream }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Inline header */}
        <View style={[styles.inlineHeader, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
            onPress={() => {
              setMode('list');
              setErrors({});
              setTouched({});
              setEditId(null);
              setForm({ ...EMPTY_FORM });
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.inlineHeaderTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Label selector */}
          <Text style={styles.formLabel}>ADDRESS LABEL *</Text>
          <View style={styles.labelRow}>
            {LABEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.labelChip, form.label === opt && styles.labelChipActive]}
                onPress={() => {
                  hapticFeedback.selection();
                  setForm({ ...form, label: opt });
                }}
              >
                <Ionicons
                  name={opt === 'Home' ? 'home' : opt === 'Work' ? 'briefcase' : 'location'}
                  size={12}
                  color={form.label === opt ? colors.cream : colors.charcoal}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.labelChipText, form.label === opt && styles.labelChipTextActive]}>
                  {opt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Full Name */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.formLabel}>FULL RECIPIENT NAME *</Text>
            <TextInput accessibilityLabel="Priya Sharma"
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="e.g. Priya Sharma"
              placeholderTextColor={colors.textMuted}
              value={form.fullName}
              maxLength={60}
              onChangeText={(t) => {
                setForm({ ...form, fullName: t });
                if (touched.fullName || errors.fullName) {
                  setErrors((prev) => ({ ...prev, fullName: validateField('fullName', t) }));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, fullName: true }));
                setErrors((prev) => ({ ...prev, fullName: validateField('fullName', form.fullName) }));
              }}
            />
            {Boolean(errors.fullName) && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={12} color={colors.red} />
                <Text style={styles.errorText}>{errors.fullName}</Text>
              </View>
            )}
          </View>

          {/* Phone Number */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.formLabel}>PHONE NUMBER (10 DIGITS) *</Text>
            <TextInput accessibilityLabel="9876543210"
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="e.g. 9876543210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={13}
              value={form.phone}
              onChangeText={(t) => {
                const sanitized = t.replace(/[^0-9+]/g, '');
                setForm({ ...form, phone: sanitized });
                if (touched.phone || errors.phone) {
                  setErrors((prev) => ({ ...prev, phone: validateField('phone', sanitized) }));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, phone: true }));
                setErrors((prev) => ({ ...prev, phone: validateField('phone', form.phone) }));
              }}
            />
            {Boolean(errors.phone) && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={12} color={colors.red} />
                <Text style={styles.errorText}>{errors.phone}</Text>
              </View>
            )}
          </View>

          {/* Street Address Line 1 */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.formLabel}>STREET ADDRESS (HOUSE / BUILDING / ROAD) *</Text>
            <TextInput accessibilityLabel="Flat/House No., Wing, Street name"
              style={[styles.input, errors.line1 && styles.inputError]}
              placeholder="Flat/House No., Wing, Street name"
              placeholderTextColor={colors.textMuted}
              value={form.line1}
              maxLength={120}
              onChangeText={(t) => {
                setForm({ ...form, line1: t });
                if (touched.line1 || errors.line1) {
                  setErrors((prev) => ({ ...prev, line1: validateField('line1', t) }));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, line1: true }));
                setErrors((prev) => ({ ...prev, line1: validateField('line1', form.line1) }));
              }}
            />
            {Boolean(errors.line1) && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={12} color={colors.red} />
                <Text style={styles.errorText}>{errors.line1}</Text>
              </View>
            )}
          </View>

          {/* Street Address Line 2 */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.formLabel}>APARTMENT / SUITE / AREA (OPTIONAL)</Text>
            <TextInput accessibilityLabel="Colony, sector, floor"
              style={styles.input}
              placeholder="Colony, sector, floor"
              placeholderTextColor={colors.textMuted}
              value={form.line2 || ''}
              maxLength={100}
              onChangeText={(t) => setForm({ ...form, line2: t })}
            />
          </View>

          {/* Landmark */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.formLabel}>LANDMARK (OPTIONAL)</Text>
            <TextInput accessibilityLabel="Near temple, metro station, park"
              style={styles.input}
              placeholder="Near temple, metro station, park..."
              placeholderTextColor={colors.textMuted}
              value={form.landmark || ''}
              maxLength={80}
              onChangeText={(t) => setForm({ ...form, landmark: t })}
            />
          </View>

          {/* City & PIN code row */}
          <View style={styles.halfRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.formLabel}>CITY *</Text>
              <TextInput accessibilityLabel="Mumbai"
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="e.g. Mumbai"
                placeholderTextColor={colors.textMuted}
                value={form.city}
                maxLength={50}
                onChangeText={(t) => {
                  setForm({ ...form, city: t });
                  if (touched.city || errors.city) {
                    setErrors((prev) => ({ ...prev, city: validateField('city', t) }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, city: true }));
                  setErrors((prev) => ({ ...prev, city: validateField('city', form.city) }));
                }}
              />
              {Boolean(errors.city) && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={12} color={colors.red} />
                  <Text style={styles.errorText}>{errors.city}</Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>PIN CODE (6 DIGITS) *</Text>
              <TextInput accessibilityLabel="400001"
                style={[styles.input, errors.pincode && styles.inputError]}
                placeholder="e.g. 400001"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={6}
                value={form.pincode}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^0-9]/g, '').slice(0, 6);
                  setForm({ ...form, pincode: cleaned });
                  if (touched.pincode || errors.pincode) {
                    setErrors((prev) => ({ ...prev, pincode: validateField('pincode', cleaned) }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, pincode: true }));
                  setErrors((prev) => ({ ...prev, pincode: validateField('pincode', form.pincode) }));
                }}
              />
              {Boolean(errors.pincode) && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={12} color={colors.red} />
                  <Text style={styles.errorText}>{errors.pincode}</Text>
                </View>
              )}
            </View>
          </View>

          {/* State */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.formLabel}>STATE *</Text>
            <TextInput accessibilityLabel="Maharashtra"
              style={[styles.input, errors.state && styles.inputError]}
              placeholder="e.g. Maharashtra"
              placeholderTextColor={colors.textMuted}
              value={form.state}
              maxLength={50}
              onChangeText={(t) => {
                setForm({ ...form, state: t });
                if (touched.state || errors.state) {
                  setErrors((prev) => ({ ...prev, state: validateField('state', t) }));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, state: true }));
                setErrors((prev) => ({ ...prev, state: validateField('state', form.state) }));
              }}
            />
            {Boolean(errors.state) && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={12} color={colors.red} />
                <Text style={styles.errorText}>{errors.state}</Text>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={[styles.formFooter, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Spinner color={colors.cream} />
            ) : (
              <Text style={styles.saveBtnText}>
                {mode === 'add' ? 'SAVE & USE ADDRESS' : 'UPDATE ADDRESS'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── List View ──────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
          onPress={() => safeBack('/(tabs)/profile')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ADDRESS BOOK</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add"
          onPress={() => {
            setForm({ ...EMPTY_FORM });
            setEditId(null);
            setErrors({});
            setTouched({});
            setMode('add');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={28} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      {/* Select Mode Top Banner */}
      {isSelectMode && (
        <View style={styles.selectModeBanner}>
          <Ionicons name="navigate-circle" size={16} color={colors.navy} />
          <Text style={styles.selectModeBannerText}>
            SELECT DELIVERY ADDRESS · Tap any address below to use it
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <Loader variant="cart" compact />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>NO ADDRESSES YET</Text>
          <Text style={styles.emptySub}>Add your delivery address.</Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            onPress={() => {
              setForm({ ...EMPTY_FORM });
              setEditId(null);
              setErrors({});
              setTouched({});
              setMode('add');
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.cream} />
            <Text style={styles.addFirstBtnText}>ADD DELIVERY ADDRESS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {addresses.map((addr) => {
            const isSelected = selectedId === addr.id;

            return (
              <TouchableOpacity
                key={addr.id}
                activeOpacity={0.9}
                style={[
                  styles.card,
                  addr.isDefault && styles.cardDefault,
                  isSelected && styles.cardSelected,
                ]}
                onPress={() => handleSelectAddress(addr)}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.cardLabelBadge}>
                      <Ionicons name="location" size={10} color={colors.cream} />
                      <Text style={styles.cardLabelText}>{addr.label.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {addr.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.forest} />
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => handleSetDefault(addr)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={styles.setDefaultText}>SET DEFAULT</Text>
                      </TouchableOpacity>
                    )}
                  </View>
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
                  {Boolean(addr.landmark) && (
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

                {/* Card Select Button CTA */}
                <TouchableOpacity
                  style={[styles.selectBtnCta, isSelected && styles.selectBtnCtaActive]}
                  onPress={() => handleSelectAddress(addr)}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
                    size={14}
                    color={isSelected ? colors.cream : colors.charcoal}
                  />
                  <Text style={[styles.selectBtnCtaText, isSelected && styles.selectBtnCtaTextActive]}>
                    {isSelected ? 'ACTIVE DELIVERY DESTINATION' : 'DELIVER TO THIS ADDRESS'}
                  </Text>
                </TouchableOpacity>

                {/* Card Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => handleEdit(addr)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="create-outline" size={15} color={colors.charcoal} />
                    <Text style={styles.cardActionText}>EDIT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => handleDelete(addr.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.red} />
                    <Text style={[styles.cardActionText, { color: colors.red }]}>DELETE</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Add button at bottom */}
          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={() => {
              setForm({ ...EMPTY_FORM });
              setEditId(null);
              setErrors({});
              setTouched({});
              setMode('add');
            }}
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
  fieldWrapper: {
    marginBottom: 12,
  },
  formLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.overlayLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.red,
    borderWidth: 2,
    backgroundColor: colors.white,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.red,
  },
  halfRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  labelChipActive: {
    backgroundColor: colors.charcoal,
  },
  labelChipText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
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
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: colors.cream,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 19,
  },

  // ── List Mode ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  headerTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 1.5,
  },
  selectModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.overlayLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectModeBannerText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.navy,
    flex: 1,
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
    fontSize: 24,
    color: colors.charcoal,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
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
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginTop: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addFirstBtnText: {
    color: colors.cream,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
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
  cardSelected: {
    borderColor: colors.crimson,
    borderWidth: 2.5,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
    backgroundColor: colors.cream,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  radioCircleActive: {
    borderColor: colors.crimson,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.crimson,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.cream,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  defaultBadgeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.forest,
  },
  setDefaultText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },

  // Card Body
  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardName: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 15,
    color: colors.charcoal,
  },
  cardDetail: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.overlayLight,
    marginVertical: 4,
  },

  selectBtnCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  selectBtnCtaActive: {
    backgroundColor: colors.charcoal,
  },
  selectBtnCtaText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  selectBtnCtaTextActive: {
    color: colors.cream,
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: colors.overlayLight,
    backgroundColor: colors.white,
  },
  cardActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },

  // ── Add More ──
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.charcoal,
    marginTop: 4,
    backgroundColor: colors.white,
  },
  addMoreText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
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
    fontSize: 16,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  formContent: {
    padding: 16,
    paddingBottom: 160,
  },
  formFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
  },
});
