import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { adminService } from '../../src/services/adminService';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Bars, Sparkline } from '../../src/components/admin/Bars';
import { Card, SectionLabel, formatINR, Chip, Empty } from '../../src/components/admin/AdminUI';

type Range = '7d' | '30d' | '90d';

interface TodoItem {
  key: string;
  label: string;
  count: number;
  route: string;
  accent?: string;
}

export default function AdminOverviewScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [range, setRange] = useState<Range>('30d');
  const [analytics, setAnalytics] = useState<any>(null);
  const [monitor, setMonitor] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a, h] = await Promise.all([
        adminService.getMonitor(),
        adminService.getAnalytics(range),
        adminService.getHealth(),
      ]);
      setMonitor(m);
      setAnalytics(a);
      setHealth(h);
    } catch (e: any) {
      // keep partial state; overview should not hard-fail the whole console
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  if (authLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>SYNCING PLATFORM DATA…</Text>
      </View>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.centered}>
        <Ionicons name="shield-outline" size={64} color={colors.textMuted} />
        <Text style={styles.lockTitle}>ACCESS DENIED</Text>
        <Text style={styles.lockSub}>ADMIN ROLE REQUIRED FOR THIS PANEL.</Text>
        <TouchableOpacity style={styles.lockBtn} onPress={() => router.replace('/(tabs)/profile')}>
          <Text style={styles.lockBtnText}>EXIT PANEL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const buckets = analytics?.buckets ?? [];
  const totals = analytics?.totals ?? {};

  const todoItems: TodoItem[] = [
    { key: 'orders', label: 'Orders', count: monitor?.ordersPending ?? 0, route: '/(admin)/orders' },
    { key: 'bespoke', label: 'Bespoke', count: monitor?.bespokePending ?? 0, route: '/(admin)/queues' },
    { key: 'upcycle', label: 'Upcycle', count: monitor?.upcyclePending ?? 0, route: '/(admin)/queues' },
    { key: 'reports', label: 'Reports', count: monitor?.reportsPending ?? 0, route: '/(admin)/queues' },
    { key: 'kyc', label: 'KYC', count: monitor?.verificationsPending ?? 0, route: '/(admin)/users' },
    { key: 'rentals', label: 'Rentals', count: monitor?.rentalsReserved ?? 0, route: '/(admin)/queues' },
    { key: 'overdue', label: 'Overdue', count: monitor?.overdueRentals ?? 0, route: '/(admin)/queues', accent: colors.crimson },
    { key: 'swaps', label: 'Swaps', count: monitor?.swapsRequested ?? 0, route: '/(admin)/queues' },
    { key: 'pickup', label: 'Pickups', count: monitor?.circularScheduled ?? 0, route: '/(admin)/queues' },
  ];
  const todoTotal = todoItems.reduce((sum, t) => sum + (t.count ?? 0), 0);

  const kpis = [
    { label: 'USERS', value: String(totals.totalUsers ?? 0) },
    { label: 'LISTINGS', value: String(totals.activeListings ?? 0) },
    { label: 'GMV', value: formatINR(totals.totalGmv) },
    { label: 'OPS TODO', value: String(todoTotal), accent: true },
  ];

  const fmtDay = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  };

  return (
    <View style={styles.container}>
      <AdminTopBar
        title="KAPHOR COMMAND"
        subtitle={`PLATFORM OVERVIEW · ${range.toUpperCase()}`}
        onRefresh={loadData}
        refreshing={loading}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpiCard}>
              <Text style={[styles.kpiValue, k.accent && { color: colors.crimson }]}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Range selector */}
        <View style={styles.rangeRow}>
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
            >
              <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trends */}
        <SectionLabel>Traffic</SectionLabel>
        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>NEW USERS / DAY</Text>
            <Text style={styles.cardMeta}>DAILY SIGNUPS</Text>
          </View>
          <Bars data={buckets.map((b: any) => b.users)} height={80} />
          <View style={styles.axisRow}>
            <Text style={styles.axisText}>{buckets.length ? fmtDay(buckets[0].date) : '–'}</Text>
            <Text style={styles.axisText}>{buckets.length ? fmtDay(buckets[buckets.length - 1].date) : '–'}</Text>
          </View>
        </Card>

        <SectionLabel>Commerce</SectionLabel>
        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>ORDER VOLUME / DAY</Text>
            <Text style={styles.cardMeta}>SALES</Text>
          </View>
          <Bars data={buckets.map((b: any) => b.orders)} height={80} />
          <View style={styles.axisRow}>
            <Text style={styles.axisText}>{buckets.length ? fmtDay(buckets[0].date) : '–'}</Text>
            <Text style={styles.axisText}>{buckets.length ? fmtDay(buckets[buckets.length - 1].date) : '–'}</Text>
          </View>
          <View style={styles.sparkBlock}>
            <Text style={styles.sparkLabel}>SALE GMV / DAY</Text>
            <Sparkline data={buckets.map((b: any) => b.gmvSale)} />
          </View>
          <View style={styles.sparkBlock}>
            <Text style={styles.sparkLabel}>RENTAL GMV / DAY</Text>
            <Sparkline data={buckets.map((b: any) => b.gmvRental)} color={colors.emerald} />
          </View>
        </Card>

        <SectionLabel>Top of the market</SectionLabel>
        <Card>
          {(analytics?.topCategories ?? [])
            .slice(0, 4)
            .map((c: any, i: number) => (
              <View key={c.label} style={styles.topRow}>
                <Text style={styles.topIndex}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={styles.topLabel}>{c.label}</Text>
                <Text style={styles.topCount}>{c.count}</Text>
              </View>
            ))}
          {!(analytics?.topCategories?.length) && <Empty text="No category data yet" />}
        </Card>

        <SectionLabel>Operations queue</SectionLabel>
        <View style={styles.todoGrid}>
          {todoItems.map((t) => (
            <TouchableOpacity key={t.key} style={styles.todoItem} onPress={() => router.push(t.route as any)}>
              <Text style={[styles.todoCount, t.accent && { color: t.accent }]}>{t.count}</Text>
              <Text style={styles.todoLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionLabel>System diagnostics</SectionLabel>
        <Card>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>DATABASE</Text>
            <Chip color={health?.healthy === false ? colors.error : colors.emerald} bg="transparent">
              {health?.healthy === false ? 'DEGRADED' : 'ONLINE'}
            </Chip>
          </View>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>DB PING</Text>
            <Text style={styles.healthValue}>{health?.dbPingMs != null ? `${Math.round(health.dbPingMs)}ms` : '–'}</Text>
          </View>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>UPTIME</Text>
            <Text style={styles.healthValue}>{health ? `${Math.round(health.uptimeSec / 60)}m` : '–'}</Text>
          </View>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>SERVER TIME</Text>
            <Text style={styles.healthValue}>{health ? new Date(health.serverTime).toLocaleString('en-IN') : '–'}</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 24 },
  loadingText: { marginTop: 16, fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 2 },

  scrollContent: { padding: 16, paddingBottom: 48 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: {
    width: '48.5%',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 18,
  },
  kpiValue: { fontFamily: typography.headings, fontSize: 30, color: colors.textPrimary, letterSpacing: 1 },
  kpiLabel: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, letterSpacing: 1.5, marginTop: 6 },

  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    backgroundColor: colors.bgCard,
  },
  rangeChipActive: { backgroundColor: colors.ink },
  rangeText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '700', color: colors.textSecond },
  rangeTextActive: { color: colors.white },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  cardTitle: { fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1 },
  cardMeta: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, letterSpacing: 1 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted },

  sparkBlock: { marginTop: 14 },
  sparkLabel: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, letterSpacing: 1, marginBottom: 6 },

  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  topIndex: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, width: 26 },
  topLabel: { flex: 1, fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  topCount: { fontFamily: typography.mono, fontSize: 11, color: colors.textSecond },

  todoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  todoItem: {
    width: '31.5%',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  todoCount: { fontFamily: typography.headings, fontSize: 22, color: colors.textPrimary },
  todoLabel: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, letterSpacing: 1, marginTop: 2 },

  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  healthLabel: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, letterSpacing: 1.5 },
  healthValue: { fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.textPrimary },

  lockTitle: { fontFamily: typography.headings, fontSize: 22, color: colors.error, marginTop: 20 },
  lockSub: { textAlign: 'center', color: colors.textMuted, marginTop: 8, fontSize: 13 },
  lockBtn: { marginTop: 28, backgroundColor: colors.ink, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 4 },
  lockBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});