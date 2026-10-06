import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SolarIcon } from '../../../../src/components/common/SolarIcon';
import { colors, typography, textStyles } from '../../../../src/theme';
import { userService } from '../../../../src/services/userService';
import { messageService } from '../../../../src/services/messageService';
import { garmentService } from '../../../../src/services/garmentService';
import { useAuth } from '../../../../src/context/AuthContext';
import { KaphorImage } from '../../../../src/components/KaphorImage';
import { VerifiedBadge } from '../../../../src/components/common/VerifiedBadge';
import { safeBack, useBackHandler } from '../../../../src/utils/navigation';
import { Loader, Spinner } from '../../../../src/components/common/Loader';
import { peek, remember, hydrate } from '../../../../src/utils/swrCache';

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

const reviewKey = (r: ReviewItem) => r.id;
const listingKey = (g: any) => g.id;

const ReviewCard = React.memo(function ReviewCard({ rev }: { rev: ReviewItem }) {
  return (
    <View style={styles.reviewCarouselCard}>
      <View style={styles.reviewHeader}>
        <KaphorImage uri={rev.reviewer?.avatar || ''} style={styles.reviewerAvatar} contentFit="cover" width={40} recyclingKey={rev.id} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.reviewerNameRow}>
            <Text style={styles.reviewerName} numberOfLines={1}>{rev.reviewer.displayName}</Text>
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

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <SolarIcon
              key={s}
              name={s <= rev.rating ? 'star' : 'star-outline'}
              size={11}
              color={colors.gold}
            />
          ))}
        </View>
      </View>

      {/* Garment Tag */}
      {rev.garment && (
        <View style={styles.verifiedPurchaseBadge}>
          <SolarIcon name="checkmark-circle" size={10} color={colors.forest} />
          <Text style={styles.verifiedPurchaseText} numberOfLines={1}>
            {rev.garment.title}
          </Text>
        </View>
      )}

      {/* Comment */}
      {rev.comment && (
        <Text style={styles.reviewComment} numberOfLines={3}>
          "{rev.comment}"
        </Text>
      )}
    </View>
  );
});

