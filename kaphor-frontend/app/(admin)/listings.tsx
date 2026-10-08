import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { adminService } from '../../src/services/adminService';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Chip, Empty, formatINR } from '../../src/components/admin/AdminUI';
import { Loader } from '../../src/components/common/Loader';
import { KaphorImage } from '../../src/components/KaphorImage';

const LIFECYCLES = [
  'ALL', 'LISTED', 'PURCHASE_INTENT', 'INTEREST', 'SELL_INTENT',
  'RESERVED_SALE', 'CIRCULATION', 'REUSE_UPCYCLE_RECYCLE', 'DECLINE', 'OWNERSHIP',
];

export default function AdminListingsScreen() {
  const [q, setQ] = useState('');
  const [lifecycle, setLifecycle] = useState('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [data, setData] = useState<any>({ data: [], meta: { total: 0 } });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listGarments({
        limit: 100,
        ...(q ? { q } : {}),
        ...(lifecycle !== 'ALL' ? { lifecycle } : {}),
        ...(showInactive ? { active: false } : {}),
      });
      setData(res);
    } catch {
      setData({ data: [], meta: { total: 0 } });
    } finally {
      setLoading(false);
    }
  }, [q, lifecycle, showInactive]);

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [load]);

  const togglePause = async (g: any) => {
    setBusyId(`p-${g.id}`);
    try {
      await adminService.pauseGarment(g.id);
      await load();
    } catch (e: any) {
      Alert.alert('Update Failed', e?.response?.data?.message || 'Could not update listing.');
    } finally {
      setBusyId('');
    }
  };

  const removeGarment = (g: any) => {
    Alert.alert('Delete Listing', `Permanently remove "${g.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(`d-${g.id}`);
          try {
            await adminService.deleteGarment(g.id);
            await load();
          } catch (e: any) {
            Alert.alert('Delete Failed', e?.response?.data?.message || 'Could not delete listing.');
          } finally {
            setBusyId('');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AdminTopBar title="LISTINGS" subtitle={`${data?.meta?.total ?? 0} GARMENTS`} onRefresh={load} />
      <View style={styles.searchBar}>
        <SolarIcon name="search" size={16} color={colors.textMuted} />
        <TextInput accessibilityLabel="Title, brand, category"
          style={styles.searchInput}
          placeholder="TITLE, BRAND, CATEGORY…"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
        />
        {q !== '' && (
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Remove" onPress={() => setQ('')}>
            <SolarIcon name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.toggRow}>
        <TouchableOpacity onPress={() => setShowInactive((v) => !v)} style={[styles.toggleChip, showInactive && styles.toggleChipActive]}>
          <Text style={[styles.toggleText, showInactive && styles.toggleTextActive]}>SHOW INACTIVE</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {LIFECYCLES.map((s) => (
          <TouchableOpacity key={s} onPress={() => setLifecycle(s)} style={[styles.statusChip, lifecycle === s && styles.statusChipActive]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statusChipText, lifecycle === s && styles.statusChipTextActive]}>{s.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !data ? (
        <View style={styles.centered}>
          <Loader compact />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {data?.data?.length === 0 && <Empty text="No listings match" />}
          {data?.data?.map((g: any) => (
            <View key={g.id} style={styles.card}>
              <View style={styles.thumbWrap}>
                <KaphorImage
                  uri={g.thumbnailUrl || g.images?.[0]}
                  category={g.category}
                  brand={g.brand}
                  style={styles.thumb}
                  contentFit="cover"
                />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={2}>{g.title}</Text>
                <Text style={styles.cardMeta}>
                  {(g.brand || 'NO BRAND').toUpperCase()} · {g.category?.toUpperCase() ?? 'NO CAT'}
                </Text>
                <View style={styles.badges}>
                  <Chip>{g.listingType}</Chip>
                  <Chip color={g.isActive ? colors.emerald : colors.textMuted} bg="transparent">
                    {g.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Chip>
                  <Chip color={colors.textMuted} bg="transparent">{(g.lifecycleState || 'LISTED').replace(/_/g, ' ')}</Chip>
                  <Chip bg={colors.bgMuted}>{formatINR(g.price)}</Chip>
                </View>
                <Text style={styles.seller}>BY {g.seller?.displayName?.toUpperCase() ?? '—'}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={g.isActive ? 'Pause listing' : 'Activate listing'} style={[styles.iconBtn, { backgroundColor: colors.charcoal }]} onPress={() => togglePause(g)} disabled={busyId === `p-${g.id}`}>
                  <SolarIcon name={g.isActive ? 'pause' : 'play'} size={14} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Delete" style={[styles.iconBtn, { backgroundColor: colors.crimson }]} onPress={() => removeGarment(g)} disabled={busyId === `d-${g.id}`}>
                  <SolarIcon name="trash-outline" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    backgroundColor: colors.white,
    gap: 8,
  },
  searchInput: { flex: 1, fontFamily: typography.body, fontSize: 13, color: colors.textPrimary },

  toggRow: { paddingHorizontal: 16, paddingTop: 10 },
  toggleChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  toggleChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.ink },
  toggleTextActive: { color: colors.cream, fontFamily: typography.bodyBold },

  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    backgroundColor: colors.white,
    marginRight: 8,
  },
  statusChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  statusChipText: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.ink },
  statusChipTextActive: { color: colors.cream, fontFamily: typography.bodyBold },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 15,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  thumbWrap: {
    width: 76,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  thumb: { width: '100%', height: '100%' },
  cardInfo: { flex: 1 },
  cardTitle: { fontFamily: typography.bodyBold, fontSize: 14, color: colors.ink },
  cardMeta: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  seller: { fontFamily: typography.bodyMedium, fontSize: 11, color: colors.textMuted, marginTop: 8 },
  actions: { justifyContent: 'center', gap: 8, paddingLeft: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});