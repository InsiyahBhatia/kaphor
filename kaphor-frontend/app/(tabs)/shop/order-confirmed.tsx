import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { orderService } from '../../../src/services/orderService';
import { colors } from '../../../src/theme';

export default function OrderConfirmedScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [checking, setChecking] = useState(!!orderId);

  useEffect(() => {
    if (!orderId) {
      setChecking(false);
      return;
    }
    orderService
      .getOrder(orderId)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [orderId]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>ORDER CONFIRMED</Text>
      <Text style={styles.subtext}>
        Coordinate shipping or pickup with the seller in your order thread. When you receive the item, confirm
        delivery — then you can leave a peer review.
      </Text>
      {checking ? (
        <ActivityIndicator color={colors.crimson} style={{ marginTop: 24 }} />
      ) : orderId ? (
        <TouchableOpacity style={styles.button} onPress={() => router.replace(`/(tabs)/shop/orders/${orderId}`)}>
          <Text style={styles.buttonText}>MESSAGE & TRACK ORDER</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => router.replace('/(tabs)/shop/orders')}>
        <Text style={[styles.buttonText, styles.secondaryText]}>ALL ORDERS</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.link}>Back to home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    color: colors.gold,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 32,
    textAlign: 'center',
  },
  subtext: {
    color: colors.textSecond,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.crimson,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 28,
    minWidth: '90%',
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 12,
  },
  secondaryText: {
    color: colors.textPrimary,
  },
  link: {
    marginTop: 24,
    color: colors.textMuted,
    fontSize: 13,
  },
});
