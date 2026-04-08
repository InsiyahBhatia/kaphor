import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useGarmentStore } from '../../src/store/garmentStore';
import { PlayingCard } from '../../src/components/PlayingCard';
import { colors, typography } from '../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { garments, isLoading, fetchGarments } = useGarmentStore();

  useEffect(() => {
    fetchGarments();
  }, []);

  const CRTOverlay = () => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 2 }} />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* GLOBAL SYSTEM TICKER */}
      <View style={styles.ticker}>
        <Text style={styles.tickerText} numberOfLines={1}>
          // SECURE TRANSMISSION // KAPHOR HQ // NEW ASSETS DETECTED IN SECTOR 7 // AGENT LOGGED IN //
        </Text>
      </View>

      {/* SEARCH TERMINAL */}
      <View style={styles.searchContainer}>
        <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(tabs)/shop')}>
          <Ionicons name="search-sharp" size={20} color={colors.textMuted} />
          <Text style={styles.searchPlaceholder}>SEARCH THE DECK...</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={() => router.push('/(tabs)/shop?openFilters=true')}>
          <Ionicons name="options-sharp" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>


      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* HERO BANNER - FEATURED INTEL */}
        <View style={styles.heroSection}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=600&auto=format&fit=crop' }} 
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(26,26,26,0.6)' }]} />
          <CRTOverlay />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>LIVE DROP</Text></View>
            <Text style={styles.heroTitle}>ASSET_077: REFLECTIVE TECHWEAR</Text>
            <TouchableOpacity style={styles.heroCta} onPress={() => router.push('/(tabs)/shop')}>
              <Text style={styles.heroCtaText}>ACCESS THE DECK →</Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* QUICK ACTIONS terminal */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/shop/sell')}>
            <Ionicons name="pricetag-sharp" size={24} color={colors.red} />
            <Text style={styles.actionText}>SELL ASSET</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/swap')}>
            <Ionicons name="swap-horizontal-sharp" size={24} color={colors.red} />
            <Text style={styles.actionText}>INITIATE SWAP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/studio')}>
            <Ionicons name="construct-sharp" size={24} color={colors.red} />
            <Text style={styles.actionText}>REPAIR LAB</Text>
          </TouchableOpacity>
        </View>

        {/* BROWSE BY SECTOR (Categories) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>BROWSE SECTORS</Text>
            <View style={styles.badgeLine}><Text style={styles.badgeText}>IDENTIFIED</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {['ETHNIC', 'APPAREL', 'ACCESSORIES', 'FOOTWEAR'].map((group, i) => (
              <TouchableOpacity 
                key={i} 
                style={styles.categoryCard}
                onPress={() => router.push({ pathname: '/(tabs)/shop', params: { category: group } })}
              >
                <Text style={styles.categoryInitials}>{group.substring(0, 2)}</Text>
                <Text style={styles.categoryName}>{group}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>


        {/* NEW ARRIVALS - THE DECK */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>NEW ASSETS</Text>
            <View style={styles.badgeLine}><Text style={styles.badgeText}>// THE DECK</Text></View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color={colors.charcoal} style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {garments.slice(0, 5).map((item, index) => {
                 const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
                 return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.cardWrapper}
                    onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
                  >
                    <PlayingCard
                      rank={['Q', '8', '!', 'K', 'A'][index % 5]}
                      suit={suits[index % 4]}
                      productName={item.title}
                      price={item.price ? item.price / 100 : 0}
                      size="OS"
                      imageUrl={item.images[0]}
                      flavorText="intercepted asset"
                    />
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>

        {/* CRT LIVE FEED REMOVED */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, paddingTop: 0 },

  
  ticker: { backgroundColor: colors.charcoal, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: colors.red },
  tickerText: { color: colors.red, fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 2, paddingHorizontal: 16 },
  
  heroSection: {
    margin: 16,
    height: 240,
    borderWidth: 2,
    borderColor: colors.charcoal,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  heroContent: {
    padding: 24,
    justifyContent: 'flex-end',
    flex: 1,
  },
  heroBadge: {
    backgroundColor: colors.red,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  heroBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
  },
  heroTitle: {
    color: colors.white,
    fontFamily: typography.headings,
    fontSize: 32,
    lineHeight: 32,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  heroCta: {
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  heroCtaText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
  },

  
  heroSplit: { flexDirection: 'row', minHeight: 180 },
  heroHalf: { flex: 1, padding: 16, borderRightWidth: 2, borderRightColor: colors.charcoal, overflow: 'hidden', justifyContent: 'center' },
  
  crosshairCenter: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  surveillanceText: { position: 'absolute', top: 8, left: 8, color: colors.red, fontFamily: typography.mono, fontSize: 10, fontWeight: '800' },
  
  heroData: { fontFamily: typography.mono, color: colors.charcoal, fontSize: 11, fontWeight: '800', marginBottom: 4, letterSpacing: 1 },
  barcodeBox: { flexDirection: 'row', marginTop: 16, alignItems: 'flex-end', height: 24 },
  
  stamp: {
    position: 'absolute', bottom: 12, right: -16, backgroundColor: colors.white, 
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: colors.charcoal,
    transform: [{ rotate: '-12deg' }],
  },
  stampText: { color: colors.red, fontFamily: typography.headings, fontSize: 16, letterSpacing: 1 },
  
  heroBottomBar: { height: 32, backgroundColor: colors.charcoal, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, borderTopWidth: 2, borderTopColor: colors.charcoal },
  agentText: { color: colors.red, fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  timestamp: { color: colors.red, fontFamily: typography.mono, fontSize: 10, fontWeight: '800' },
  
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, gap: 12 },
  sectionTitle: { color: colors.charcoal, fontSize: 32, fontFamily: typography.headings, letterSpacing: 1, textTransform: 'uppercase' },
  badgeLine: { backgroundColor: colors.charcoal, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: colors.white, fontSize: 10, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1 },
  
  horizontalScroll: { paddingLeft: 16, paddingRight: 16, paddingBottom: 16 },
  cardWrapper: { marginRight: 16, marginBottom: 0 },
  
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  tile: {
    borderWidth: 2, borderColor: colors.charcoal, overflow: 'hidden', position: 'relative',
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
  },
  tileFull: { width: '100%', height: 140, padding: 16, justifyContent: 'center' },
  tileHalf: { flex: 1, minWidth: '100%', height: 80, padding: 16, justifyContent: 'center' },
  tileLarge: { flex: 2, minWidth: 200, aspectRatio: 1 },
  tileSmall: { flex: 1, minWidth: 100, aspectRatio: 1, justifyContent: 'center' },
  
  tileHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tileText: { color: colors.white, fontFamily: typography.mono, fontWeight: '800' },
  tileSubText: { color: colors.red, fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  
  overlayFilter: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,26,0.5)' },
  
  ledRow: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', gap: 4 },
  led: { width: 6, height: 6, backgroundColor: 'rgba(255,255,255,0.4)', borderWidth: 1, borderColor: colors.charcoal },
  
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,26,26,0.1)',
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  searchPlaceholder: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  quickActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionText: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryCard: {
    width: 100,
    height: 120,
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  categoryInitials: {
    fontFamily: typography.headings,
    color: colors.red,
    fontSize: 24,
    marginBottom: 4,
  },
  categoryName: {
    fontFamily: typography.mono,
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
});