const ListingTile = React.memo(function ListingTile({ item, onPress }: { item: any; onPress: (g: any) => void }) {
  const isRental = item.listingType === 'RENTAL' || (item.rentalPriceDay && Number(item.rentalPriceDay) > 0);
  const isSwap = item.listingType === 'ACCESSORY_SWAP' || item.listingType === 'SWAP';
  const thumbUri = item.images?.[0] || item.image;
  const priceTag = isRental
    ? `₹${Math.round(item.rentalPriceDay || item.price || 0)}/d`
    : isSwap
    ? 'SWAP'
    : `₹${Math.round(item.price || 0)}`;
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  return (
    <TouchableOpacity style={styles.imageTile} onPress={handlePress} activeOpacity={0.88}>
      {thumbUri ? (
        <KaphorImage uri={thumbUri} style={styles.imageTileImg} contentFit="cover" width={160} recyclingKey={item.id} />
      ) : (
        <View style={[styles.imageTileImg, styles.imagePlaceholder]}>
          <SolarIcon name="shirt-outline" size={28} color={colors.textMuted} />
        </View>
      )}

      {/* Minimal Top Corner Type Badge */}
      <View style={[
        styles.imageTileTypeBadge,
        isRental ? { backgroundColor: colors.ink } : isSwap ? { backgroundColor: colors.goldDark } : { backgroundColor: colors.charcoal }
      ]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.imageTileTypeBadgeText}>{isRental ? 'RENT' : isSwap ? 'SWAP' : 'BUY'}</Text>
      </View>

      {/* Clean Bottom Overlay for Price */}
      <View style={styles.imageTilePriceOverlay}>
        <Text style={styles.imageTilePriceText} numberOfLines={1}>
          {priceTag}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function PublicSellerProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  useBackHandler('/(tabs)/shop');
  const cacheKey = `seller:${userId}`;
  const cached = peek<{ profile: any; reviews: ReviewItem[] }>(cacheKey);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof userService.getPublicProfile>> | null>(cached?.profile ?? null);
  const [reviews, setReviews] = useState<ReviewItem[]>(cached?.reviews ?? []);
  const [loading, setLoading] = useState(!cached);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const [startingChat, setStartingChat] = useState(false);
  const [activeListingsTab, setActiveListingsTab] = useState<'ALL' | 'RENTAL' | 'SWAP' | 'SALE'>('ALL');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const listings = profile?.listings || [];

  const filteredListings = useMemo(() => {
    if (activeListingsTab === 'ALL') return listings;
    if (activeListingsTab === 'RENTAL') {
      return listings.filter((g: any) => g.listingType === 'RENTAL' || (g.rentalPriceDay && Number(g.rentalPriceDay) > 0));
    }
    if (activeListingsTab === 'SWAP') {
      return listings.filter((g: any) => g.listingType === 'ACCESSORY_SWAP' || g.listingType === 'SWAP');
    }
    return listings.filter((g: any) => g.listingType === 'SALE');
  }, [listings, activeListingsTab]);

  const handleNavigateToGarment = useCallback((g: any) => {
    if (!g?.id) return;
    if (g.listingType === 'RENTAL' || (g.rentalPriceDay && Number(g.rentalPriceDay) > 0)) {
      router.push(`/(tabs)/rental/${g.id}` as any);
    } else if (g.listingType === 'ACCESSORY_SWAP' || g.listingType === 'SWAP') {
      router.push(`/(tabs)/swap/${g.id}` as any);
    } else {
      router.push(`/(tabs)/shop/${g.id}` as any);
    }
  }, [router]);

  const renderReview = useCallback(({ item }: { item: ReviewItem }) => <ReviewCard rev={item} />, []);
  const renderListing = useCallback(
    ({ item }: { item: any }) => <ListingTile item={item} onPress={handleNavigateToGarment} />,
    [handleNavigateToGarment]
  );

  useEffect(() => {
    if (!userId) return;
    // Cache-first: paint any persisted copy right away, then refresh in the background
    hydrate<{ profile: any; reviews: ReviewItem[] }>(`seller:${userId}`).then((c) => {
      if (c && aliveRef.current) {
        setProfile((cur) => cur ?? c.profile);
        setReviews((cur) => (cur.length ? cur : c.reviews || []));
        setLoading(false);
      }
    });
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadData = async () => {
    try {
      let pData: any = null;
      let rData: any = [];

      // Independent requests run in parallel
      const [pRes, rRes] = await Promise.allSettled([
        userService.getPublicProfile(userId as string),
        userService.getUserReviews(userId as string),
      ]);
      if (pRes.status === 'fulfilled') pData = pRes.value;
      else console.warn('Public profile fetch failed, attempting fallback', pRes.reason);
      if (rRes.status === 'fulfilled') rData = rRes.value;
      if (!aliveRef.current) return;

      const cleanParam = String(userId || '').replace(/^@/, '');
      const isMe = user?.id === pData?.id || user?.id === userId || user?.username === cleanParam;

      if (!pData && isMe && user) {
        pData = {
          id: user.id,
          displayName: user.displayName || user.username || 'Kaphor Member',
          username: user.username,
          avatar: user.avatar,
          bio: (user as any)?.bio || null,
          tier: (user as any)?.tier || 'TOP RATED',
          isVerified: true,
          peerReviewCount: 0,
          peerReviewAvg: null,
          trustedSeller: true,
        };
      }

      let sellerListings = pData?.listings;

      // If backend profile has no listings array (e.g. older backend deployment or empty response)
      if (!sellerListings || sellerListings.length === 0) {
        if (isMe) {
          try {
            const myListings = await userService.getMyListings();
            if (Array.isArray(myListings) && myListings.length > 0) {
              sellerListings = myListings;
            }
          } catch (e) {
            console.warn('Failed to load myListings fallback', e);
          }
        }

        // Secondary fallback to browse catalog filtering by seller ID or username
        if (!sellerListings || sellerListings.length === 0) {
          try {
            const browse = await garmentService.getGarments();
            const targetSellerId = pData?.id || userId;
            const matching = (browse || []).filter(
              (g: any) =>
                g.sellerId === targetSellerId ||
                g.seller?.id === targetSellerId ||
                g.seller?.username === cleanParam
            );
            if (matching.length > 0) {
              sellerListings = matching;
            }
          } catch (e) {
            console.warn('Failed to load browse fallback', e);
          }
        }
      }

      if (!aliveRef.current) return;
      if (pData) {
        const full = { ...pData, listings: sellerListings || [] };
        setProfile(full);
        remember(`seller:${userId}`, { profile: full, reviews: rData || [] });
      }
      setReviews(rData || []);
    } catch (e) {
      console.error('Failed to load seller profile', e);
    } finally {
      if (aliveRef.current) setLoading(false);
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

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
            style={styles.backButton} 
            onPress={() => safeBack('/(tabs)/shop')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="chevron-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>SELLER SCORECARD</Text>
          <View style={{ width: 24 }} />
        </View>
        <Loader variant="seller" compact />
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
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.backBtnText}>GO BACK</Text>
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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
          style={styles.backButton} 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SolarIcon name="chevron-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>SELLER SCORECARD</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Shield" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.topBarReport} onPress={handleReport}>
          <SolarIcon name="shield-outline" size={20} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      {/* Seller Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.avatarWrap}>
          <KaphorImage uri={profile.avatar || ''} style={styles.avatar} contentFit="cover" />
          {profile.isVerified && (
            <View style={styles.verifiedShieldCorner}>
              <SolarIcon name="shield-checkmark" size={16} color={colors.gold} />
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
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.tierBadgeText}>{profile.tier || 'MEMBER'} TIER</Text>
            </View>
          )}

          {profile.trustedSeller && (
            <View style={styles.trustedBadge}>
              <SolarIcon name="ribbon" size={12} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.trustedBadgeText}>TOP RATED</Text>
            </View>
          )}
        </View>

        <Text style={styles.bioText}>
          {profile.bio || 'Verified member of the Kaphor Circular Fashion community.'}
        </Text>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.messageCta}
          onPress={handleMessageSeller}
          disabled={startingChat}
          activeOpacity={0.8}
        >
          {startingChat ? (
            <Spinner color={colors.cream} size="small" />
          ) : (
            <>
              <SolarIcon name="chatbubbles" size={16} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.messageCtaText}>MESSAGE SELLER DIRECTLY</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 1. Reputation & Peer Reviews Section (At Top, Horizontally Scrollable) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderBetween}>
          <View style={styles.sectionCardHeaderNoMargin}>
            <SolarIcon name="star" size={16} color={colors.gold} />
            <Text style={styles.sectionTitle}>REPUTATION & REVIEWS ({reviews.length})</Text>
          </View>

          <TouchableOpacity
            style={styles.ratingSummaryPill}
            onPress={() => setShowBreakdown((prev) => !prev)}
            activeOpacity={0.7}
          >
            <SolarIcon name="star" size={12} color={colors.gold} />
            <Text style={styles.ratingSummaryScore}>{avgRating}</Text>
            <Text style={styles.ratingSummaryCount}>({totalReviews})</Text>
            <SolarIcon
              name={showBreakdown ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={colors.charcoal}
            />
          </TouchableOpacity>
        </View>

        {/* Optional Collapsible Scorecard Breakdown */}
        {showBreakdown && (
          <View style={styles.breakdownContainer}>
            <View style={styles.scorecardRow}>
              <View style={styles.scoreBigCol}>
                <Text style={styles.bigRatingText}>{avgRating}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <SolarIcon key={s} name="star" size={13} color={colors.gold} />
                  ))}
                </View>
                <Text style={styles.totalReviewsText}>
                  {totalReviews} verified {totalReviews === 1 ? 'sale' : 'sales'}
                </Text>
              </View>

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
        )}

        {/* Scrollable Reviews Row */}
        {reviews.length === 0 ? (
          <View style={styles.compactEmptyCard}>
            <SolarIcon name="chatbox-ellipses-outline" size={22} color={colors.textMuted} />
            <Text style={styles.compactEmptyText}>
              No peer reviews recorded yet. Verified reviews appear here after completed transactions.
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={reviews}
            keyExtractor={reviewKey}
            renderItem={renderReview}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalReviewsScroll}
            initialNumToRender={4}
            maxToRenderPerBatch={6}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}
      </View>

      {/* 2. Wardrobe & Curated Pieces Section (Scrollable of Just Images) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderBetween}>
          <View style={styles.sectionCardHeaderNoMargin}>
            <SolarIcon name="shirt-outline" size={16} color={colors.charcoal} />
            <Text style={styles.sectionTitle}>CLOSET ({listings.length})</Text>
          </View>
        </View>

        {/* Tab Filters */}
        <View style={styles.listingsTabRow}>
          {(['ALL', 'RENTAL', 'SWAP', 'SALE'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.listingTabBtn, activeListingsTab === t && styles.listingTabBtnActive]}
              onPress={() => setActiveListingsTab(t)}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.listingTabText, activeListingsTab === t && styles.listingTabTextActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredListings.length === 0 ? (
          <View style={styles.compactEmptyCard}>
            <SolarIcon name="sparkles-outline" size={22} color={colors.textMuted} />
            <Text style={styles.compactEmptyText}>
              No active {activeListingsTab === 'ALL' ? '' : activeListingsTab.toLowerCase()} pieces listed.
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={filteredListings}
            keyExtractor={listingKey}
            renderItem={renderListing}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageGalleryScroll}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
          />
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
    ...textStyles.screenTitle,
    color: colors.charcoal,
  },
  topBarReport: {
    padding: 6,
  },
  miss: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 15,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
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
    borderColor: colors.gold,
    padding: 3,
  },
  displayName: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 16,
    color: colors.charcoal,
  },
  username: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.cream,
  },
  bioText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    textAlign: 'center',
    lineHeight: 21,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
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
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  sectionCardHeaderNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  ratingSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  ratingSummaryScore: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
  },
  ratingSummaryCount: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  breakdownContainer: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  scorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreBigCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 14,
    borderRightWidth: 1,
    borderRightColor: colors.overlayLight,
  },
  bigRatingText: {
    fontFamily: typography.headings,
    fontSize: 32,
    color: colors.charcoal,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 4,
  },
  totalReviewsText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
    width: 20,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.overlayLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  barCount: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    width: 16,
    textAlign: 'right',
  },
  compactEmptyCard: {
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    padding: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  compactEmptyText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 23,
  },
  horizontalReviewsScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  reviewCarouselCard: {
    width: 260,
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    padding: 12,
    borderRadius: 6,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  reviewDate: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.textMuted,
  },
  verifiedPurchaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderRadius: 2,
    maxWidth: '100%',
  },
  verifiedPurchaseText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.forest,
  },
  reviewComment: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
  },
  listingsTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  listingTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    backgroundColor: colors.white,
  },
  listingTabBtnActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  listingTabText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.textMuted,
  },
  listingTabTextActive: {
    color: colors.cream,
    fontWeight: '900',
  },
  imageGalleryScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  imageTile: {
    width: 135,
    height: 180,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  imageTileImg: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageTileTypeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
    zIndex: 2,
  },
  imageTileTypeBadgeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.white,
  },
  imageTilePriceOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  imageTilePriceText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
});
