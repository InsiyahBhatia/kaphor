import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { KaphorImage } from '../../src/components/KaphorImage';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { userService } from '../../src/services/userService';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/services/api';
import { colors, typography } from '../../src/theme';
import { garmentService } from '../../src/services/garmentService';
import { aiService } from '../../src/services/aiService';
import { PlayingCard } from '../../src/components/PlayingCard';

import { Header } from '../../src/components/common/Header';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [styleProfile, setStyleProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savedAssets, setSavedAssets] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await userService.getMe();
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSavedAssets = useCallback(async () => {
    try {
      const data = await garmentService.getWishlist();
      setSavedAssets(data);
    } catch (error) {
      console.error('Failed to fetch saved assets', error);
    } finally {
      setLoadingSaved(false);
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

  useEffect(() => {
    fetchProfile();
    fetchSavedAssets();
    fetchStyleProfile();
  }, [fetchProfile, fetchSavedAssets, fetchStyleProfile]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  const displayName = profile?.displayName || user?.displayName || 'User';
  const role = profile?.role || user?.role;
  const avatar = profile?.avatar || user?.avatarUrl;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header 
        title="PROFILE" 
        rightElement={
          <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }}>
            <Ionicons name="log-out-outline" size={24} color={colors.red} />
          </TouchableOpacity>
        }
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* IDENTITY SECTION */}
        <View style={styles.identitySection}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              {avatar ? (
                <KaphorImage uri={avatar} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={40} color={colors.charcoal} />
                </View>
              )}
              <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{role || 'MEMBER'}</Text></View>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.emailText}>{user?.email || profile?.email}</Text>
              <View style={styles.joinRow}>
                <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                <Text style={styles.joinText}>JOINED {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : '2024'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI MATCH PANEL */}
        <View style={styles.aiMatchPanel}>
          <View style={styles.aiHeaderRow}>
            <Text style={styles.aiMatchHeader}>SYSTEM SAYS: → {styleProfile?.styleAesthetic || 'AI MATCH'}</Text>
            <View style={styles.liveIndicator} />
          </View>
          
          <Text style={styles.aiMatchBody}>
            {styleProfile?.summary || (
              <>
                Your style score is being calculated. 
                3 items on the deck match your hand right now.
              </>
            )}
          </Text>
          
          {styleProfile?.dnaTags && (
            <View style={styles.dnaGrid}>
              {styleProfile.dnaTags.map((tag: string) => (
                <View key={tag} style={styles.dnaTag}>
                  <Text style={styles.dnaTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {styleProfile?.topCategories && (
            <View style={styles.categoriesSection}>
              <Text style={styles.sectionMiniTitle}>CURATED CATEGORIES</Text>
              <View style={styles.categoryRow}>
                {styleProfile.topCategories.map((cat: string) => (
                  <View key={cat} style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{cat.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {styleProfile?.colorPalette && (
            <View style={styles.paletteSection}>
               <Text style={styles.sectionMiniTitle}>COLOR ARCHIVE</Text>
               <View style={styles.paletteRow}>
                  {styleProfile.colorPalette.map((hex: string) => (
                    <View key={hex} style={[styles.colorCircle, { backgroundColor: hex }]} />
                  ))}
               </View>
            </View>
          )}

          {styleProfile?.recommendedBrands && (
            <View style={styles.brandsSection}>
              <Text style={styles.sectionMiniTitle}>ARCHIVE BRANDS TO HUNT</Text>
              <Text style={styles.brandList}>{styleProfile.recommendedBrands.join('  //  ')}</Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.ctaButton} 
            onPress={() => styleProfile ? router.push('/(tabs)/shop') : router.push('/(auth)/style-quiz')}
          >
            <Text style={styles.ctaButtonText}>
              {styleProfile ? 'SEE MY MATCHES →' : 'GENERATE AI PROFILE →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ECO-IMPACT DASHBOARD */}
        <View style={styles.impactDashboard}>
          <View style={styles.impactHeader}>
            <Text style={styles.impactTitle}>ENVIRONMENTAL DIVIDENDS</Text>
            <Ionicons name="leaf" size={16} color={colors.charcoal} />
          </View>
          
          <View style={styles.impactGrid}>
            <View style={styles.impactStat}>
              <Text style={styles.statValue}>{(profile?.impactRecord?.carbonSavedKg || 0).toFixed(1)}<Text style={styles.statUnit}>KG</Text></Text>
              <Text style={styles.statLabel}>CO₂ SAVED</Text>
            </View>
            <View style={styles.impactStat}>
              <Text style={styles.statValue}>{Math.floor((profile?.impactRecord?.carbonSavedKg || 0) / 22)}</Text>
              <Text style={styles.statLabel}>TREES 🌳</Text>
            </View>
            <View style={styles.impactStat}>
              <Text style={styles.statValue}>{((profile?.impactRecord?.waterSavedL || 0) / 1000).toFixed(1)}<Text style={styles.statUnit}>KL</Text></Text>
              <Text style={styles.statLabel}>WATER 💧</Text>
            </View>
            <View style={styles.impactStat}>
              <Text style={styles.statValue}>{((profile?.impactRecord?.wasteSavedG || 0) / 1000).toFixed(1)}<Text style={styles.statUnit}>KG</Text></Text>
              <Text style={styles.statLabel}>WASTE 🗑️</Text>
            </View>
          </View>

          <View style={styles.impactFooter}>
            <Text style={styles.impactFooterText}>
              BY CIRCULATING {profile?.impactRecord?.itemsCirculated || 0} ITEMS, YOU DISPLACED THE NEED FOR NEW PRODUCTION EMISSIONS.
            </Text>
          </View>
        </View>
        {/* SYSTEM OPERATIONS (Existing Menus) */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuSectionTitle}>COLLECTIONS</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/saved')}>
            <Ionicons name="heart-sharp" size={20} color={colors.red} style={{ marginRight: 12 }} />
            <Text style={styles.menuText}>THE VAULT // SAVED ITEMS</Text>
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{savedAssets.length}</Text></View>
            <Ionicons name="chevron-forward" size={16} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/my-listings')}>
            <Ionicons name="pricetag" size={20} color={colors.charcoal} style={{ marginRight: 12 }} />
            <Text style={styles.menuText}>MY LISTINGS</Text>
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{profile?.stats?.listings || 0}</Text></View>
            <Ionicons name="chevron-forward" size={16} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/wardrobe')}>
            <Ionicons name="shirt-outline" size={20} color={colors.charcoal} style={{ marginRight: 12 }} />
            <Text style={styles.menuText}>DIGITAL CLOSET // WARDROBE</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderColor: '#C41E3A', borderWidth: 1.5 }]} onPress={() => router.push('/(auth)/style-quiz')}>
            <Ionicons name="sparkles" size={20} color="#C41E3A" style={{ marginRight: 12 }} />
            <Text style={[styles.menuText, { color: '#C41E3A' }]}>RETAKE STYLE QUIZ</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 9, color: '#C41E3A', marginRight: 8 }}>REFRESH DNA</Text>
            <Ionicons name="chevron-forward" size={16} color="#C41E3A" />
          </TouchableOpacity>

          <Text style={[styles.menuSectionTitle, { marginTop: 16 }]}>SYSTEM OPS</Text>

          {[
            { icon: 'notifications', title: 'NOTIFICATIONS', route: '/(tabs)/notifications' },
            { icon: 'star', title: 'MY REVIEWS', route: '/reviews' },
            { icon: 'chatbubbles', title: 'COMMUNICATIONS', route: '/(tabs)/shop/orders' },
            { icon: 'settings', title: 'ACCOUNT SETTINGS', route: '/settings' },
          ].map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.menuItem} onPress={() => router.push(item.route as any)}>
              <Ionicons name={item.icon as any} size={20} color={colors.charcoal} style={{ marginRight: 12 }} />
              <Text style={styles.menuText}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.charcoal} />
            </TouchableOpacity>
          ))}

          {role === 'ADMIN' && (
            <TouchableOpacity style={[styles.menuItem, { borderColor: colors.red }]} onPress={() => router.push('/(admin)')}>
              <Ionicons name="warning" size={20} color={colors.red} style={{ marginRight: 12 }} />
              <Text style={[styles.menuText, { color: colors.red }]}>ADMIN OVERRIDE</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.red} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <Text style={styles.logoutText}>LOG OUT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
    position: 'relative',
  },
  yourHandTitle: {
    fontSize: 64,
    fontFamily: typography.headings,
    color: colors.charcoal,
    textAlign: 'center',
    marginBottom: 24,
    width: '100%',
    letterSpacing: 2,
  },
  identitySection: {
    marginBottom: 24,
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    position: 'absolute',
    bottom: -8,
    right: -10,
    backgroundColor: colors.red,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  roleBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
  },
  identityText: {
    flex: 1,
  },
  displayName: {
    fontSize: 24,
    fontFamily: typography.headings,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  emailText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.mono,
    marginTop: 4,
    marginBottom: 8,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  countBadgeText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
  },
  aiMatchPanel: {
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    marginBottom: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  aiMatchHeader: {
    fontFamily: typography.mono,
    color: colors.red,
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 12,
  },
  aiMatchBody: {
    fontFamily: typography.accent,
    color: colors.charcoal,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  highlightText: {
    fontFamily: typography.mono,
    color: colors.red,
    fontWeight: '700',
    fontSize: 14,
  },
  ctaButton: {
    backgroundColor: colors.charcoal,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontFamily: typography.mono,
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  journeySection: {
    marginBottom: 40,
  },
  journeyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 20,
  },
  journeyTitle: {
    fontFamily: typography.headings,
    fontSize: 28,
    color: colors.charcoal,
  },
  journeySubtitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  timelineGutter: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: -16,
    width: 2,
    backgroundColor: 'rgba(26,26,26,0.1)',
  },
  gutterActive: {
    backgroundColor: colors.red,
  },
  roman: {
    fontFamily: typography.mono,
    width: 32,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginLeft: 8,
  },
  romanActive: {
    color: colors.red,
    fontWeight: '800',
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineStep: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 13,
  },
  timelineStepActive: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineDate: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  menuContainer: {
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    paddingTop: 24,
  },
  menuSectionTitle: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    marginBottom: 4,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  menuIcon: {
    color: colors.charcoal,
    width: 24,
    fontSize: 16,
  },
  menuText: {
    flex: 1,
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  menuArrow: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 16,
  },
  logoutItem: {
    marginTop: 16,
    backgroundColor: colors.red,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.charcoal,
    alignItems: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  logoutText: {
    fontFamily: typography.mono,
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2,
  },
  hubContainer: {
    marginBottom: 32,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  hubTitle: {
    fontFamily: typography.mono,
    color: colors.red,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 2,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  hubCard: {
    width: '46%',
    aspectRatio: 1,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  hubCardText: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  savedSection: {
    marginBottom: 32,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 28,
    fontFamily: typography.headings,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  badgeLine: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedScroll: {
    paddingRight: 16,
  },
  savedCardWrapper: {
    marginRight: 12,
    width: 200,
  },
  emptySaved: {
    padding: 32,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptySavedText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '800',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF00',
    shadowColor: '#00FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  dnaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  dnaTag: {
    backgroundColor: 'rgba(26,26,26,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  dnaTagText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.charcoal,
  },
  sectionMiniTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 8,
    letterSpacing: 1,
  },
  categoriesSection: {
    marginBottom: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catBadge: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  catBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
  },
  paletteSection: {
    marginBottom: 20,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  brandsSection: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: 'rgba(212, 207, 199, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: colors.red,
  },
  brandList: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 16,
    color: colors.charcoal,
  },
  impactDashboard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    marginBottom: 24,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.charcoal,
    paddingBottom: 8,
  },
  impactTitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  impactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  impactStat: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.cream,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  statValue: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.charcoal,
  },
  statUnit: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.textMuted,
  },
  statLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 4,
  },
  impactFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.charcoal,
    borderStyle: 'dashed',
  },
  impactFooterText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.charcoal,
    lineHeight: 12,
    textAlign: 'center',
  },
});

