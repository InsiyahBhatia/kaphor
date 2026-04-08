import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../src/theme';
import { userService } from '../../../../src/services/userService';

export default function PublicSellerProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [p, setP] = useState<Awaited<ReturnType<typeof userService.getPublicProfile>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const data = await userService.getPublicProfile(userId);
        setP(data);
      } catch {
        setP(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.crimson} />
      </View>
    );
  }

  if (!p) {
    return (
      <View style={styles.centered}>
        <Text style={styles.miss}>Profile unavailable</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avg = p.peerReviewAvg != null ? p.peerReviewAvg.toFixed(1) : '—';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        <Text style={styles.backText}>BACK</Text>
      </TouchableOpacity>

      <View style={styles.avatarWrap}>
        {p.avatar ? (
          <Image source={{ uri: p.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPh]}>
            <Ionicons name="person" size={48} color={colors.textMuted} />
          </View>
        )}
      </View>
      <Text style={styles.name}>{p.displayName}</Text>
      <Text style={styles.user}>@{p.username}</Text>
      {p.trustedSeller ? (
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={16} color={colors.white} />
          <Text style={styles.badgeText}>TRUSTED SELLER</Text>
        </View>
      ) : null}
      <Text style={styles.bio}>{p.bio || 'No bio yet.'}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>PEER VERIFICATION</Text>
        <Text style={styles.cardBody}>
          After completed sales, buyers can rate sellers. Strong track records earn the trusted badge (3+ reviews,
          average 4★ or higher).
        </Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{avg}</Text>
            <Text style={styles.statLab}>AVG RATING</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{p.peerReviewCount}</Text>
            <Text style={styles.statLab}>REVIEWS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{p.tier}</Text>
            <Text style={styles.statLab}>TIER</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  miss: { color: colors.textMuted },
  link: { color: colors.crimson, marginTop: 12, fontWeight: '700' },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { fontSize: 12, fontWeight: '800', color: colors.textPrimary, letterSpacing: 1 },
  avatarWrap: { alignItems: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.border },
  avatarPh: { backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' },
  name: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 28,
    color: colors.textPrimary,
  },
  user: { textAlign: 'center', color: colors.textMuted, marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  bio: { marginTop: 20, textAlign: 'center', color: colors.textSecond, lineHeight: 22 },
  card: {
    marginTop: 28,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 12, fontWeight: '900', color: colors.crimson, letterSpacing: 1 },
  cardBody: { marginTop: 8, fontSize: 13, color: colors.textSecond, lineHeight: 20 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLab: { fontSize: 9, color: colors.textMuted, marginTop: 4, fontWeight: '800' },
});
