import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../src/context/AuthContext';
import { userService } from '../../src/services/userService';
import { garmentService } from '../../src/services/garmentService';
import { aiService } from '../../src/services/aiService';
import { trackingService } from '../../src/services/trackingService';
import { impactService } from '../../src/services/impactService';
import api from '../../src/services/api';

import { KaphorImage } from '../../src/components/KaphorImage';
import { Header } from '../../src/components/common/Header';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { colors, typography } from '../../src/theme';
import { hapticFeedback } from '../../src/utils/haptics';
import { AESTHETIC_PROFILES, AestheticId } from '../../src/services/aestheticRecommendationService';
import { AESTHETIC_IMAGES } from '../(auth)/style-quiz';

type ProfileTab = 'ACTIVITY' | 'CLOSET' | 'ACCOUNT';

export default function ProfileScreen() {
  const { user, signOut, setUser } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ProfileTab>('ACTIVITY');
  const [profile, setProfile] = useState<any>(null);
  const [styleProfile, setStyleProfile] = useState<any>(null);
  const [savedAssets, setSavedAssets] = useState<any[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState<number>(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);
  const [impactData, setImpactData] = useState<any>(null);
  const [updatingAvatar, setUpdatingAvatar] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [fullscreenAesthetic, setFullscreenAesthetic] = useState<string | null>(null);
  const [isArchetypeExpanded, setIsArchetypeExpanded] = useState<boolean>(false);
  const [editingBio, setEditingBio] = useState<boolean>(false);
  const [bioInput, setBioInput] = useState<string>('');
  const [savingBio, setSavingBio] = useState<boolean>(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await userService.getMe();
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  const fetchSavedAssets = useCallback(async () => {
    try {
      const data = await garmentService.getWishlist();
      setSavedAssets(data || []);
    } catch {
      setSavedAssets([]);
    }
  }, []);

  const fetchStyleProfile = useCallback(async () => {
    try {
      const data = await aiService.getStyleProfile();
      setStyleProfile(data);
    } catch {
      setStyleProfile(null);
    }
  }, []);

  const fetchImpact = useCallback(async () => {
    try {
      const data = await impactService.getMyImpact();
      setImpactData(data);
    } catch {
      setImpactData(null);
    }
  }, []);

  const loadAllData = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchProfile(),
        fetchSavedAssets(),
        fetchStyleProfile(),
        fetchImpact(),
        api
          .get('/notifications?limit=30')
          .then((res) => {
            const list = res.data?.data || [];
            const unread = list.filter((n: any) => !n.isRead).length;
            setUnreadNotifs(unread);
          })
          .catch(() => {}),
        trackingService
          .getSummary()
          .then((sum) => {
            if (sum && typeof sum.totalActive === 'number') {
              setActiveOrdersCount(sum.totalActive);
            }
          })
          .catch(() => {}),
      ]);
    } finally {
      if (isPull) setRefreshing(false);
    }
  }, [fetchProfile, fetchSavedAssets, fetchStyleProfile, fetchImpact]);

  useEffect(() => {
    loadAllData(false);
  }, [loadAllData]);

  useFocusEffect(
    useCallback(() => {
      loadAllData(false);
    }, [loadAllData])
  );

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photos permission is required to update profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setUpdatingAvatar(true);
        const res = await userService.updateAvatar(result.assets[0].uri);
        const newAvatar = res?.avatar;
        if (newAvatar) {
          if (user) {
            setUser({ ...user, avatar: newAvatar, avatarUrl: newAvatar });
          }
          setProfile((prev: any) => (prev ? { ...prev, avatar: newAvatar } : prev));
          Alert.alert('Success', 'Profile photo updated successfully!');
        }
      }
    } catch (e: any) {
      console.error('Failed to update avatar', e);
      Alert.alert('Upload Failed', e?.response?.data?.message || e?.message || 'Could not update profile photo.');
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your Kaphor account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          hapticFeedback.medium();
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const navigateTo = (route: string) => {
    hapticFeedback.light();
    router.push(route as any);
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      const res = await userService.updateMe({ bio: bioInput.trim() });
      if (res) {
        setProfile((prev: any) => (prev ? { ...prev, bio: res.bio ?? bioInput.trim() } : prev));
        if (user) {
          setUser({ ...user, bio: res.bio ?? bioInput.trim() } as any);
        }
      }
      setEditingBio(false);
      Alert.alert('Bio Updated', 'Your curator bio has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update bio.');
    } finally {
      setSavingBio(false);
    }
  };

  const displayName = profile?.displayName || user?.displayName || 'Curator';
  const role = profile?.role || user?.role || 'MEMBER';
  const avatar = profile?.avatar || (user as any)?.avatar || user?.avatarUrl;
  const isVerified = Boolean(profile?.isVerified ?? (user as any)?.isVerified);
  const bio = profile?.bio ?? (user as any)?.bio ?? '';

  const getInitials = (name: string) => {
    if (!name) return 'MB';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  const initials = getInitials(displayName);

  const carbonSaved = impactData?.impactRecord?.carbonSavedKg ?? 0;
  const waterSaved = impactData?.impactRecord?.waterSavedL ?? 0;
  const itemsCirculated = impactData?.impactRecord?.itemsCirculated ?? 0;
  const currentTier = impactData?.tier || 'SEEDLING CURATOR';
  const progressPercent = Math.min(100, Math.max(0, impactData?.progressPercentage ?? 25));

  return (
    <View style={styles.container}>
      <Header
        title="CURATOR ATELIER"
        rightElement={
          <TouchableOpacity onPress={handleLogout} style={styles.headerLogoutBtn} hitSlop={12}>
            <Ionicons name="log-out-outline" size={20} color={colors.charcoal} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              hapticFeedback.light();
              loadAllData(true);
            }}
            tintColor={colors.crimson}
            colors={[colors.crimson]}
          />
        }
      >
        {/* ── 1. USER IDENTITY ATELIER HERO CARD ─────────────────────── */}
        <View style={styles.identityHeroCard}>
          {/* Accent top rule */}
          <View style={styles.heroTopAccent} />

          <View style={styles.identityRow}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handlePickAvatar}
              disabled={updatingAvatar}
              activeOpacity={0.85}
            >
              {avatar ? (
                <KaphorImage uri={avatar} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarMonogram]}>
                  <Text style={styles.avatarMonogramText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraOverlayBadge}>
                {updatingAvatar ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={11} color={colors.white} />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.identityDetails}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {displayName}
                </Text>
                {isVerified && <VerifiedBadge size="compact" />}
              </View>

              <Text style={styles.emailText} numberOfLines={1}>
                {user?.email || profile?.email || 'curator@kaphor.luxury'}
              </Text>

              <View style={styles.memberTagRow}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>
                    {role === 'ADMIN' ? 'ADMIN' : isVerified ? 'VERIFIED CURATOR' : 'CIRCULAR MEMBER'}
                  </Text>
                </View>
                <View style={styles.tierPill}>
                  <Ionicons name="sparkles" size={10} color={colors.charcoal} />
                  <Text style={styles.tierText}>{currentTier}</Text>
                </View>
              </View>

              {/* Quick Actions alongside profile info */}
              <View style={styles.topProfileQuickActions}>
                <TouchableOpacity
                  style={styles.topQuickBtn}
                  onPress={() => router.push('/my-listings' as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shirt-outline" size={11} color={colors.charcoal} />
                  <Text style={styles.topQuickBtnText}>MY LISTINGS</Text>
                  <View style={styles.topQuickBadge}>
                    <Text style={styles.topQuickBadgeText}>{profile?.stats?.listings || 0}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topQuickBtn}
                  onPress={() => router.push('/(tabs)/orders?tab=orders' as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cube-outline" size={11} color={colors.charcoal} />
                  <Text style={styles.topQuickBtnText}>MY ORDERS</Text>
                  {activeOrdersCount > 0 ? (
                    <View style={[styles.topQuickBadge, { backgroundColor: colors.crimson }]}>
                      <Text style={[styles.topQuickBadgeText, { color: colors.white }]}>{activeOrdersCount}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>

              {/* Curator Bio */}
              <View style={styles.bioContainer}>
                <Text style={styles.bioText} numberOfLines={3}>
                  {bio || 'Curating timeless archives with conscious circular care.'}
                </Text>
                <TouchableOpacity
                  style={styles.editBioBtn}
                  onPress={() => {
                    setBioInput(bio);
                    setEditingBio(true);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="pencil-outline" size={11} color={colors.charcoal} />
                  <Text style={styles.editBioBtnText}>EDIT BIO</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Core Metric Bar */}
          <View style={styles.metricBar}>
            <TouchableOpacity
              style={styles.metricItem}
              onPress={() => navigateTo('/(tabs)/orders?tab=orders')}
              activeOpacity={0.75}
            >
              <Text style={styles.metricValue}>
                {activeOrdersCount > 0 ? `${activeOrdersCount} ACTIVE` : '0'}
              </Text>
              <Text style={styles.metricLabel}>ORDERS</Text>
            </TouchableOpacity>

            <View style={styles.metricDivider} />

            <TouchableOpacity
              style={styles.metricItem}
              onPress={() => navigateTo('/my-listings')}
              activeOpacity={0.75}
            >
              <Text style={styles.metricValue}>{profile?.stats?.listings || 0}</Text>
              <Text style={styles.metricLabel}>MY LISTINGS</Text>
            </TouchableOpacity>

            <View style={styles.metricDivider} />

            <TouchableOpacity
              style={styles.metricItem}
              onPress={() => navigateTo('/profile/saved')}
              activeOpacity={0.75}
            >
              <Text style={styles.metricValue}>{savedAssets.length}</Text>
              <Text style={styles.metricLabel}>SAVED VAULT</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 1.5 STYLE ARCHETYPE DOSSIER CARD ───────────────────────── */}
        {(() => {
          const rawAesthetic = (profile?.styleAesthetic || user?.styleAesthetic || styleProfile?.styleAesthetic || '') as string;
          let matchedAestheticId = Object.keys(AESTHETIC_PROFILES).find(
            (k) => k.toLowerCase() === rawAesthetic.trim().toLowerCase()
          ) as AestheticId | undefined;

          // Seamless mapping for legacy values (e.g. LUXURY -> Sade Girl)
          if (!matchedAestheticId && rawAesthetic) {
            const LEGACY_MAP: Record<string, AestheticId> = {
              'LUXURY': 'Sade Girl',
              'QUIET LUXURY': 'Sade Girl',
              'MINIMALIST': 'Business Comfort',
              'STREETWEAR': 'Acubi',
              'CULTURAL': 'Minimal Desi',
              'ETHNIC': 'Maximal Desi',
              'BOLD': 'Rockstar Girlfriend',
              'DARK': 'Dark Academia',
              'BOHO': 'Cottagecore',
              'PREPPY': 'Office Siren',
              'ARTISANAL': 'Vintage',
            };
            matchedAestheticId = LEGACY_MAP[rawAesthetic.trim().toUpperCase()] || 'Sade Girl';
          }

          const aestheticMeta = matchedAestheticId ? AESTHETIC_PROFILES[matchedAestheticId] : null;
          const isAestheticVerified = Boolean(matchedAestheticId || rawAesthetic);

          return (
            <View style={styles.aestheticCard}>
              <TouchableOpacity
                style={styles.aestheticCardHeader}
                onPress={() => {
                  hapticFeedback.light();
                  setIsArchetypeExpanded((prev) => !prev);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.aestheticHeaderLeft}>
                  <View style={styles.aestheticIconBubble}>
                    <Ionicons name="sparkles" size={13} color={colors.white} />
                  </View>
                  <View>
                    <Text style={styles.aestheticCardLabel}>STYLE ARCHETYPE DOSSIER</Text>
                    <Text style={styles.aestheticCardStatus}>
                      {isAestheticVerified
                        ? `${(aestheticMeta?.name || 'SADE GIRL').toUpperCase()} · TAP TO ${isArchetypeExpanded ? 'COLLAPSE' : 'EXPAND'}`
                        : 'AESTHETIC QUIZ PENDING'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.retakeQuizBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push('/(auth)/style-quiz');
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.retakeQuizText}>
                      {isAestheticVerified ? 'RETAKE' : 'TAKE QUIZ →'}
                    </Text>
                  </TouchableOpacity>
                  <Ionicons
                    name={isArchetypeExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.cream}
                  />
                </View>
              </TouchableOpacity>

              {/* Compact Collapsed Preview Bar */}
              {isAestheticVerified && !isArchetypeExpanded && (
                <TouchableOpacity
                  style={styles.aestheticCollapsedBar}
                  onPress={() => {
                    hapticFeedback.light();
                    setIsArchetypeExpanded(true);
                  }}
                  activeOpacity={0.88}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.aestheticCollapsedName}>
                        {(aestheticMeta?.name || 'SADE GIRL').toUpperCase()}
                      </Text>
                      <View style={styles.matchScoreBadgeCompact}>
                        <Text style={styles.matchScoreTextCompact}>VERIFIED</Text>
                      </View>
                    </View>
                    <Text style={styles.aestheticCollapsedTagline} numberOfLines={1}>
                      {aestheticMeta?.tagline || 'Moody, understated streetwear meets sultry minimalism'}
                    </Text>
                  </View>
                  <View style={styles.expandDossierBtn}>
                    <Text style={styles.expandDossierBtnText}>VIEW DOSSIER ▾</Text>
                  </View>
                </TouchableOpacity>
              )}

              {isAestheticVerified && isArchetypeExpanded ? (
                <View style={styles.aestheticBody}>
                  {/* Title & Match Score */}
                  <View style={styles.aestheticTitleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aestheticNameLarge}>
                        {(aestheticMeta?.name || 'SADE GIRL').toUpperCase()}
                      </Text>
                      <Text style={styles.aestheticTagline}>
                        {aestheticMeta?.tagline || 'Moody, understated streetwear meets sultry minimalism'}
                      </Text>
                    </View>
                    <View style={styles.matchScoreBadge}>
                      <Text style={styles.matchScoreText}>VERIFIED ARCHETYPE</Text>
                    </View>
                  </View>

                  {/* Deep Narrative Description */}
                  {Boolean(aestheticMeta?.description) && (
                    <Text style={styles.aestheticDescriptionText}>
                      {aestheticMeta?.description}
                    </Text>
                  )}

                  {/* Large Lookbook Moodboard Poster (Tap for Full-Screen) */}
                  {AESTHETIC_IMAGES[aestheticMeta?.id || 'Sade Girl'] && (
                    <TouchableOpacity
                      style={styles.profileAestheticHeroWrap}
                      onPress={() => setFullscreenAesthetic(aestheticMeta?.id || 'Sade Girl')}
                      activeOpacity={0.92}
                    >
                      <Image
                        source={AESTHETIC_IMAGES[aestheticMeta?.id || 'Sade Girl']}
                        style={styles.profileAestheticHeroImage}
                        resizeMode="contain"
                      />
                      <View style={styles.profileTapToExpandOverlay}>
                        <Ionicons name="expand" size={13} color={colors.cream} />
                        <Text style={styles.profileTapToExpandText}>TAP FOR FULL-SCREEN MOODBOARD</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Complete Archival Essentials Checklist */}
                  {aestheticMeta?.essentials && aestheticMeta.essentials.length > 0 && (
                    <View style={styles.profileEssentialsSection}>
                      <Text style={styles.profileEssentialsHeading}>■ ARCHIVAL ESSENTIALS</Text>
                      <View style={styles.profileEssentialsList}>
                        {aestheticMeta.essentials.map((item, idx) => (
                          <View key={idx} style={styles.profileEssentialRow}>
                            <Text style={styles.profileBulletDot}>•</Text>
                            <Text style={styles.profileEssentialItemText}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Close Second Archetype (if available in profile) */}
                  {Boolean(styleProfile?.secondaryAesthetic) && (
                    <View style={styles.profileSecondaryCard}>
                      <View style={styles.profileSecondaryHeader}>
                        <Text style={styles.profileSecondaryBadge}>CLOSE SECOND ARCHETYPE</Text>
                        <Text style={styles.profileSecondaryMatch}>SECONDARY VIBE</Text>
                      </View>
                      <Text style={styles.profileSecondaryName}>
                        {styleProfile.secondaryAesthetic.toUpperCase()}
                      </Text>
                      {Boolean(AESTHETIC_PROFILES[styleProfile.secondaryAesthetic as AestheticId]?.tagline) && (
                        <Text style={styles.profileSecondaryTagline}>
                          {AESTHETIC_PROFILES[styleProfile.secondaryAesthetic as AestheticId].tagline}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.profileAestheticActions}>
                    <TouchableOpacity
                      style={styles.exploreAestheticBtn}
                      onPress={() => router.push({ pathname: '/(tabs)/shop', params: { aesthetic: aestheticMeta?.id || rawAesthetic } } as any)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.exploreAestheticBtnText}>
                        EXPLORE {aestheticMeta?.name?.toUpperCase() || 'CURATED'} ARCHIVE
                      </Text>
                      <Ionicons name="arrow-forward" size={13} color={colors.cream} />
                    </TouchableOpacity>

                    {AESTHETIC_IMAGES[aestheticMeta?.id || 'Sade Girl'] && (
                      <TouchableOpacity
                        style={styles.profileFullscreenBtn}
                        onPress={() => setFullscreenAesthetic(aestheticMeta?.id || 'Sade Girl')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="scan-outline" size={14} color={colors.charcoal} />
                        <Text style={styles.profileFullscreenBtnText}>INSPECT FULL MOODBOARD POSTER</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Quick Collapse Button at Bottom */}
                  <TouchableOpacity
                    style={styles.collapseDossierBtn}
                    onPress={() => {
                      hapticFeedback.light();
                      setIsArchetypeExpanded(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chevron-up" size={13} color={colors.charcoal} />
                    <Text style={styles.collapseDossierBtnText}>COLLAPSE DOSSIER ▴</Text>
                  </TouchableOpacity>
                </View>
              ) : !isAestheticVerified ? (
                <View style={styles.aestheticPendingBody}>
                  <Text style={styles.pendingAestheticTitle}>Discover Your Style Archetype</Text>
                  <Text style={styles.pendingAestheticDesc}>
                    Take our 8-question Aesthetic Match questionnaire to unlock your personal fashion profile, tailored circular recommendations, and curated wardrobe staples.
                  </Text>
                  <TouchableOpacity
                    style={styles.startQuizCta}
                    onPress={() => router.push('/(auth)/style-quiz')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.startQuizCtaText}>START AESTHETIC QUIZ →</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })()}

        {/* ── 2. CIRCULAR IMPACT PREVIEW CARD ───────────────────────── */}
        <TouchableOpacity
          style={styles.impactCard}
          onPress={() => navigateTo('/(tabs)/impact')}
          activeOpacity={0.88}
        >
          <View style={styles.impactHeader}>
            <View style={styles.impactTitleRow}>
              <View style={styles.impactIconBubble}>
                <Ionicons name="leaf" size={14} color={colors.white} />
              </View>
              <View>
                <Text style={styles.impactCardTitle}>CIRCULAR DOSSIER</Text>
                <Text style={styles.impactTierSubtitle}>{currentTier}</Text>
              </View>
            </View>
            <View style={styles.impactActionBadge}>
              <Text style={styles.impactActionText}>VIEW DOSSIER</Text>
              <Ionicons name="arrow-forward" size={11} color={colors.forest} />
            </View>
          </View>

          {/* Progress bar towards next tier */}
          <View style={styles.tierProgressTrack}>
            <View style={[styles.tierProgressFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* 3 Environmental Multipliers */}
          <View style={styles.impactMetricsGrid}>
            <View style={styles.impactMetricCol}>
              <Text style={styles.impactMetricNum}>{carbonSaved.toFixed(1)} <Text style={styles.impactUnit}>KG</Text></Text>
              <Text style={styles.impactMetricLabel}>CO₂ SAVED</Text>
            </View>

            <View style={styles.impactDividerCol} />

            <View style={styles.impactMetricCol}>
              <Text style={styles.impactMetricNum}>{waterSaved.toLocaleString()} <Text style={styles.impactUnit}>L</Text></Text>
              <Text style={styles.impactMetricLabel}>WATER SAVED</Text>
            </View>

            <View style={styles.impactDividerCol} />

            <View style={styles.impactMetricCol}>
              <Text style={styles.impactMetricNum}>{itemsCirculated} <Text style={styles.impactUnit}>PCS</Text></Text>
              <Text style={styles.impactMetricLabel}>CIRCULATED</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── 3. SEGMENTED TABS (Sleek Luxury Brutalist) ───────────── */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'ACTIVITY' && styles.segmentTabActive]}
            onPress={() => {
              hapticFeedback.light();
              setActiveTab('ACTIVITY');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cube"
              size={14}
              color={activeTab === 'ACTIVITY' ? colors.white : colors.charcoal}
            />
            <Text
              style={[styles.segmentTabText, activeTab === 'ACTIVITY' && styles.segmentTabTextActive]}
            >
              ACTIVITY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'CLOSET' && styles.segmentTabActive]}
            onPress={() => {
              hapticFeedback.light();
              setActiveTab('CLOSET');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="shirt"
              size={14}
              color={activeTab === 'CLOSET' ? colors.white : colors.charcoal}
            />
            <Text
              style={[styles.segmentTabText, activeTab === 'CLOSET' && styles.segmentTabTextActive]}
            >
              WARDROBE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'ACCOUNT' && styles.segmentTabActive]}
            onPress={() => {
              hapticFeedback.light();
              setActiveTab('ACCOUNT');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="settings"
              size={14}
              color={activeTab === 'ACCOUNT' ? colors.white : colors.charcoal}
            />
            <Text
              style={[styles.segmentTabText, activeTab === 'ACCOUNT' && styles.segmentTabTextActive]}
            >
              ACCOUNT
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. TAB 1: ACTIVITY ───────────────────────────────────── */}
        {activeTab === 'ACTIVITY' && (
          <View style={styles.optionsList}>
            {/* My Orders */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/(tabs)/orders?tab=orders')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="cube-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>MY ORDERS</Text>
                <Text style={styles.cardSubtitle}>Track active shipments, rentals & deliveries</Text>
              </View>
              {activeOrdersCount > 0 && (
                <View style={styles.badgePillActive}>
                  <Text style={styles.badgePillActiveText}>{activeOrdersCount} ACTIVE</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Occasional Rentals */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/(tabs)/rental')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="time-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>OCCASIONAL RENTALS</Text>
                <Text style={styles.cardSubtitle}>Explore luxury couture leases & approval queue</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Fair Swaps */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/(tabs)/swap')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="swap-horizontal-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>CIRCULAR SWAPS</Text>
                <Text style={styles.cardSubtitle}>Trade luxury accessories with deposit escrow</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Payment History */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/(tabs)/shop/payment-history')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="receipt-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>PAYMENT LEDGER</Text>
                <Text style={styles.cardSubtitle}>Invoices, security deposits & transactions</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── 5. TAB 2: WARDROBE ───────────────────────────────────── */}
        {activeTab === 'CLOSET' && (
          <View style={styles.optionsList}>
            {/* Digital Closet */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/profile/wardrobe')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="shirt-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>DIGITAL CLOSET</Text>
                <Text style={styles.cardSubtitle}>Curate personal archive & log wear lifecycle</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* My Listings */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/my-listings')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="pricetag-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>MY LISTINGS</Text>
                <Text style={styles.cardSubtitle}>Active pieces listed for sale or rent</Text>
              </View>
              <View style={styles.countBadgeNeutral}>
                <Text style={styles.countBadgeNeutralText}>{profile?.stats?.listings || 0} ITEMS</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Saved Items */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/profile/saved')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="heart-outline" size={18} color={colors.crimson} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>SAVED VAULT</Text>
                <Text style={styles.cardSubtitle}>Wishlist & curated watched archive pieces</Text>
              </View>
              <View style={styles.countBadgeNeutral}>
                <Text style={styles.countBadgeNeutralText}>{savedAssets.length} SAVED</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Style Quiz */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/(auth)/style-quiz')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="sparkles-outline" size={18} color={colors.gold} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>AI STYLE DOSSIER</Text>
                <Text style={styles.cardSubtitle}>Gemini aesthetic preferences & fit silhouette</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── 6. TAB 3: ACCOUNT ────────────────────────────────────── */}
        {activeTab === 'ACCOUNT' && (
          <View style={styles.optionsList}>
            {/* Identity Verification */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/profile/verify-identity')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>ID VERIFICATION</Text>
                <Text style={styles.cardSubtitle}>Government KYC & authenticity trust badge</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  isVerified ? { backgroundColor: colors.forest } : { backgroundColor: colors.gold },
                ]}
              >
                <Text style={styles.statusPillText}>{isVerified ? 'VERIFIED' : 'PENDING'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Delivery Addresses */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/profile/addresses')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="location-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>SHIPPING ADDRESSES</Text>
                <Text style={styles.cardSubtitle}>Delivery destinations & dispatch origins</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Bank Payouts */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/profile/payout')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="wallet-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>BANK & PAYOUTS</Text>
                <Text style={styles.cardSubtitle}>Razorpay account link & earnings transfers</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Community Reviews */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/reviews')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="star-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>COMMUNITY REVIEWS</Text>
                <Text style={styles.cardSubtitle}>Ratings from buyers, renters & swap peers</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/(tabs)/notifications')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="notifications-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>NOTIFICATIONS</Text>
                <Text style={styles.cardSubtitle}>Order alerts, rental requests & price drops</Text>
              </View>
              {unreadNotifs > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadNotifs}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => navigateTo('/settings')}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="options-outline" size={18} color={colors.charcoal} />
              </View>
              <View style={styles.cardInfoCol}>
                <Text style={styles.cardTitle}>SETTINGS & SECURITY</Text>
                <Text style={styles.cardSubtitle}>Security credentials, password & app preferences</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Admin Override */}
            {role === 'ADMIN' && (
              <TouchableOpacity
                style={[styles.cardItem, { borderColor: colors.crimson }]}
                onPress={() => navigateTo('/(admin)')}
                activeOpacity={0.85}
              >
                <View style={[styles.cardIconBox, { backgroundColor: 'rgba(168,34,34,0.08)' }]}>
                  <Ionicons name="shield" size={18} color={colors.crimson} />
                </View>
                <View style={styles.cardInfoCol}>
                  <Text style={[styles.cardTitle, { color: colors.crimson }]}>ADMIN CONSOLE</Text>
                  <Text style={styles.cardSubtitle}>Platform management, KYC approvals & metrics</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.crimson} />
              </TouchableOpacity>
            )}

            {/* Sign Out Button */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={16} color={colors.crimson} />
              <Text style={styles.logoutButtonText}>SIGN OUT OF ATELIER</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* FULL SCREEN LIGHTBOX MODAL IN PROFILE */}
      <Modal
        visible={Boolean(fullscreenAesthetic)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullscreenAesthetic(null)}
      >
        <View style={styles.profileModalBackdrop}>
          {/* Header */}
          <View style={styles.profileModalTopBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileModalTitle}>
                {fullscreenAesthetic?.toUpperCase()}
              </Text>
              <Text style={styles.profileModalSubtitle}>
                AESTHETIC STYLE GUIDE & MOODBOARD POSTER
              </Text>
            </View>
            <TouchableOpacity
              style={styles.profileModalCloseBtn}
              onPress={() => setFullscreenAesthetic(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={26} color={colors.cream} />
            </TouchableOpacity>
          </View>

          {/* Centered Moodboard Poster */}
          {Boolean(fullscreenAesthetic && AESTHETIC_IMAGES[fullscreenAesthetic]) && (
            <View style={styles.profileModalImageContainer}>
              <Image
                source={AESTHETIC_IMAGES[fullscreenAesthetic!]}
                style={styles.profileModalImage}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Bottom Bar */}
          <View style={styles.profileModalBottomBar}>
            <TouchableOpacity
              style={styles.profileModalDoneBtn}
              onPress={() => setFullscreenAesthetic(null)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.charcoal} />
              <Text style={styles.profileModalDoneText}>CLOSE FULL SCREEN VIEW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Bio Modal */}
      <Modal
        visible={editingBio}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingBio(false)}
      >
        <TouchableOpacity
          style={styles.profileModalBackdrop}
          activeOpacity={1}
          onPress={() => setEditingBio(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.bioModalCard}>
            <View style={styles.bioModalHeader}>
              <Text style={styles.bioModalTitle}>EDIT CURATOR BIO</Text>
              <TouchableOpacity onPress={() => setEditingBio(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.bioTextInput}
              placeholder="Write a brief bio about your style perspective..."
              placeholderTextColor={colors.textMuted}
              value={bioInput}
              onChangeText={setBioInput}
              multiline
              maxLength={200}
            />

            <View style={styles.bioModalActions}>
              <TouchableOpacity
                style={styles.bioCancelBtn}
                onPress={() => setEditingBio(false)}
              >
                <Text style={styles.bioCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bioSaveBtn}
                onPress={handleSaveBio}
                disabled={savingBio}
              >
                {savingBio ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.bioSaveText}>SAVE BIO</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES (Elevated Luxury Brutalist Atelier Theme)
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 80,
  },
  headerLogoutBtn: {
    padding: 6,
  },

  // ── 1. Hero Identity Card ──────────────────────────────────────
  identityHeroCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  heroTopAccent: {
    height: 4,
    backgroundColor: colors.charcoal,
    width: '100%',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlayBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.charcoal,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 4,
  },
  identityDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: 20,
    fontFamily: typography.headings,
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  emailText: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.textSecond,
    marginTop: 2,
    marginBottom: 6,
  },
  memberTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rolePill: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  rolePillText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  topProfileQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  topQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 2,
  },
  topQuickBtnText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.6,
  },
  topQuickBadge: {
    backgroundColor: colors.charcoal,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topQuickBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.white,
  },
  establishedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
  },
  establishedText: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── Metric Quick Bar ───────────────────────────────────────────
  metricBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgMuted,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1.5,
    height: 22,
    backgroundColor: colors.charcoal,
    opacity: 0.4,
  },
  metricValue: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  metricLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.8,
  },

  // ── 2. Circular Impact Preview Card ────────────────────────────
  impactCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.forest,
    padding: 14,
    marginBottom: 14,
    shadowColor: colors.forest,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 3,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  impactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  impactIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.forest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  impactCardTitle: {
    fontFamily: typography.headings,
    fontSize: 15,
    color: colors.forest,
    letterSpacing: 0.8,
  },
  impactTierSubtitle: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.charcoal,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  impactActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(30,59,47,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,59,47,0.25)',
  },
  impactActionText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  tierProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(30,59,47,0.12)',
    marginBottom: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tierProgressFill: {
    height: '100%',
    backgroundColor: colors.forest,
  },
  impactMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7EE',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(30,59,47,0.15)',
  },
  impactMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  impactDividerCol: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(30,59,47,0.2)',
  },
  impactMetricNum: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  impactUnit: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.forest,
    fontWeight: '800',
  },
  impactMetricLabel: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 1,
    letterSpacing: 0.6,
  },

  // ── 3. Segmented Navigation Tabs ───────────────────────────────
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 3,
    marginBottom: 12,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentTabActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  segmentTabText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  segmentTabTextActive: {
    color: colors.white,
  },

  // ── 4. Options List & Cards ────────────────────────────────────
  optionsList: {
    gap: 8,
    marginBottom: 16,
  },
  cardItem: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    gap: 12,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    backgroundColor: '#FAF7EE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  cardInfoCol: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.6,
  },
  cardSubtitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 13,
  },
  badgePillActive: {
    backgroundColor: colors.forest,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  badgePillActiveText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  countBadgeNeutral: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeNeutralText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  statusPillText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  unreadBadge: {
    backgroundColor: colors.crimson,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
  },

  // ── 5. Sign Out Button ─────────────────────────────────────────
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.crimson,
    paddingVertical: 12,
    marginTop: 8,
    shadowColor: colors.crimson,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 2,
  },
  logoutButtonText: {
    color: colors.crimson,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // ── 6. Style Archetype Dossier Card ────────────────────────────
  aestheticCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 8,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  aestheticCardHeader: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aestheticHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aestheticIconBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aestheticCardLabel: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  aestheticCardStatus: {
    color: 'rgba(245, 240, 232, 0.65)',
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  retakeQuizBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retakeQuizText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  aestheticBody: {
    padding: 14,
  },
  aestheticTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  aestheticNameLarge: {
    fontFamily: typography.headings,
    fontSize: 20,
    color: colors.charcoal,
    letterSpacing: 1.5,
    flex: 1,
  },
  matchScoreBadge: {
    backgroundColor: 'rgba(168, 34, 34, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  matchScoreText: {
    color: colors.crimson,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
  },
  aestheticTagline: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  aestheticDescriptionText: {
    fontFamily: typography.body,
    fontSize: 12.5,
    color: 'rgba(30,31,34,0.78)',
    lineHeight: 19,
    marginBottom: 12,
  },
  profileAestheticHeroWrap: {
    width: '100%',
    height: 400,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileAestheticHeroImage: {
    width: '100%',
    height: '100%',
  },
  profileTapToExpandOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(26,26,26,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  profileTapToExpandText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  profileEssentialsSection: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
    padding: 12,
    borderRadius: 6,
    marginBottom: 14,
  },
  profileEssentialsHeading: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  profileEssentialsList: {
    gap: 6,
  },
  profileEssentialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  profileBulletDot: {
    color: colors.crimson,
    fontSize: 13,
    lineHeight: 18,
  },
  profileEssentialItemText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
  },
  profileSecondaryCard: {
    backgroundColor: 'rgba(247, 244, 238, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.18)',
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  profileSecondaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileSecondaryBadge: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
    backgroundColor: 'rgba(26,26,26,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  profileSecondaryMatch: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.crimson,
  },
  profileSecondaryName: {
    fontFamily: typography.headings,
    fontSize: 14,
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  profileSecondaryTagline: {
    fontFamily: typography.body,
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  profileAestheticActions: {
    gap: 8,
    marginBottom: 4,
  },
  exploreAestheticBtn: {
    backgroundColor: colors.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 4,
  },
  exploreAestheticBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  profileFullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,26,0.25)',
    backgroundColor: colors.white,
  },
  profileFullscreenBtnText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* Profile Fullscreen Lightbox Modal */
  profileModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 12, 0.98)',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  profileModalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  profileModalTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.cream,
    letterSpacing: 1,
  },
  profileModalSubtitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: 'rgba(245, 240, 232, 0.6)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  profileModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalImageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  profileModalImage: {
    width: '100%',
    height: '100%',
    maxWidth: 950,
    maxHeight: '94%',
  },
  profileModalBottomBar: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  profileModalDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.cream,
    height: 48,
    borderRadius: 4,
  },
  profileModalDoneText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  aestheticPendingBody: {
    padding: 14,
  },
  pendingAestheticTitle: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    marginBottom: 4,
  },
  pendingAestheticDesc: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  startQuizCta: {
    backgroundColor: colors.crimson,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startQuizCtaText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // ── Monogram Avatar, Bio & Tier Styles ──
  avatarMonogram: {
    backgroundColor: '#1E1E1E',
    borderWidth: 2,
    borderColor: colors.gold || '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMonogramText: {
    fontFamily: typography.mono,
    fontSize: 22,
    fontWeight: '900',
    color: colors.cream || '#FAF8F5',
    letterSpacing: 1,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold || '#D4AF37',
  },
  tierText: {
    fontSize: 8,
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bioContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
  },
  bioText: {
    fontSize: 10.5,
    color: colors.textSecond,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  editBioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  editBioBtnText: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },

  // ── Collapsible Aesthetic Bar ──
  aestheticCollapsedBar: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    gap: 10,
  },
  aestheticCollapsedName: {
    fontFamily: typography.headings,
    fontSize: 15,
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  aestheticCollapsedTagline: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  matchScoreBadgeCompact: {
    backgroundColor: colors.forest || '#2A7B4C',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  matchScoreTextCompact: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
  },
  expandDossierBtn: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  expandDossierBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  collapseDossierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.1)',
  },
  collapseDossierBtnText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },

  // ── Edit Bio Modal ──
  bioModalCard: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  bioModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bioModalTitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  bioTextInput: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    textAlignVertical: 'top',
    backgroundColor: '#FAF8F5',
  },
  bioModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  bioCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 6,
    alignItems: 'center',
  },
  bioCancelText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  bioSaveBtn: {
    flex: 2,
    paddingVertical: 10,
    backgroundColor: colors.charcoal,
    borderRadius: 6,
    alignItems: 'center',
  },
  bioSaveText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.8,
  },
});
