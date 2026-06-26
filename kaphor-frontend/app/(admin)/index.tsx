import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { adminService } from '../../src/services/adminService';
import { colors, spacing, radius, typography } from '../../src/theme';

type AdminTab = 'INSIGHTS' | 'USERS' | 'LISTINGS' | 'ACTIVITY';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('INSIGHTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [monitor, setMonitor] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [bespoke, setBespoke] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, u, b, s, r, g] = await Promise.all([
        adminService.getMonitor(),
        adminService.listUsers({ limit: 50 }),
        adminService.listBespokeRequests({ limit: 10 }),
        adminService.listSwaps({ limit: 10 }),
        adminService.listRentals({ limit: 10 }),
        adminService.listGarments({ limit: 100 }),
      ]);
      setMonitor(m);
      setUsers(u);
      setBespoke(b);
      setSwaps(s);
      setRentals(r);
      setGarments(g);
    } catch (e: any) {
      Alert.alert('Admin Error', e?.response?.data?.message || 'Failed to sync platform data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const toggleUserStatus = async (targetUser: any) => {
    try {
      const newStatus = !targetUser.isActive;
      await adminService.updateUser(targetUser.id, { isActive: newStatus });
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, isActive: newStatus } : u));
    } catch (e: any) {
      Alert.alert('Update Failed', e?.response?.data?.message || 'Could not update user status.');
    }
  };

  const promoteUser = async (targetUser: any) => {
    try {
      const newTier = targetUser.tier === 'ELITE' ? 'GOLD' : 'ELITE';
      await adminService.updateUser(targetUser.id, { tier: newTier });
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, tier: newTier } : u));
    } catch (e: any) {
      Alert.alert('Update Failed', e?.response?.data?.message || 'Could not update user tier.');
    }
  };

  const deleteUser = (targetUser: any) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to permanently delete ${targetUser.displayName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await adminService.deleteUser(targetUser.id);
              setUsers(prev => prev.filter(u => u.id !== targetUser.id));
            } catch (e: any) {
              Alert.alert('Delete Failed', e?.response?.data?.message || 'Could not delete user.');
            }
          }
        }
      ]
    );
  };

  const deleteGarment = (targetGarment: any) => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to permanently remove ${targetGarment.title} from the marketplace?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await adminService.deleteGarment(targetGarment.id);
              setGarments(prev => prev.filter(g => g.id !== targetGarment.id));
            } catch (e: any) {
              Alert.alert('Delete Failed', e?.response?.data?.message || 'Could not delete garment.');
            }
          }
        }
      ]
    );
  };

  if (authLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.crimson} />
        <Text style={styles.loadingText}>SYNCING COMMAND CENTER...</Text>
      </View>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.centered}>
        <Ionicons name="shield-outline" size={64} color={colors.textMuted} />
        <Text style={styles.lockTitle}>ACCESS DENIED</Text>
        <Text style={styles.lockSub}>UNAUTHORIZED LOG DETECTED. RETURNING TO SAFETY.</Text>
        <TouchableOpacity style={styles.lockBtn} onPress={() => router.replace('/(tabs)/profile')}>
          <Text style={styles.lockBtnText}>EXIT PANEL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>COMMAND CENTER</Text>
          <Text style={styles.headerStatus}>PLATFORM PULSE: <Text style={{ color: colors.success }}>ACTIVE</Text></Text>
        </View>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.tabBar}>
        {(['INSIGHTS', 'USERS', 'LISTINGS', 'ACTIVITY'] as AdminTab[]).map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'INSIGHTS' && (
          <View>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiVal}>{monitor?.totalUsers ?? 0}</Text>
                <Text style={styles.kpiLab}>TOTAL USERS</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiVal}>{monitor?.totalGarments ?? 0}</Text>
                <Text style={styles.kpiLab}>ACTIVE ITEMS</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiVal}>${(monitor?.revenuePotential ?? 0).toLocaleString()}</Text>
                <Text style={styles.kpiLab}>REVENUE VOLUME</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiVal}>{monitor?.bespokePending ?? 0}</Text>
                <Text style={styles.kpiLab}>PENDING BESPOKE</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SYSTEM DIAGNOSTICS</Text>
            </View>
            <View style={styles.diagCard}>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>API Latency</Text>
                <Text style={styles.diagValue}>24ms</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>DB Connections</Text>
                <Text style={styles.diagValue}>Healthy</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'USERS' && (
          <View>
            {users.map((u, i) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.displayName}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.miniBadge, { backgroundColor: u.isActive ? colors.success + '20' : colors.error + '20' }]}>
                      <Text style={[styles.miniBadgeText, { color: u.isActive ? colors.success : colors.error }]}>
                        {u.isActive ? 'ACTIVE' : 'BLOCKED'}
                      </Text>
                    </View>
                    <View style={[styles.miniBadge, { backgroundColor: colors.crimson + '20' }]}>
                      <Text style={[styles.miniBadgeText, { color: colors.crimson }]}>
                        {u.tier}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: u.isActive ? colors.error : colors.success }]}
                    onPress={() => toggleUserStatus(u)}
                  >
                    <Ionicons name={u.isActive ? 'lock-closed' : 'lock-open'} size={14} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.charcoal }]}
                    onPress={() => promoteUser(u)}
                  >
                    <MaterialCommunityIcons name="crown" size={14} color={u.tier === 'ELITE' ? colors.gold : 'white'} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.crimson }]}
                    onPress={() => deleteUser(u)}
                  >
                    <Ionicons name="trash-outline" size={14} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'LISTINGS' && (
          <View>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="SEARCH ARCHIVE LISTINGS..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {garments
              .filter(g => 
                g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                g.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.listingType?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((g, i) => (
              <View key={g.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{g.title}</Text>
                  <Text style={styles.userEmail}>{g.brand || 'No Brand'} · {g.category?.toUpperCase() || 'NO CAT'}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.miniBadge, { backgroundColor: colors.crimson + '10' }]}>
                      <Text style={[styles.miniBadgeText, { color: colors.crimson }]}>
                        {g.listingType}
                      </Text>
                    </View>
                    <View style={[styles.miniBadge, { backgroundColor: colors.success + '10' }]}>
                      <Text style={[styles.miniBadgeText, { color: colors.success }]}>
                        ₹{(g.price / 100).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.charcoal }]}
                    onPress={() => router.push(`/(tabs)/shop/${g.id}` as any)}
                  >
                    <Ionicons name="eye-outline" size={14} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.crimson }]}
                    onPress={() => deleteGarment(g)}
                  >
                    <Ionicons name="trash-outline" size={14} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'ACTIVITY' && (
          <View>
             <Text style={styles.groupTitle}>BESPOKE REQUESTS</Text>
             {bespoke.map(b => (
               <View key={b.id} style={styles.activityItem}>
                 <Text style={styles.actTitle}>{b.user?.displayName}</Text>
                 <Text style={styles.actDesc} numberOfLines={2}>{b.description}</Text>
                 <Text style={styles.actStatus}>{b.status}</Text>
               </View>
             ))}

             <Text style={[styles.groupTitle, { marginTop: 20 }]}>ACTIVE SWAPS</Text>
             {swaps.map(s => (
               <View key={s.id} style={styles.activityItem}>
                 <Text style={styles.actTitle}>{s.initiator?.displayName} ↔ {s.receiver?.displayName}</Text>
                 <Text style={styles.actDesc}>{s.offeredGarment?.title} for {s.wantedGarment?.title}</Text>
                 <Text style={styles.actStatus}>{s.status}</Text>
               </View>
             ))}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <TouchableOpacity style={styles.exitBtn} onPress={() => router.replace('/(tabs)/profile')}>
        <Text style={styles.exitBtnText}>EXIT TO MARKETPLACE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 24 },
  loadingText: { marginTop: 16, fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 2 },
  
  header: { 
    paddingTop: 60, 
    paddingHorizontal: 24, 
    paddingBottom: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTitle: { fontFamily: typography.headings, fontSize: 24, color: colors.textPrimary, letterSpacing: 2 },
  headerStatus: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, marginTop: 4 },
  refreshBtn: { backgroundColor: colors.crimson, padding: 8, borderRadius: 8 },

  tabBar: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 12, gap: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.crimson, borderColor: colors.charcoal },
  tabText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.textMuted },
  tabTextActive: { color: colors.white },

  scrollContent: { padding: 24, paddingBottom: 100 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { width: '48%', backgroundColor: colors.bgCard, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  kpiVal: { fontFamily: typography.headings, fontSize: 32, color: colors.crimson },
  kpiLab: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, marginTop: 8, fontWeight: '900' },

  sectionHeader: { marginTop: 32, marginBottom: 12 },
  sectionTitle: { fontFamily: typography.mono, fontSize: 12, color: colors.crimson, fontWeight: '900' },
  diagCard: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  diagRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  diagLabel: { color: colors.textSecond, fontSize: 13 },
  diagValue: { color: colors.success, fontWeight: '800' },

  userCard: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  userInfo: { flex: 1 },
  userName: { color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  userEmail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  miniBadgeText: { fontSize: 8, fontWeight: '900' },
  userActions: { gap: 8, justifyContent: 'center' },
  actionBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  groupTitle: { fontFamily: typography.mono, fontSize: 10, color: colors.crimson, fontWeight: '900', marginBottom: 12 },
  activityItem: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  actTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 14 },
  actDesc: { color: colors.textSecond, fontSize: 12, marginTop: 4 },
  actStatus: { alignSelf: 'flex-start', color: colors.gold, fontSize: 9, fontWeight: '900', marginTop: 8, textTransform: 'uppercase' },

  exitBtn: { position: 'absolute', bottom: 30, left: 24, right: 24, backgroundColor: colors.charcoal, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  exitBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 12, fontWeight: '900', letterSpacing: 2 },

  lockTitle: { fontFamily: typography.headings, fontSize: 24, color: colors.error, marginTop: 20 },
  lockSub: { textAlign: 'center', color: colors.textMuted, marginTop: 8, lineHeight: 20, fontSize: 13 },
  lockBtn: { marginTop: 32, backgroundColor: colors.crimson, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  lockBtnText: { color: 'white', fontWeight: '900', letterSpacing: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
  },
});


