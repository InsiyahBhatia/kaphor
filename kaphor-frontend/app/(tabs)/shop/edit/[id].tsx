import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../../src/services/garmentService';
import { colors, typography, spacing, radius } from '../../../../src/theme';
import { safeBack, useBackHandler } from '../../../../src/utils/navigation';
import {
  ALL_CATEGORY_ITEMS,
  ACCESSORY_CATEGORY_ITEMS,
  isAccessoryCategory,
  MARKET_CONDITIONS,
  LISTING_TYPES,
  MARKET_SIZES,
} from '../../../../src/constants/market';
import { DropdownPicker } from '../../../../src/components/DropdownPicker';

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useBackHandler('/(tabs)/profile');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('PRISTINE');
  const [listingType, setListingType] = useState('SALE');
  const [price, setPrice] = useState('');
  const [rentalDay, setRentalDay] = useState('');
  const [rentalWeek, setRentalWeek] = useState('');
  const [fabric, setFabric] = useState('');
  const [styleAttr, setStyleAttr] = useState('');
  const [color, setColor] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadGarment();
  }, [id]);

  const loadGarment = async () => {
    setLoading(true);
    try {
      const g = await garmentService.getGarmentById(id as string);
      if (g) {
        setTitle(g.title || '');
        setDescription(g.description || '');
        setBrand(g.brand || '');
        setCategory(g.category || '');
        setSize(g.size || '');
        setCondition(g.condition || 'PRISTINE');
        setListingType(g.listingType || 'SALE');
        setPrice(g.price != null ? String(Math.round(g.price)) : '');
        setRentalDay(g.rentalPriceDay != null ? String(Math.round(g.rentalPriceDay)) : '');
        setRentalWeek(g.rentalPriceWeek != null ? String(Math.round(g.rentalPriceWeek)) : '');
        setFabric(g.fabric || '');
        setStyleAttr(g.style || '');
        setColor(Array.isArray(g.color) ? g.color.join(', ') : g.color || '');
        setIsActive(g.isActive ?? true);
        setImages(g.images || []);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not load listing details.');
      safeBack('/(tabs)/profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please provide a garment title.');
      return;
    }
    if (listingType === 'SALE' && (!price || isNaN(Number(price)) || Number(price) <= 0)) {
      Alert.alert('Validation', 'Please specify a valid sale price.');
      return;
    }
    if (listingType === 'RENTAL' && (!rentalDay || isNaN(Number(rentalDay)) || Number(rentalDay) <= 0)) {
      Alert.alert('Validation', 'Please specify a valid daily rental price.');
      return;
    }
    if (listingType === 'ACCESSORY_SWAP' && !isAccessoryCategory(category)) {
      Alert.alert('Validation', 'Swapping on KaPhor is exclusively for accessories (bags, jewelry, watches, eyewear, belts, hats, scarves, wallets, ties, footwear).');
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        title: title.trim(),
        description: description.trim(),
        brand: brand.trim() || 'Archival',
        category: category || 'Apparel',
        size: size || 'M',
        condition,
        listingType,
        isActive,
      };

      if (listingType === 'SALE') {
        updates.price = Number(price);
      } else if (listingType === 'RENTAL') {
        updates.rentalPriceDay = Number(rentalDay);
        if (rentalWeek && !isNaN(Number(rentalWeek))) {
          updates.rentalPriceWeek = Number(rentalWeek);
        }
      } else if (listingType === 'ACCESSORY_SWAP') {
        updates.price = (price && !isNaN(Number(price)) && Number(price) > 0) ? Number(price) : 0;
      }

      if (fabric.trim()) updates.fabric = fabric.trim();
      if (styleAttr.trim()) updates.style = styleAttr.trim();
      if (color.trim()) {
        updates.color = color.split(',').map((c) => c.trim()).filter(Boolean);
      }

      await garmentService.updateGarment(id as string, updates);
      Alert.alert('Updated', 'Your listing has been updated.', [
        { text: 'OK', onPress: () => safeBack('/(tabs)/profile') },
      ]);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.response?.data?.message || 'Failed to update listing.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('De-List Asset', 'Are you sure you want to deactivate and remove this listing from the marketplace?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DE-LIST',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await garmentService.deleteGarment(id as string);
            Alert.alert('De-Listed', 'Your listing has been removed.', [
              { text: 'OK', onPress: () => safeBack('/my-listings') },
            ]);
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Could not delete listing.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadingText}>Loading listing data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/my-listings')} 
          style={styles.backBtn} 
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDIT LISTING</Text>
        <View style={[styles.statusPill, isActive ? styles.activePill : styles.inactivePill]}>
          <Text style={styles.statusPillText}>{isActive ? 'LIVE' : 'PAUSED'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Images Preview */}
          {images.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LISTING PHOTOS ({images.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScroll}>
                {images.map((uri, idx) => (
                  <View key={idx} style={styles.imageWrap}>
                    <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                    {idx === 0 && (
                      <View style={styles.coverTag}>
                        <Text style={styles.coverTagText}>COVER</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Listing Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TRANSACTION FORMAT</Text>
            <View style={styles.typeRow}>
              {LISTING_TYPES.map((t) => {
                const isSelected = listingType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                    onPress={() => {
                      setListingType(t.id);
                      if (t.id === 'ACCESSORY_SWAP' && !isAccessoryCategory(category)) {
                        setCategory('Bags');
                        setSize('FREE SIZE');
                      }
                    }}
                  >
                    <Text style={[styles.typeLabel, isSelected && styles.typeLabelSelected]}>
                      {t.label}
                    </Text>
                    <Text style={[styles.typeDesc, isSelected && styles.typeDescSelected]} numberOfLines={2}>
                      {t.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRICING</Text>
            {listingType === 'SALE' && (
              <View style={styles.inputWrap}>
                <Text style={styles.fieldLabel}>SALE PRICE (₹)</Text>
                <View style={styles.priceInputRow}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
              </View>
            )}

            {listingType === 'RENTAL' && (
              <View style={styles.rentalRow}>
                <View style={[styles.inputWrap, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={styles.fieldLabel}>PER DAY (₹)</Text>
                  <View style={styles.priceInputRow}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={rentalDay}
                      onChangeText={setRentalDay}
                    />
                  </View>
                </View>
                <View style={[styles.inputWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>PER WEEK (₹)</Text>
                  <View style={styles.priceInputRow}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      placeholder="Optional"
                      placeholderTextColor={colors.textMuted}
                      value={rentalWeek}
                      onChangeText={setRentalWeek}
                    />
                  </View>
                </View>
              </View>
            )}

            {listingType === 'ACCESSORY_SWAP' && (
              <View>
                <View style={styles.swapNotice}>
                  <Ionicons name="repeat" size={20} color={colors.gold} />
                  <Text style={styles.swapNoticeText}>
                    This accessory is available for direct peer-to-peer swaps in the Circular Hub.
                  </Text>
                </View>
                <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
                  <Text style={styles.fieldLabel}>ESTIMATED TRADE VALUE (₹) (OPTIONAL)</Text>
                  <View style={styles.priceInputRow}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      placeholder="Optional (1:1 trade)"
                      placeholderTextColor={colors.textMuted}
                      value={price}
                      onChangeText={setPrice}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Core Specifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ASSET SPECIFICATIONS</Text>

            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>TITLE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Sabyasachi Velvet Bandhgala"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>BRAND / ATELIER</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Raw Mango, Anita Dongre, Vintage"
                placeholderTextColor={colors.textMuted}
                value={brand}
                onChangeText={setBrand}
              />
            </View>

            <View style={styles.inputWrap}>
              <DropdownPicker
                label="CATEGORY"
                options={(listingType === 'ACCESSORY_SWAP' ? ACCESSORY_CATEGORY_ITEMS : ALL_CATEGORY_ITEMS).map((item) => ({ id: item, label: item }))}
                selectedValue={category}
                onSelect={setCategory}
                placeholder="Select Garment Category"
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>SIZE</Text>
              <View style={styles.sizeRow}>
                {MARKET_SIZES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sizePill, size === s && styles.sizePillActive]}
                    onPress={() => setSize(s)}
                  >
                    <Text style={[styles.sizeText, size === s && styles.sizeTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>CONDITION</Text>
              <View style={styles.conditionGrid}>
                {MARKET_CONDITIONS.map((c) => {
                  const isCondSelected = condition === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.conditionCard, isCondSelected && styles.conditionCardActive]}
                      onPress={() => setCondition(c.id)}
                    >
                      <Text style={[styles.conditionLabel, isCondSelected && styles.conditionLabelActive]}>
                        {c.label}
                      </Text>
                      <Text style={styles.conditionDesc}>{c.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>DESCRIPTION & PROVENANCE</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Share the story, weave, craftsmanship, or care instructions..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* Additional Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ARCHIVAL ATTRIBUTES</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>FABRIC / MATERIAL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Mulberry Silk, Pashmina, Chanderi"
                placeholderTextColor={colors.textMuted}
                value={fabric}
                onChangeText={setFabric}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>COLOR</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Crimson, Ivory, Emerald"
                placeholderTextColor={colors.textMuted}
                value={color}
                onChangeText={setColor}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>STYLE / SILHOUETTE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Traditional, Contemporary, Fusion"
                placeholderTextColor={colors.textMuted}
                value={styleAttr}
                onChangeText={setStyleAttr}
              />
            </View>
          </View>

          {/* Visibility Toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MARKETPLACE VISIBILITY</Text>
            <TouchableOpacity
              style={styles.toggleCard}
              onPress={() => setIsActive(!isActive)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>
                  {isActive ? 'Listing is Active & Discoverable' : 'Listing is Paused (Hidden)'}
                </Text>
                <Text style={styles.toggleSub}>
                  {isActive
                    ? 'Buyers can view, purchase, rent, or propose swaps for this asset.'
                    : 'Asset is temporarily hidden from the browse feed and search.'}
                </Text>
              </View>
              <Ionicons
                name={isActive ? 'toggle' : 'toggle-outline'}
                size={36}
                color={isActive ? colors.success : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <View style={[styles.section, styles.dangerSection]}>
            <Text style={styles.dangerTitle}>DANGER ZONE</Text>
            <Text style={styles.dangerSub}>
              Permanently de-list this piece from the Kaphor circular registry.
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.crimson} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={colors.crimson} />
                  <Text style={styles.deleteButtonText}>DE-LIST & REMOVE FROM MARKET</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.bg} />
                <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  activePill: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  inactivePill: {
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  statusPillText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  imageScroll: {
    gap: spacing.sm,
  },
  imageWrap: {
    position: 'relative',
    width: 90,
    height: 120,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  coverTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.crimson,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  coverTagText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  typeCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  typeLabel: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  typeLabelSelected: {
    color: colors.gold,
  },
  typeDesc: {
    fontFamily: typography.body,
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
  },
  typeDescSelected: {
    color: colors.textSecond,
  },
  inputWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textSecond,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontFamily: typography.mono,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.gold,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    height: 48,
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 18,
    fontWeight: 'bold',
  },
  rentalRow: {
    flexDirection: 'row',
  },
  swapNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  swapNoticeText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    lineHeight: 18,
  },
  textInput: {
    height: 46,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 14,
  },
  multilineInput: {
    height: 90,
    textAlignVertical: 'top',
    paddingVertical: spacing.sm,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sizePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 42,
    alignItems: 'center',
  },
  sizePillActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  sizeText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  sizeTextActive: {
    color: colors.bg,
  },
  conditionGrid: {
    gap: spacing.xs,
  },
  conditionCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  conditionCardActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  conditionLabel: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  conditionLabelActive: {
    color: colors.gold,
  },
  conditionDesc: {
    fontFamily: typography.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  toggleTitle: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  toggleSub: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  dangerSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(155, 27, 48, 0.25)',
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  dangerTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.crimson,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  dangerSub: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.crimson,
    backgroundColor: 'rgba(155, 27, 48, 0.06)',
  },
  deleteButtonText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.crimson,
    letterSpacing: 0.5,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  saveBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.bg,
    letterSpacing: 1,
  },
});
