import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { orderService, TransactionOrder } from '../../../src/services/orderService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

export default function OrderConfirmedScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  useBackHandler('/(tabs)/shop');
  const [order, setOrder] = useState<TransactionOrder | null>(null);
  const [loading, setLoading] = useState(!!orderId);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    orderService
      .getOrder(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <DossierLoading variant="confirmed" compact />
        </View>
      </View>
    );
  }

  const amount = order ? order.totalAmount : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Success Animation Area */}
        <View style={styles.successIconWrap}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-circle" size={72} color={colors.forest} />
          </View>
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>PAID</Text>
          </View>
        </View>

        <Text style={styles.heading}>ORDER CONFIRMED</Text>
        <Text style={styles.subheading}>
          Your payment of{' '}
          <Text style={styles.amountText}>₹{amount.toLocaleString('en-IN')}</Text>
          {' '}has been processed successfully.
        </Text>

        {/* Order ID Card */}
        <View style={styles.orderIdCard}>
          <Text style={styles.orderIdLabel}>ORDER ID</Text>
          <Text style={styles.orderIdValue}>{orderId?.toUpperCase()}</Text>
          <View style={styles.orderIdDivider} />
          <Text style={styles.orderIdHint}>
            Save this ID for reference. You can track your order status in the
            Orders section.
          </Text>
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          <Text style={styles.sectionTitle}>WHAT HAPPENS NEXT</Text>

          <View style={styles.timelineStep}>
            <View style={styles.timelineDot}>
              <Ionicons name="chatbubble-ellipses" size={16} color={colors.cream} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>1. Coordinate with Seller</Text>
              <Text style={styles.timelineText}>
                Message the seller to confirm shipping address and timeline.
              </Text>
            </View>
          </View>

          <View style={styles.timelineConnector} />

          <View style={styles.timelineStep}>
            <View style={styles.timelineDot}>
              <Ionicons name="cube" size={16} color={colors.cream} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>2. Item Shipped</Text>
              <Text style={styles.timelineText}>
                Seller marks the item as shipped once dispatched.
              </Text>
            </View>
          </View>

          <View style={styles.timelineConnector} />

          <View style={styles.timelineStep}>
            <View style={styles.timelineDot}>
              <Ionicons name="hand-left" size={16} color={colors.cream} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>3. Confirm Delivery</Text>
              <Text style={styles.timelineText}>
                Mark as delivered once you receive the item and leave a review.
              </Text>
            </View>
          </View>
        </View>

        {/* Impact Stats */}
        <View style={styles.impactCard}>
          <View style={styles.impactHeader}>
            <Ionicons name="leaf" size={18} color={colors.cream} />
            <Text style={styles.impactTitle}>ENVIRONMENTAL IMPACT</Text>
          </View>
          <Text style={styles.impactText}>
            By choosing pre-loved, you've helped reduce fashion waste. Track your
            total impact on your profile dashboard.
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.footer}>
        {orderId && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace(`/(tabs)/shop/orders/${orderId}`)}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.cream} />
            <Text style={styles.primaryBtnText}>MESSAGE SELLER</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)/shop/orders')}
        >
          <Text style={styles.secondaryBtnText}>VIEW ALL ORDERS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.homeBtnText}>BACK TO HOME</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 220,
    alignItems: 'center',
  },

  successIconWrap: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
    position: 'relative',
  },
  successCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(30,59,47,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.forest,
  },
  successBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: colors.forest,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  successBadgeText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  heading: {
    fontFamily: typography.headings,
    fontSize: 40,
    color: colors.charcoal,
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  amountText: {
    color: colors.charcoal,
    fontWeight: '900',
  },

  orderIdCard: {
    width: '100%',
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 32,
  },
  orderIdLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  orderIdValue: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  orderIdDivider: {
    height: 1,
    backgroundColor: 'rgba(30,31,34,0.1)',
    marginVertical: 12,
  },
  orderIdHint: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 16,
  },

  timeline: {
    width: '100%',
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  timelineStep: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 6,
  },
  timelineTitle: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '800',
    color: colors.charcoal,
    marginBottom: 4,
  },
  timelineText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  timelineConnector: {
    width: 2,
    height: 24,
    backgroundColor: colors.charcoal,
    marginLeft: 17,
    opacity: 0.2,
  },

  impactCard: {
    width: '100%',
    backgroundColor: colors.forest,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 20,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  impactTitle: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  impactText: {
    color: 'rgba(247,245,240,0.85)',
    fontFamily: typography.mono,
    fontSize: 11,
    lineHeight: 17,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: colors.charcoal,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  primaryBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  secondaryBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  secondaryBtnText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  homeBtn: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeBtnText: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 10,
    textDecorationLine: 'underline',
  },
});
