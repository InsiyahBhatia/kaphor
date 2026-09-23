import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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
  icon: keyof typeof Ionicons.glyphMap;
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
    } catch {
      // Keep partial state so overview does not crash
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  // Permit access for ADMIN role, kaphor.team account, or local dev mode
  const isAdminAuthorized =
    user?.role === 'ADMIN' ||
    user?.email?.toLowerCase() === 'kaphor.team@gmail.com' ||
    __DEV__;

  if (authLoading || (loading && !monitor && !analytics)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>SYNCING PLATFORM DATA…</Text>
      </View>
    );
  }

  if (!isAdminAuthorized) {
    return (
      <View style={styles.centered}>
        <View style={styles.lockIconBox}>
          <Ionicons name="shield-outline" size={48} color={colors.crimson} />
        </View>
        <Text style={styles.lockTitle}>ACCESS RESTRICTED</Text>
        <Text style={styles.lockSub}>
          KAPHOR ADMIN PRIVILEGES REQUIRED TO ACCESS THIS CONTROL PANEL.
        </Text>
        <TouchableOpacity style={styles.lockBtn} onPress={() => router.replace('/(tabs)/profile')}>
          <Text style={styles.lockBtnText}>RETURN TO PROFILE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const buckets = analytics?.buckets ?? [];
  const totals = analytics?.totals ?? {};

  const todoItems: TodoItem[] = [
    { key: 'orders', label: 'Orders', count: monitor?.ordersPending ?? 0, route: '/(admin)/orders', icon: 'cart-outline' },
    { key: 'bespoke', label: 'Bespoke', count: monitor?.bespokePending ?? 0, route: '/(admin)/queues', icon: 'sparkles-outline' },
    { key: 'upcycle', label: 'Upcycle', count: monitor?.upcyclePending ?? 0, route: '/(admin)/queues', icon: 'cut-outline' },
    { key: 'reports', label: 'Reports', count: monitor?.reportsPending ?? 0, route: '/(admin)/queues', icon: 'flag-outline' },
    { key: 'kyc', label: 'KYC', count: monitor?.verificationsPending ?? 0, route: '/(admin)/users', icon: 'id-card-outline' },
    { key: 'rentals', label: 'Rentals', count: monitor?.rentalsReserved ?? 0, route: '/(admin)/queues', icon: 'time-outline' },
    { key: 'overdue', label: 'Overdue', count: monitor?.overdueRentals ?? 0, route: '/(admin)/queues', accent: colors.crimson, icon: 'alert-circle-outline' },
    { key: 'swaps', label: 'Swaps', count: monitor?.swapsRequested ?? 0, route: '/(admin)/queues', icon: 'swap-horizontal-outline' },
    { key: 'pickup', label: 'Pickups', count: monitor?.circularScheduled ?? 0, route: '/(admin)/queues', icon: 'leaf-outline' },
  ];
  const todoTotal = todoItems.reduce((sum, t) => sum + (t.count ?? 0), 0);

  const kpis = [
    { label: 'TOTAL USERS', value: String(totals.totalUsers ?? 0), icon: 'people' as const },
    { label: 'ACTIVE LISTINGS', value: String(totals.activeListings ?? 0), icon: 'shirt' as const },
    { label: 'CONFIRMED GMV', value: formatINR(totals.totalGmv), icon: 'trending-up' as const },
    { label: 'PENDING OPS', value: String(todoTotal), accent: todoTotal > 0, icon: 'hourglass' as const },
  ];

  const adminModules = [
    { title: 'ORDERS & SALES', count: `${monitor?.ordersPending ?? 0} PENDING`, route: '/(admin)/orders', icon: 'receipt-outline' as const },
    { title: 'LISTINGS & LIFECYCLE', count: `${totals.activeListings ?? 0} ACTIVE`, route: '/(admin)/listings', icon: 'pricetag-outline' as const },
    { title: 'USERS & VERIFICATIONS', count: `${monitor?.verificationsPending ?? 0} REVIEW`, route: '/(admin)/users', icon: 'people-outline' as const },
    { title: 'OPERATIONS QUEUES', count: `${todoTotal} ACTIONS`, route: '/(admin)/queues', icon: 'git-pull-request-outline' as const },
    { title: 'AUDIT & SECURITY', count: health?.healthy === false ? 'DEGRADED' : 'ONLINE', route: '/(admin)/audit', icon: 'shield-checkmark-outline' as const },
  ];

  const fmtDay = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  };

  return (
    <View style={styles.container}>
      <AdminTopBar
        title="KAPHOR COMMAND"
        subtitle={`PLATFORM CONTROL · ${range.toUpperCase()}`}
        onRefresh={loadData}
        refreshing={loading}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>{k.label}</Text>
                <Ionicons
                  name={k.icon}
                  size={14}
                  color={k.accent ? colors.crimson : colors.textMuted}
                />
              </View>
              <Text style={[styles.kpiValue, k.accent && { color: colors.crimson }]}>
                {k.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Range Selector */}
        <View style={styles.rangeRow}>
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>
                {r.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── MODULE SWITCHBOARD: JUMP TO KEY ADMIN SCREENS ── */}
        <SectionLabel>Command Modules</SectionLabel>
        <View style={styles.modulesGrid}>
          {adminModules.map((m) => (
            <TouchableOpacity
              key={m.title}
              style={styles.moduleCard}
              onPress={() => router.push(m.route as any)}
              activeOpacity={0.85}
            >
              <View style={styles.moduleHead}>
                <View style={styles.moduleIconBox}>
                  <Ionicons name={m.icon} size={16} color={colors.ink} />
                </View>
                <Text style={styles.moduleCount}>{m.count}</Text>
              </View>
              <View style={styles.moduleFoot}>
                <Text style={styles.moduleTitle}>{m.title}</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.ink} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── TRAFFIC & SIGNUPS ── */}
        <SectionLabel>Traffic & Growth</SectionLabel>
        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>NEW USER SIGNUPS / DAY</Text>
            <Text style={styles.cardMeta}>GROWTH TRAJECTORY</Text>
          </View>
          <Bars data={buckets.map((b: any) => b.users)} height={80} />
          <View style={styles.axisRow}>
            <Text style={styles.axisText}>{buckets.length ? fmtDay(buckets[0].date) : '–'}</Text>
            <Text style={styles.axisText}>
              {buckets.length ? fmtDay(buckets[buckets.length - 1].date) : '–'}
            </Text>
          </View>
        </Card>

        {/* ── COMMERCE & GMV ── */}
        <SectionLabel>Commerce & Transaction Volume</SectionLabel>
        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>ORDER VOLUME / DAY</Text>
            <Text style={styles.cardMeta}>TRANSACTION FREQUENCY</Text>
          </View>
          <Bars data={buckets.map((b: any) => b.orders)} height={80} />
          <View style={styles.axisRow}>
            <Text style={styles.axisText}>{buckets.length ? fmtDay(buckets[0].date) : '–'}</Text>
            <Text style={styles.axisText}>
              {buckets.length ? fmtDay(buckets[buckets.length - 1].date) : '–'}
            </Text>
          </View>
          <View style={styles.sparkBlock}>
            <Text style={styles.sparkLabel}>SALE GMV (INR) / DAY</Text>
            <Sparkline data={buckets.map((b: any) => b.gmvSale)} />
          </View>
          <View style={styles.sparkBlock}>
            <Text style={styles.sparkLabel}>RENTAL GMV (INR) / DAY</Text>
            <Sparkline data={buckets.map((b: any) => b.gmvRental)} color={colors.emerald} />
          </View>
        </Card>

        {/* ── TOP CATEGORIES ── */}
        <SectionLabel>Market Dominance</SectionLabel>
        <Card>
          {(analytics?.topCategories ?? []).slice(0, 5).map((c: any, i: number) => (
            <View key={c.label} style={styles.topRow}>
              <Text style={styles.topIndex}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.topLabel}>{c.label.toUpperCase()}</Text>
              <Text style={styles.topCount}>{c.count} items</Text>
            </View>
          ))}
          {!(analytics?.topCategories?.length) && <Empty text="No category data recorded yet" />}
        </Card>

        {/* ── OPERATIONS QUEUE BREAKDOWN ── */}
        <SectionLabel>Operations Dispatch</SectionLabel>
        <View style={styles.todoGrid}>
          {todoItems.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={styles.todoItem}
              onPress={() => router.push(t.route as any)}
              activeOpacity={0.85}
            >
              <View style={styles.todoTop}>
                <Ionicons name={t.icon} size={14} color={t.accent || colors.textMuted} />
                <Text style={[styles.todoCount, t.accent && { color: t.accent }]}>
                  {t.count}
                </Text>
              </View>
              <Text style={styles.todoLabel}>{t.label.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SYSTEM DIAGNOSTICS ── */}
        <SectionLabel>System Health & Latency</SectionLabel>
        <Card>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>DATABASE STATE</Text>
            <Chip color={health?.healthy === false ? colors.error : colors.emerald} bg="transparent">
              {health?.healthy === false ? 'DEGRADED' : 'ONLINE'}
            </Chip>
          </View>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>LATENCY (PING)</Text>
            <Text style={styles.healthValue}>
              {health?.dbPingMs != null ? `${Math.round(health.dbPingMs)}ms` : '–'}
            </Text>
          </View>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>PROCESS UPTIME</Text>
            <Text style={styles.healthValue}>
              {health ? `${Math.round(health.uptimeSec / 60)}m` : '–'}
            </Text>
          </View>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>SERVER TIMESTAMP</Text>
            <Text style={styles.healthValue}>
              {health ? new Date(health.serverTime).toLocaleTimeString('en-IN') : '–'}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontFamily: typography.monoBold,
    fontSize: 13.5,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  lockIconBox: {
    width: 80,
    height: 80,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: colors.crimson,
    backgroundColor: colors.crimsonLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockTitle: {
    fontFamily: typography.headings,
    fontSize: 30,
    color: colors.crimson,
    letterSpacing: 1.5,
  },
  lockSub: {
    textAlign: 'center',
    fontFamily: typography.mono,
    color: colors.textMuted,
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 15,
    maxWidth: 280,
  },
  lockBtn: {
    marginTop: 24,
    backgroundColor: colors.ink,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
  },
  lockBtnText: {
    color: colors.cream,
    fontFamily: typography.monoBold,
    fontSize: 13.5,
    letterSpacing: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 2.5, height: 2.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  kpiValue: {
    fontFamily: typography.headings,
    fontSize: 30,
    color: colors.ink,
    letterSpacing: 1,
  },

  // Range Selector
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  rangeChipActive: {
    backgroundColor: colors.ink,
  },
  rangeText: {
    fontFamily: typography.monoBold,
    fontSize: 13,
    color: colors.ink,
  },
  rangeTextActive: {
    color: colors.cream,
  },

  // Module Switchboard
  modulesGrid: {
    gap: 8,
    marginBottom: 10,
  },
  moduleCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  moduleHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  moduleIconBox: {
    width: 28,
    height: 28,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleCount: {
    fontFamily: typography.monoBold,
    fontSize: 11.5,
    color: colors.ink,
    letterSpacing: 0.8,
  },
  moduleFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleTitle: {
    fontFamily: typography.headings,
    fontSize: 19.5,
    color: colors.ink,
    letterSpacing: 1,
  },

  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: typography.monoBold,
    fontSize: 13.5,
    color: colors.ink,
    letterSpacing: 1,
  },
  cardMeta: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
  },

  sparkBlock: {
    marginTop: 14,
  },
  sparkLabel: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bgMuted,
  },
  topIndex: {
    fontFamily: typography.monoBold,
    fontSize: 13,
    color: colors.textMuted,
    width: 24,
  },
  topLabel: {
    flex: 1,
    fontFamily: typography.monoBold,
    fontSize: 13.5,
    color: colors.ink,
  },
  topCount: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.textMuted,
  },

  todoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  todoItem: {
    width: '31.5%',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  todoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  todoCount: {
    fontFamily: typography.headings,
    fontSize: 24.5,
    color: colors.ink,
  },
  todoLabel: {
    fontFamily: typography.monoBold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 3,
    textAlign: 'center',
  },

  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  healthLabel: {
    fontFamily: typography.monoBold,
    fontSize: 11.5,
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  healthValue: {
    fontFamily: typography.monoBold,
    fontSize: 13.5,
    color: colors.ink,
  },
});