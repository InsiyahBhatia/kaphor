import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../src/theme';
import { userService } from '../../../../src/services/userService';
import { messageService } from '../../../../src/services/messageService';
import { KaphorImage } from '../../../../src/components/KaphorImage';
import { VerifiedBadge } from '../../../../src/components/common/VerifiedBadge';
import { safeBack } from '../../../../src/utils/navigation';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: {
    id: string;
    displayName: string;
    username: string;
    avatar: string | null;
    isVerified?: boolean;
  };
  garment?: {
    id: string;
    title: string;
    brand: string;
    images?: string[];
  } | null;
}

export default function PublicSellerProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof userService.getPublicProfile>> | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      const [pData, rData] = await Promise.all([
        userService.getPublicProfile(userId as string),
        userService.getUserReviews(userId as string),
      ]);
      setProfile(pData);
      setReviews(rData);
    } catch (e) {
      console.error('Failed to load seller profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMessageSeller = async () => {
    if (!userId || startingChat) return;
    setStartingChat(true);
    try {
      const conv = await messageService.getOrCreateConversation(userId as string);
      router.push(`/messages/${conv.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not start conversation');
    } finally {
      setStartingChat(false);
    }
  };

  const handleReport = () => {
    if (!profile) return;
    Alert.alert(
      'Report Seller',
      `Submit a trust & safety report against @${profile.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Misconduct',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await messageService.reportUser(profile.id, 'User reported from public profile');
              Alert.alert('Report Received', res.message);
            } catch {
              Alert.alert('Error', 'Could not submit report.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.charcoal} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.miss}>Seller profile unavailable</Text>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backBtnText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avgRating = profile.peerReviewAvg != null ? profile.peerReviewAvg.toFixed(1) : '5.0';
  const totalReviews = profile.peerReviewCount || reviews.length || 0;
  const breakdown = profile.ratingBreakdown || { 5: totalReviews, 4: 0, 3: 0, 2: 0, 1: 0 };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>SELLER SCORECARD</Text>
        <TouchableOpacity style={styles.topBarReport} onPress={handleReport}>
          <Ionicons name="shield-outline" size={20} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      {/* Seller Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.avatarWrap}>
          <KaphorImage uri={profile.avatar || ''} style={styles.avatar} contentFit="cover" />
          {profile.isVerified && (
            <View style={styles.verifiedShieldCorner}>
              <Ionicons name="shield-checkmark" size={16} color="#C9A84C" />
            </View>
          )}
        </View>

        <Text style={styles.displayName}>{profile.displayName}</Text>
        <Text style={styles.username}>@{profile.username}</Text>

        <View style={styles.badgeRow}>
          {profile.isVerified ? (
            <VerifiedBadge type="seller" size="large" />
          ) : (
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{profile.tier || 'MEMBER'} TIER</Text>
            </View>
          )}

          {profile.trustedSeller && (
            <View style={styles.trustedBadge}>
              <Ionicons name="ribbon" size={12} color={colors.cream} />
              <Text style={styles.trustedBadgeText}>TOP RATED</Text>
            </View>
          )}
        </View>

        <Text style={styles.bioText}>
          {profile.bio || 'Verified member of the Kaphor luxury circular fashion community.'}
        </Text>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.messageCta}
          onPress={handleMessageSeller}
          disabled={startingChat}
          activeOpacity={0.8}
        >
          {startingChat ? (
            <ActivityIndicator color={colors.cream} size="small" />
          ) : (
            <>
              <Ionicons name="chatbubbles" size={16} color={colors.cream} />
              <Text style={styles.messageCtaText}>MESSAGE SELLER DIRECTLY</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Rating Scorecard */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionCardHeader}>
          <Ionicons name="star" size={16} color="#C9A84C" />
          <Text style={styles.sectionTitle}>REPUTATION & RATINGS</Text>
        </View>

        <View style={styles.scorecardRow}>
          <View style={styles.scoreBigCol}>
            <Text style={styles.bigRatingText}>{avgRating}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={14} color="#C9A84C" />
              ))}
            </View>
            <Text style={styles.totalReviewsText}>
              {totalReviews} verified {totalReviews === 1 ? 'sale' : 'sales'}
            </Text>
          </View>

          {/* Breakdown Bars */}
          <View style={styles.barsCol}>
            {[5, 4, 3, 2, 1].map((starNum) => {
              const count = (breakdown as any)[starNum] || 0;
              const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <View key={starNum} style={styles.barRow}>
                  <Text style={styles.barLabel}>{starNum}★</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${percent}%` }]} />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Reviews List */}
      <View style={styles.reviewsSection}>
        <Text style={styles.reviewsSectionTitle}>
          PEER REVIEWS ({reviews.length})
        </Text>

        {reviews.length === 0 ? (
          <View style={styles.emptyReviews}>
            <Ionicons name="chatbox-ellipses-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyReviewsTitle}>NO REVIEWS YET</Text>
            <Text style={styles.emptyReviewsDesc}>
              Reviews appear here after verified buyers confirm receipt of orders.
            </Text>
          </View>
        ) : (
          reviews.map((rev) => (
            <View key={rev.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <KaphorImage uri={rev.reviewer?.avatar || ''} style={styles.reviewerAvatar} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <View style={styles.reviewerNameRow}>
                    <Text style={styles.reviewerName}>{rev.reviewer.displayName}</Text>
                    {rev.reviewer.isVerified && <VerifiedBadge size="compact" />}
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                {/* Stars */}
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= rev.rating ? 'star' : 'star-outline'}
                      size={12}
                      color="#C9A84C"
                    />
                  ))}
                </View>
              </View>

              {/* Garment Tag */}
              {rev.garment && (
                <View style={styles.verifiedPurchaseBadge}>
                  <Ionicons name="checkmark-circle" size={11} color={colors.forest} />
                  <Text style={styles.verifiedPurchaseText}>
                    VERIFIED PURCHASE: {rev.garment.title}
                  </Text>
                </View>
              )}

              {/* Comment */}
              {rev.comment && (
                <Text style={styles.reviewComment}>"{rev.comment}"</Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 30,
    marginBottom: 16,
  },
  backButton: {
    padding: 6,
  },
  topBarTitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.5,
  },
  topBarReport: {
    padding: 6,
  },
  miss: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14,
  },
  backBtn: {
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 84,
    height: 84,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  verifiedShieldCorner: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.charcoal,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    padding: 3,
  },
  displayName: {
    fontFamily: typography.mono,
    fontSize: 16,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  username: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tierBadge: {
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.cream,
  },
  tierBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  trustedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.forest,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  trustedBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  bioText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  messageCta: {
    width: '100%',
    backgroundColor: colors.charcoal,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  messageCtaText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 18,
    marginBottom: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  scorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  scoreBigCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(30,31,34,0.15)',
  },
  bigRatingText: {
    fontFamily: typography.headings,
    fontSize: 36,
    color: colors.charcoal,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 4,
  },
  totalReviewsText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
  },
  barsCol: {
    flex: 1,
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.charcoal,
    width: 20,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(30,31,34,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#C9A84C',
  },
  barCount: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    width: 16,
    textAlign: 'right',
  },
  reviewsSection: {
    gap: 12,
  },
  reviewsSectionTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  reviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.15)',
    padding: 14,
    gap: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewerName: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
  },
  reviewDate: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
  },
  verifiedPurchaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(40, 54, 24, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  verifiedPurchaseText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.forest,
  },
  reviewComment: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    lineHeight: 15,
  },
  emptyReviews: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.15)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyReviewsTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
  },
  emptyReviewsDesc: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },
});
