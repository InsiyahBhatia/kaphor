import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { adminService } from '../../src/services/adminService';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Empty } from '../../src/components/admin/AdminUI';
import { Loader } from '../../src/components/common/Loader';
import { objectToPairs } from '../../src/utils/formatText';

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
      {loading && !data ? (
        <View style={styles.centered}>
          <Loader compact />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {data?.data?.length === 0 && <Empty text="No audit events recorded" />}
          {data?.data?.map((l: any) => (
            <View key={l.id} style={styles.logCard}>
              <View style={styles.logHead}>
                <Text style={styles.logAction}>{String(l.action ?? '').replace(/_/g, ' ')}</Text>
                <Text style={styles.logTime}>{new Date(l.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
              </View>
              <Text style={styles.logActor}>
                {l.user?.displayName ?? l.user?.email ?? 'SYSTEM'} · {l.resource ?? '—'}
              </Text>
              {l.ip ? <Text style={styles.logIp}>IP {l.ip}</Text> : null}
              {objectToPairs(l.metadata, 60).length > 0 && (
                <View style={styles.metaWrap}>
                  {objectToPairs(l.metadata, 60).slice(0, 8).map((m) => (
                    <View key={m.label} style={styles.metaChip}>
                      <Text style={styles.logMeta} numberOfLines={1}>
                        {m.label}: {m.value}
                      </Text>
                    </View>
                  ))}
                </View>
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
  container: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },

  list: { padding: 16, paddingBottom: 40, gap: 10 },
  logCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontFamily: typography.bodyBold, fontSize: 12, color: colors.ink, flex: 1 },
  logTime: { fontFamily: typography.body, fontSize: 11, color: colors.textMuted },
  logActor: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.ink, marginTop: 6 },
  logIp: { fontFamily: typography.body, fontSize: 11, color: colors.textMuted, marginTop: 3 },
  logMeta: { fontFamily: typography.body, fontSize: 11, color: colors.textSecond },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaChip: {
    backgroundColor: colors.bgMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
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