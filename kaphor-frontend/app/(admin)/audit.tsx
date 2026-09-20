import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { adminService } from '../../src/services/adminService';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Empty } from '../../src/components/admin/AdminUI';

export default function AdminAuditScreen() {
  const [data, setData] = useState<any>({ data: [], meta: { total: 0, pages: 1, page: 1 } });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listAudit({ page, limit: 40 });
      setData(res);
    } catch {
      setData({ data: [], meta: { total: 0, pages: 1, page: 1 } });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const meta = data?.meta ?? { total: 0, pages: 1, page: 1 };

  return (
    <View style={styles.container}>
      <AdminTopBar title="AUDIT TRAIL" subtitle={`${meta.total} EVENTS · PAGE ${meta.page}/${meta.pages}`} onRefresh={load} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.ink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {data?.data?.length === 0 && <Empty text="No audit events recorded" />}
          {data?.data?.map((l: any) => (
            <View key={l.id} style={styles.logCard}>
              <View style={styles.logHead}>
                <Text style={styles.logAction}>{l.action.replace(/_/g, ' ')}</Text>
                <Text style={styles.logTime}>{new Date(l.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
              </View>
              <Text style={styles.logActor}>
                {l.user?.displayName ?? l.user?.email ?? 'SYSTEM'} · {l.resource ?? '—'}
              </Text>
              {l.ip ? <Text style={styles.logIp}>IP {l.ip}</Text> : null}
              {l.metadata && (
                <Text style={styles.logMeta} numberOfLines={1}>
                  {JSON.stringify(l.metadata)}
                </Text>
              )}
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
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  list: { padding: 16, paddingBottom: 40, gap: 8 },
  logCard: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 4, padding: 12,
  },
  logHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontFamily: typography.monoBold, fontSize: 9, color: colors.textPrimary, letterSpacing: 1, flex: 1 },
  logTime: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted },
  logActor: { fontFamily: typography.mono, fontSize: 9, color: colors.textSecond, marginTop: 6 },
  logIp: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, marginTop: 2 },
  logMeta: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, marginTop: 4 },

  pager: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 8 },
  pagerBtn: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 2, backgroundColor: colors.bgCard },
  pagerText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1 },
  pagerInfo: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted },
});