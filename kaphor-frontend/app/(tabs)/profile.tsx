import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { userService } from '../../src/services/userService';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/services/api';
import { colors, typography } from '../../src/theme';
import { garmentService } from '../../src/services/garmentService';
import { PlayingCard } from '../../src/components/PlayingCard';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
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

  useEffect(() => {
    fetchProfile();
    fetchSavedAssets();
  }, [fetchProfile, fetchSavedAssets]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  const displayName = profile?.displayName || user?.displayName || 'User';
  const role = profile?.role || user?.role;
  const avatar = profile?.avatar || user?.avatarUrl;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'PROFILE',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
              <Ionicons name="log-out-outline" size={24} color={colors.red} />
            </TouchableOpacity>
          )
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* STAT CARDS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statCardHalf}>
            <Text style={styles.statRank}>Q♠</Text>
            <Text style={styles.statLabel}>CO₂ SAVED</Text>
            <Text style={styles.statValue}>2.4KG</Text>
            <Text style={styles.statSub}>not released</Text>
          </View>

          <View style={styles.statCardHalf}>
            <Text style={styles.statRank}>K♥</Text>
            <Text style={styles.statLabel}>GARMENTS</Text>
            <Text style={styles.statValue}>17</Text>
            <Text style={styles.statSub}>circulating</Text>
          </View>
        </View>

        {/* FULL WIDTH STAT CARD */}
        <View style={styles.statCardFull}>
          <Text style={styles.statRankFull}>A♠</Text>
          <Text style={styles.statLabelFull}>WATER SAVED</Text>
          <Text style={styles.statValueFull}>46K L</Text>
        </View>

        {/* AI MATCH PANEL */}
        <View style={styles.aiMatchPanel}>
          <Text style={styles.aiMatchHeader}>SYSTEM SAYS: → AI MATCH</Text>
          <Text style={styles.aiMatchBody}>
            Your style score reads <Text style={styles.highlightText}>[VINTAGE CHAOS]</Text> + <Text style={styles.highlightText}>[BITTER BLACK COFFEE]</Text>.
            3 items on the deck match your hand right now.
          </Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={styles.ctaButtonText}>SEE MY MATCHES →</Text>
          </TouchableOpacity>
        </View>

        {/* SAVED ASSETS // THE VAULT */}
        <View style={styles.savedSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SAVED ASSETS</Text>
            <View style={styles.badgeLine}><Text style={styles.badgeText}>// THE VAULT</Text></View>
          </View>
          {loadingSaved ? (
            <ActivityIndicator size="small" color={colors.red} style={{ marginVertical: 20 }} />
          ) : savedAssets.length === 0 ? (
            <View style={styles.emptySaved}>
              <Text style={styles.emptySavedText}>THE VAULT IS EMPTY</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedScroll}>
              {savedAssets.map((item, index) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.savedCardWrapper}
                  onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
                >
                  <PlayingCard
                    rank={['A', 'K', 'Q', 'J'][index % 4]}
                    suit={(['♠', '♥', '♦', '♣'] as const)[index % 4]}
                    productName={item.title}
                    price={item.price ? item.price / 100 : 0}
                    size={item.size || 'OS'}
                    imageUrl={item.images[0]}
                    flavorText="archived asset"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>


        {/* SYSTEM OPERATIONS (Existing Menus) */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuSectionTitle}>SYSTEM OPS</Text>

          {[
            { icon: 'notifications', title: 'NOTIFICATIONS', route: '/(tabs)/notifications' },
            { icon: 'pricetag', title: 'MY LISTINGS', route: '/my-listings' },
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
    </>
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
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
    zIndex: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  badge: {
    position: 'absolute',
    bottom: -10,
    right: -20,
    backgroundColor: colors.red,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.charcoal,
    transform: [{ rotate: '-5deg' }],
  },
  badgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
  },
  agentName: {
    fontSize: 20,
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontWeight: '800',
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statCardHalf: {
    flex: 1,
    backgroundColor: colors.charcoal,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.charcoal,
    position: 'relative',
    height: 90,
    justifyContent: 'center',
  },
  statRank: {
    position: 'absolute',
    top: 6,
    left: 6,
    fontFamily: typography.ranks,
    color: colors.cream,
    fontSize: 16,
  },
  statLabel: {
    fontFamily: typography.mono,
    color: colors.red,
    fontSize: 10,
    marginBottom: 2,
    marginTop: 12,
  },
  statValue: {
    fontFamily: typography.headings,
    color: colors.white,
    fontSize: 32,
    lineHeight: 32,
  },
  statSub: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 10,
  },
  statCardFull: {
    backgroundColor: colors.red,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    position: 'relative',
    height: 100,
    justifyContent: 'center',
    marginBottom: 16,
  },
  statRankFull: {
    position: 'absolute',
    top: 6,
    left: 6,
    fontFamily: typography.ranks,
    color: colors.white,
    fontSize: 16,
  },
  statLabelFull: {
    fontFamily: typography.mono,
    color: colors.white,
    fontSize: 12,
    marginBottom: 0,
    marginTop: 12,
  },
  statValueFull: {
    fontFamily: typography.headings,
    color: colors.white,
    fontSize: 44,
    lineHeight: 44,
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
});

