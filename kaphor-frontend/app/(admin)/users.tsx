import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { adminService } from '../../src/services/adminService';
import { useAuth } from '../../src/context/AuthContext';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Chip, Empty } from '../../src/components/admin/AdminUI';
import { Loader } from '../../src/components/common/Loader';

export default function AdminUsersScreen() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ data: [], meta: { total: 0, pages: 1, page: 1 } });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listUsers({
        limit: 20,
        page,
        ...(q ? { q } : {}),
        ...(pendingOnly ? { verification: 'PENDING_REVIEW' } : {}),
      });
      setData(res);
    } catch {
      setData({ data: [], meta: { total: 0, pages: 1, page: 1 } });
    } finally {
      setLoading(false);
    }
  }, [q, page, pendingOnly]);

  useEffect(() => {
    setPage(1);
  }, [q, pendingOnly]);

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [load]);

  const meta = data?.meta ?? { total: 0, pages: 1, page: 1 };

  const toggleBlock = async (u: any) => {
    setBusyId(`b-${u.id}`);
    try {
      await adminService.updateUser(u.id, { isActive: !u.isActive });
      await load();
    } catch (e: any) {
      Alert.alert('Update Failed', e?.response?.data?.message || 'Could not update user.');
    } finally {
      setBusyId('');
    }
  };

  const cycleTier = async (u: any) => {
    const order = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'ELITE'];
    const next = order[(order.indexOf(u.tier) + 1) % order.length];
    setBusyId(`t-${u.id}`);
    try {
      await adminService.updateUser(u.id, { tier: next });
      await load();
    } catch (e: any) {
      Alert.alert('Update Failed', e?.response?.data?.message || 'Could not update tier.');
    } finally {
      setBusyId('');
    }
  };

  const removeUser = (u: any) => {
    Alert.alert('Delete Account', `Permanently delete ${u.displayName}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(`d-${u.id}`);
          try {
            await adminService.deleteUser(u.id);
            await load();
          } catch (e: any) {
            Alert.alert('Delete Failed', e?.response?.data?.message || 'Could not delete user.');
          } finally {
            setBusyId('');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AdminTopBar title="USERS" subtitle={`${meta.total} ACCOUNTS`} onRefresh={load} />
      <View style={styles.searchBar}>
        <SolarIcon name="search" size={16} color={colors.textMuted} />
        <TextInput accessibilityLabel="Name, email, username"
          style={styles.searchInput}
          placeholder="NAME, EMAIL, USERNAME…"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
        {q !== '' && (
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Remove" onPress={() => setQ('')}>
            <SolarIcon name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <TouchableOpacity onPress={() => setPendingOnly(false)} style={[styles.toggleChip, !pendingOnly && styles.toggleChipActive]}>
          <Text style={[styles.toggleText, !pendingOnly && styles.toggleTextActive]}>ALL</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPendingOnly(true)} style={[styles.toggleChip, pendingOnly && styles.toggleChipActive]}>
          <Text style={[styles.toggleText, pendingOnly && styles.toggleTextActive]}>PENDING KYC</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading && !data ? (
        <View style={styles.centered}>
          <Loader compact />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {data?.data?.length === 0 && <Empty text="No users found" />}
          {data?.data?.map((u: any) => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{u.displayName}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
                <View style={styles.badges}>
                  <Chip>{u.tier}</Chip>
                  <Chip color={u.isActive ? colors.emerald : colors.error} bg="transparent">
                    {u.isActive ? 'ACTIVE' : 'BLOCKED'}
                  </Chip>
                  {u.verificationStatus === 'PENDING_REVIEW' && (
                    <Chip color={colors.warning}>KYC PENDING</Chip>
                  )}
                  {u.verificationStatus === 'VERIFIED' && (
                    <Chip color={colors.emerald} bg="transparent">VERIFIED</Chip>
                  )}
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={u.isActive ? 'Block user' : 'Unblock user'}
                  style={[styles.iconBtn, { backgroundColor: u.isActive ? colors.error : colors.emerald }]}
                  onPress={() => toggleBlock(u)}
                  disabled={busyId === `b-${u.id}`}
                >
                  <SolarIcon name={u.isActive ? 'lock-closed' : 'lock-open'} size={14} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Refresh"
                  style={[styles.iconBtn, { backgroundColor: colors.charcoal }]}
                  onPress={() => cycleTier(u)}
                  disabled={busyId === `t-${u.id}`}
                >
                  <SolarIcon name="refresh" size={14} color={u.tier === 'ELITE' ? colors.gold : colors.white} />
                </TouchableOpacity>
                {me?.id !== u.id && (
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Delete"
                    style={[styles.iconBtn, { backgroundColor: colors.crimson }]}
                    onPress={() => removeUser(u)}
                    disabled={busyId === `d-${u.id}`}
                  >
                    <SolarIcon name="trash-outline" size={14} color={colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {meta.pages > 1 && (
            <View style={styles.pager}>
              <TouchableOpacity style={[styles.pagerBtn, page <= 1 && { opacity: 0.4 }]} disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
                <Text style={styles.pagerText}>PREV</Text>
              </TouchableOpacity>
              <Text style={styles.pagerInfo}>{meta.page} / {meta.pages}</Text>
              <TouchableOpacity style={[styles.pagerBtn, page >= meta.pages && { opacity: 0.4 }]} disabled={page >= meta.pages} onPress={() => setPage((p) => p + 1)}>
                <Text style={styles.pagerText}>NEXT</Text>
              </TouchableOpacity>
            </View>
          )}
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

  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  toggleChip: {
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

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  userCard: {
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
  userInfo: { flex: 1 },
  userName: { fontFamily: typography.bodyBold, fontSize: 14, color: colors.ink },
  userEmail: { fontFamily: typography.body, fontSize: 12, color: colors.textMuted, marginTop: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
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

  pager: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 12 },
  pagerBtn: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  pagerText: { fontFamily: typography.bodyBold, fontSize: 12, color: colors.ink },
  pagerInfo: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.textMuted },
});