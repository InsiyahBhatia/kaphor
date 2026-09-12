import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { rentalService } from '../../../src/services/rentalService';
import { messageService } from '../../../src/services/messageService';
import { cachedGet } from '../../../src/services/api';
import { PlayingCard } from '../../../src/components/PlayingCard';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { useAuthStore } from '../../../src/store/authStore';

export default function RentalScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [rentals, setRentals] = useState<any[]>([]);
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRentalsLoading, setMyRentalsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'my'>(tab === 'my' ? 'my' : 'browse');

  useEffect(() => {
    if (tab === 'my') {
      setActiveTab('my');
    }
  }, [tab]);

  useEffect(() => {
    (async () => {
      try {
        // cachedGet returns cached data immediately or fetches fresh
        const data = await cachedGet('/rentals/available');
        setRentals(Array.isArray(data) ? data : []);
      } catch {
        setRentals([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchMyRentals = async () => {
    setMyRentalsLoading(true);
    try {
      const data = await cachedGet('/rentals/me');
      setMyRentals(Array.isArray(data) ? data : []);
    } catch { setMyRentals([]); }
    finally { setMyRentalsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'my') fetchMyRentals();
  }, [activeTab]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'RESERVED': return colors.copper;
      case 'ACTIVE': return colors.forest;
      case 'RETURNED': return colors.navy;
      case 'OVERDUE': return colors.red;
      default: return colors.textMuted;
    }
  };

  const renderMyRentals = () => {
    if (myRentalsLoading) return <DossierLoading variant="rental" compact />;
    if (myRentals.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={colors.charcoal} />
          <Text style={styles.emptyText}>NO ACTIVE RENTALS</Text>
        </View>
      );
    }
    return myRentals.map((rental: any) => (
      <View key={rental.id} style={styles.myRentalCard}>
        <View style={styles.myRentalHeader}>
          <Text style={styles.myRentalTitle} numberOfLines={1}>
            {rental.garment?.title || 'Rental Item'}
          </Text>
          <View style={[styles.myRentalStatus, { backgroundColor: statusColor(rental.status) }]}>
            <Text style={styles.myRentalStatusText}>{rental.status}</Text>
          </View>
        </View>
        <View style={styles.myRentalDates}>
          <View style={styles.myRentalDateBlock}>
            <Text style={styles.myRentalDateLabel}>START</Text>
            <Text style={styles.myRentalDateValue}>
              {new Date(rental.startDate).toLocaleDateString()}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          <View style={styles.myRentalDateBlock}>
            <Text style={styles.myRentalDateLabel}>END</Text>
            <Text style={styles.myRentalDateValue}>
              {new Date(rental.endDate).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Text style={styles.myRentalPrice}>
          ₹{Math.round(rental.totalPrice || 0).toLocaleString('en-IN')} total
        </Text>
        <View style={styles.myRentalActionRow}>
          <TouchableOpacity
            style={styles.myRentalChatBtn}
            onPress={async () => {
              const otherId = rental.garment?.sellerId || rental.garment?.seller?.id || rental.sellerId;
              if (otherId) {
                try {
                  const conv = await messageService.getOrCreateConversation(otherId, rental.garmentId);
                  router.push(`/messages/${conv.id}` as any);
                } catch {
                  router.push('/messages');
                }
              } else {
                router.push('/messages');
              }
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.charcoal} />
            <Text style={styles.myRentalChatText}>CHAT WITH LENDER</Text>
          </TouchableOpacity>

          {rental.status === 'RESERVED' && (
            <TouchableOpacity
              style={styles.myRentalReturnBtn}
              onPress={async () => {
                try {
                  await rentalService.returnRental(rental.id);
                  fetchMyRentals();
                } catch {}
              }}
            >
              <Text style={styles.myRentalReturnText}>MARK AS RETURNED</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ));
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
        onPress={() => setActiveTab('browse')}
      >
        <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>BROWSE</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'my' && styles.tabActive]}
        onPress={() => setActiveTab('my')}
      >
        <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
          MY RENTALS{myRentals.length > 0 ? ` (${myRentals.length})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderBrowseRentals = () => {
    const leasableRentals = rentals.filter(
      (item: any) =>
        item.sellerId !== currentUserId &&
        item.seller?.id !== currentUserId
    );

    if (loading) {
      return <DossierLoading variant="rental" />;
    }

    if (leasableRentals.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-sharp" size={48} color={colors.charcoal} />
          <Text style={styles.emptyText}>NO LEASABLE ASSETS</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={styles.buttonText}>BROWSE SHOP →</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.grid}>
          {leasableRentals.map((item: any, index: number) => {
            const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
            const ranks = ['K', 'Q', 'J', '10', '9'];
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.cardWrapper}
                onPress={() => router.push(`/(tabs)/rental/${item.id}` as any)}
              >
                <PlayingCard
                  rank={ranks[index % ranks.length]}
                  suit={suits[index % 4]}
                  productName={item.title}
                  size="OS"
                  category={item.category}
                  subCategory={item.subCategory}
                  price={item.rentalPriceDay ? Math.round(item.rentalPriceDay) : 0}
                  imageUrl={item.images?.[0]}
                  condition="Pristine"
                  buttonText="RENT NOW"
                  onSwapRequest={() => router.push(`/(tabs)/rental/${item.id}` as any)}
                  style={{ width: '100%' }}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>RENTALS</Text>
        </View>
        <Text style={styles.subtitle}>SHORT-TERM LEASING</Text>
      </View>

      {renderTabBar()}

      {activeTab === 'my' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.myRentalsContainer}>
          {renderMyRentals()}
        </ScrollView>
      ) : (
        renderBrowseRentals()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: 24, paddingHorizontal: 20,
    borderBottomWidth: 2, borderBottomColor: colors.charcoal,
    paddingBottom: 16, backgroundColor: colors.cream,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 42, fontFamily: typography.headings, color: colors.charcoal, letterSpacing: 2 },
  subtitle: { fontFamily: typography.mono, fontSize: 10, color: colors.red, fontWeight: '800', letterSpacing: 1 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(26,26,26,0.1)' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.charcoal },
  tabText: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: colors.charcoal, fontWeight: '900' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between', paddingTop: 16 },
  cardWrapper: { width: '48%', marginBottom: 24 },

  // My Rentals
  myRentalsContainer: { padding: 16, gap: 12 },
  myRentalCard: {
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal,
    padding: 16, gap: 12,
    shadowColor: colors.charcoal, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  myRentalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myRentalTitle: { fontFamily: typography.headings, fontSize: 20, color: colors.charcoal, flex: 1, marginRight: 8 },
  myRentalStatus: { paddingHorizontal: 8, paddingVertical: 3 },
  myRentalStatusText: { color: colors.cream, fontFamily: typography.mono, fontSize: 8, fontWeight: '900' },
  myRentalDates: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myRentalDateBlock: { flex: 1 },
  myRentalDateLabel: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '700', marginBottom: 2 },
  myRentalDateValue: { fontFamily: typography.mono, fontSize: 12, color: colors.charcoal, fontWeight: '700' },
  myRentalPrice: { fontFamily: typography.mono, fontSize: 15, color: colors.red, fontWeight: '800' },
  myRentalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  myRentalChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F5F3ED',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    height: 40,
  },
  myRentalChatText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  myRentalReturnBtn: {
    flex: 1,
    backgroundColor: colors.charcoal,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  myRentalReturnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20, paddingTop: 60 },
  emptyText: { color: colors.charcoal, fontSize: 12, fontFamily: typography.mono, fontWeight: '800', marginVertical: 24, letterSpacing: 2 },
  button: { 
    backgroundColor: colors.charcoal, paddingHorizontal: 28, paddingVertical: 14,
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  buttonText: { color: colors.cream, fontFamily: typography.mono, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
});
