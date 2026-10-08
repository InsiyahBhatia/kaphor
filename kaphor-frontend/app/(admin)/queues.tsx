import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { adminService } from '../../src/services/adminService';
import api from '../../src/services/api';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Chip, Empty } from '../../src/components/admin/AdminUI';
import { Loader } from '../../src/components/common/Loader';
import { KaphorImage } from '../../src/components/KaphorImage';

function QueueSection({
  title, count, children,
}: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View>
      <TouchableOpacity style={styles.sectionHead} onPress={() => setOpen((o) => !o)}>
        <View style={styles.sectionHeadLeft}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.sectionCountBadge}>
            <Text style={styles.sectionCount}>{count}</Text>
          </View>
        </View>
        <SolarIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function ActionBtn({ label, onPress, color = colors.ink, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actBtn, { borderColor: color }, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.actText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function QueueRow({
  title, meta, status, extra, garments, children,
}: { title: string; meta: string; status?: string; extra?: string; garments?: any[]; children?: React.ReactNode }) {
  const shown = (garments ?? []).filter(Boolean).slice(0, 2);
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowTop}>
        {shown.length > 0 && (
          <View style={styles.rowThumbs}>
            {shown.map((g: any, i: number) => (
              <View key={g.id ?? i} style={styles.rowThumb}>
                <KaphorImage
                  uri={g.thumbnailUrl || g.images?.[0]}
                  category={g.category}
                  brand={g.brand}
                  style={styles.rowThumbImg}
                  contentFit="cover"
                />
              </View>
            ))}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.rowMeta} numberOfLines={2}>{meta}</Text>
          {extra ? <Text style={styles.rowExtra} numberOfLines={2}>{extra}</Text> : null}
        </View>
      </View>
      <View style={styles.rowFoot}>
        {status ? <Chip>{status}</Chip> : null}
        <View style={{ flex: 1 }} />
        {children}
      </View>
    </View>
  );
}

function QueueSpinner() {
  return <Loader compact />;
}

export default function AdminQueuesScreen() {
  const [tick, setTick] = useState(0);
  const [upcycles, setUpcycles] = useState<any[] | null>(null);
  const [reports, setReports] = useState<any[] | null>(null);
  const [verifications, setVerifications] = useState<any[] | null>(null);
  const [bespoke, setBespoke] = useState<any[] | null>(null);
  const [swaps, setSwaps] = useState<any[] | null>(null);
  const [rentals, setRentals] = useState<any[] | null>(null);
  const [circular, setCircular] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string>('');

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      adminService.listUpcycles({ status: 'PENDING_REVIEW', limit: 50 }).then((d) => (alive ? setUpcycles(d) : null)).catch(() => (alive ? setUpcycles([]) : null)),
      adminService.listReports({ status: 'PENDING', limit: 50 }).then((d) => (alive ? setReports(d) : null)).catch(() => (alive ? setReports([]) : null)),
      adminService.listVerifications({ limit: 50 }).then((d) => (alive ? setVerifications(d) : null)).catch(() => (alive ? setVerifications([]) : null)),
      adminService.listBespokeRequests({ status: 'PENDING', limit: 50 }).then((d) => (alive ? setBespoke(d) : null)).catch(() => (alive ? setBespoke([]) : null)),
      adminService.listSwaps({ limit: 50 }).then((d) => (alive ? setSwaps(d) : null)).catch(() => (alive ? setSwaps([]) : null)),
      adminService.listRentals({ limit: 50 }).then((d) => (alive ? setRentals(d) : null)).catch(() => (alive ? setRentals([]) : null)),
      adminService.listCircularRequests({ status: 'SCHEDULED', limit: 50 }).then((d) => (alive ? setCircular(d) : null)).catch(() => (alive ? setCircular([]) : null)),
    ]);
    return () => {
      alive = false;
    };
  }, [tick]);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      refetch();
    } catch (e: any) {
      Alert.alert('Action Failed', e?.response?.data?.message || 'Could not complete action.');
    } finally {
      setBusy('');
    }
  };

  const sUp = upcycles?.filter((x) => x.status === 'PENDING_REVIEW').length ?? 0;
  const sRep = reports?.filter((x) => x.status === 'PENDING').length ?? 0;
  const sVer = verifications?.filter((x) => x.status === 'PENDING_REVIEW').length ?? 0;
  const sBes = bespoke?.filter((x) => x.status === 'PENDING').length ?? 0;
  const sSwap = swaps?.filter((x) => x.status === 'REQUESTED' || x.status === 'ACCEPTED').length ?? 0;
  const sRent = rentals?.filter((x) => (['RETURN_DISPATCHED', 'RETURNED'].includes(x.status))).length ?? 0;
  const sCirc = circular?.filter((x) => x.status === 'SCHEDULED').length ?? 0;

  return (
    <View style={styles.container}>
      <AdminTopBar title="OPERATIONS" subtitle={`${sUp + sRep + sVer + sBes + sSwap + sRent + sCirc} ITEMS PENDING`} onRefresh={refetch} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <QueueSection title="Upcycle requests" count={sUp}>
          {upcycles === null ? <QueueSpinner /> : upcycles.length === 0 ? <Empty text="No pending reviews" /> : null}
          {upcycles?.map((u: any) => (
            <QueueRow
              key={u.id}
              title={u.customIdea || u.notes || u.garment?.title || 'Upcycle request'}
              meta={`${u.user?.displayName ?? 'User'} · ${u.garment?.title ?? '—'}`}
              status={u.status}
              extra={`Cost ${u.estimatedCost ?? '—'} · ${u.estimatedDays ?? '—'}d`}
              garments={[u.garment]}
            >
              <ActionBtn label="APPROVE" onPress={() => runAction(`up-${u.id}`, () => adminService.updateUpcycle(u.id, 'IN_PROGRESS'))} disabled={busy === `up-${u.id}`} color={colors.emerald} />
              <ActionBtn label="REJECT" onPress={() => runAction(`up-${u.id}`, () => adminService.updateUpcycle(u.id, 'REJECTED'))} disabled={busy === `up-${u.id}`} color={colors.error} />
            </QueueRow>
          ))}
        </QueueSection>

        <QueueSection title="User reports" count={sRep}>
          {reports === null ? <QueueSpinner /> : reports.length === 0 ? <Empty text="No pending reports" /> : null}
          {reports?.map((r: any) => (
            <QueueRow
              key={r.id}
              title={`${r.reportedUser?.displayName ?? 'User'} reported`}
              meta={`Reporter: ${r.reporter?.displayName ?? '—'}`}
              status={r.status}
              extra={r.reason}
            >
              <ActionBtn label="RESOLVE" onPress={() => runAction(`rep-${r.id}`, () => adminService.updateReport(r.id, 'RESOLVED'))} disabled={busy === `rep-${r.id}`} color={colors.emerald} />
              <ActionBtn label="DISMISS" onPress={() => runAction(`rep-${r.id}`, () => adminService.updateReport(r.id, 'DISMISSED'))} disabled={busy === `rep-${r.id}`} />
            </QueueRow>
          ))}
        </QueueSection>

        <QueueSection title="KYC verifications" count={sVer}>
          {verifications === null ? <QueueSpinner /> : verifications.length === 0 ? <Empty text="No pending reviews" /> : null}
          {verifications?.map((v: any) => (
            <QueueRow
              key={v.id}
              title={v.displayName}
              meta={`${v.email} · ${v.verificationType || 'ID'}${v.idNumberLast4 ? ` · ••••${v.idNumberLast4}` : ''}`}
              status={v.verificationStatus}
            >
              <ActionBtn label="VERIFY" onPress={() => runAction(`ver-${v.id}`, () => adminService.updateVerification(v.id, 'VERIFIED'))} disabled={busy === `ver-${v.id}`} color={colors.emerald} />
              <ActionBtn label="REJECT" onPress={() => runAction(`ver-${v.id}`, () => adminService.updateVerification(v.id, 'REJECTED'))} disabled={busy === `ver-${v.id}`} color={colors.error} />
            </QueueRow>
          ))}
        </QueueSection>

        <QueueSection title="Custom consultations" count={sBes}>
          {bespoke === null ? <QueueSpinner /> : bespoke.length === 0 ? <Empty text="No pending requests" /> : null}
          {bespoke?.map((b: any) => (
            <QueueRow
              key={b.id}
              title={b.description || 'Custom request'}
              meta={`${b.user?.displayName ?? 'User'} · ${b.contactEmail ?? '—'}`}
              status={b.status}
            >
              <ActionBtn label="IN REVIEW" onPress={() => runAction(`bes-${b.id}`, () => adminService.updateBespokeStatus(b.id, 'IN_REVIEW'))} disabled={busy === `bes-${b.id}`} />
              <ActionBtn label="COMPLETE" onPress={() => runAction(`bes-${b.id}`, () => adminService.updateBespokeStatus(b.id, 'COMPLETED'))} disabled={busy === `bes-${b.id}`} color={colors.emerald} />
            </QueueRow>
          ))}
        </QueueSection>

        <QueueSection title="Swaps" count={sSwap}>
          {swaps === null ? <QueueSpinner /> : swaps.length === 0 ? <Empty text="No active swaps" /> : null}
          {swaps?.filter((x) => x.status === 'REQUESTED' || x.status === 'ACCEPTED').map((sw: any) => (
            <QueueRow
              key={sw.id}
              title={`${sw.initiator?.displayName ?? 'A'} ↔ ${sw.receiver?.displayName ?? 'B'}`}
              meta={`${sw.offeredGarment?.title ?? '—'} for ${sw.wantedGarment?.title ?? '—'}`}
              garments={[sw.offeredGarment, sw.wantedGarment]}
              status={sw.status}
            >
              {sw.status === 'REQUESTED' && (
                <>
                  <ActionBtn label="ACCEPT" onPress={() => runAction(`sw-${sw.id}`, () => adminService.updateSwapStatus(sw.id, 'ACCEPTED'))} disabled={busy === `sw-${sw.id}`} color={colors.emerald} />
                  <ActionBtn label="CANCEL" onPress={() => runAction(`sw-${sw.id}`, () => adminService.updateSwapStatus(sw.id, 'CANCELLED'))} disabled={busy === `sw-${sw.id}`} color={colors.error} />
                </>
              )}
              {sw.status === 'ACCEPTED' && (
                <ActionBtn label="COMPLETE" onPress={() => runAction(`sw-${sw.id}`, () => adminService.updateSwapStatus(sw.id, 'COMPLETED'))} disabled={busy === `sw-${sw.id}`} color={colors.emerald} />
              )}
            </QueueRow>
          ))}
        </QueueSection>

        <QueueSection title="Rentals" count={sRent}>
          {rentals === null ? <QueueSpinner /> : rentals.length === 0 ? <Empty text="No rentals to action" /> : null}
          {rentals?.filter((x) => x.status === 'RETURN_DISPATCHED' || x.status === 'RETURNED').map((r: any) => (
            <QueueRow
              key={r.id}
              title={r.garment?.title ?? 'Rental'}
              meta={`${r.renter?.displayName ?? 'Renter'} · ${new Date(r.startDate).toLocaleDateString('en-IN')} – ${new Date(r.endDate).toLocaleDateString('en-IN')}`}
              status={r.status}
              garments={[r.garment]}
            >
              {r.status === 'RETURN_DISPATCHED' && (
                <ActionBtn label="CONFIRM RETURN" onPress={() => runAction(`r-${r.id}`, () => api.post(`/rentals/${r.id}/confirm-return-delivery`))} disabled={busy === `r-${r.id}`} color={colors.emerald} />
              )}
              {r.status === 'RETURNED' && (
                <ActionBtn label="RELEASE DEPOSIT" onPress={() => runAction(`r-${r.id}`, () => api.post(`/rentals/${r.id}/release-deposit`))} disabled={busy === `r-${r.id}`} color={colors.emerald} />
              )}
            </QueueRow>
          ))}
        </QueueSection>

        <QueueSection title="Circular pickups" count={sCirc}>
          {circular === null ? <QueueSpinner /> : circular.length === 0 ? <Empty text="No scheduled pickups" /> : null}
          {circular?.map((c: any) => (
            <QueueRow
              key={c.id}
              title={`${c.garment?.title ?? 'Garment'} · ${c.preferredSlot ?? ''}`}
              meta={`${c.user?.displayName ?? 'User'} · ${c.address ?? ''}`}
              status={c.status}
              garments={[c.garment]}
            >
              <ActionBtn label="PICKED UP" onPress={() => runAction(`c-${c.id}`, () => adminService.updateCircularRequest(c.id, 'PICKED_UP'))} disabled={busy === `c-${c.id}`} color={colors.emerald} />
              <ActionBtn label="COMPLETE" onPress={() => runAction(`c-${c.id}`, () => adminService.updateCircularRequest(c.id, 'COMPLETED'))} disabled={busy === `c-${c.id}`} />
            </QueueRow>
          ))}
        </QueueSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 16, paddingBottom: 48 },

  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    backgroundColor: colors.white,
    marginTop: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontFamily: typography.bodyBold, fontSize: 15, color: colors.ink, letterSpacing: 0.2 },
  sectionCountBadge: { backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  sectionCount: { fontFamily: typography.bodyBold, fontSize: 11, color: colors.cream },
  sectionBody: { gap: 10, paddingTop: 10 },

  rowCard: {
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
  rowTop: { flexDirection: 'row', gap: 12 },
  rowThumbs: { flexDirection: 'row', gap: 6 },
  rowThumb: { width: 56, height: 72, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.bgMuted },
  rowThumbImg: { width: '100%', height: '100%' },
  rowTitle: { fontFamily: typography.bodyBold, fontSize: 14, color: colors.ink },
  rowMeta: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  rowExtra: { fontFamily: typography.body, fontSize: 12, color: colors.ink, marginTop: 6 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },

  actBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.white,
  },
  actText: { fontFamily: typography.bodyBold, fontSize: 11, letterSpacing: 0.5 },
});