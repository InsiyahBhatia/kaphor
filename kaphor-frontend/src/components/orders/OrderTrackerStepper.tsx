import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';

export interface StepItem {
  key: string;
  label: string;
  isComplete: boolean;
  isCurrent: boolean;
}

interface OrderTrackerStepperProps {
  type: 'SALE' | 'RENTAL' | 'SWAP';
  status: string;
  style?: any;
}

export function OrderTrackerStepper({ type, status, style }: OrderTrackerStepperProps) {
  let steps: StepItem[] = [];

  if (type === 'SALE') {
    const isPaid = ['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(status);
    const isShipped = ['SHIPPED', 'DELIVERED'].includes(status);
    const isDelivered = status === 'DELIVERED';
    const isCancelled = ['CANCELLED', 'REFUNDED'].includes(status);

    if (isCancelled) {
      return (
        <View style={[styles.cancelledContainer, style]}>
          <Ionicons name="close-circle" size={16} color={colors.red} />
          <Text style={styles.cancelledText}>TRANSACTION {status}</Text>
        </View>
      );
    }

    steps = [
      { key: 'PAID', label: 'PAID', isComplete: isPaid, isCurrent: status === 'CONFIRMED' },
      { key: 'PACKED', label: 'PACKED', isComplete: isShipped, isCurrent: status === 'CONFIRMED' && isPaid },
      { key: 'SHIPPED', label: 'SHIPPED', isComplete: isShipped, isCurrent: status === 'SHIPPED' },
      { key: 'DELIVERED', label: 'DELIVERED', isComplete: isDelivered, isCurrent: isDelivered },
    ];
  } else if (type === 'RENTAL') {
    const isReserved = ['RESERVED', 'ACTIVE', 'RETURNED'].includes(status);
    const isActive = ['ACTIVE', 'RETURNED'].includes(status);
    const isReturned = status === 'RETURNED';

    steps = [
      { key: 'RESERVED', label: 'RESERVED', isComplete: isReserved, isCurrent: status === 'RESERVED' },
      { key: 'ACTIVE', label: 'ACTIVE LEASE', isComplete: isActive, isCurrent: status === 'ACTIVE' },
      { key: 'RETURNED', label: 'RETURNED', isComplete: isReturned, isCurrent: status === 'RETURNED' },
      { key: 'COMPLETED', label: 'REFUNDED', isComplete: isReturned, isCurrent: isReturned },
    ];
  } else {
    // SWAP
    const isAgreed = ['AGREEMENT_SIGNED', 'ADDRESS_SHARED', 'SHIPPED', 'BOTH_SHIPPED', 'DELIVERED', 'COMPLETED'].includes(status);
    const isShipped = ['SHIPPED', 'BOTH_SHIPPED', 'DELIVERED', 'COMPLETED'].includes(status);
    const isCompleted = status === 'COMPLETED';

    steps = [
      { key: 'REQUEST', label: 'OFFERED', isComplete: true, isCurrent: status === 'REQUESTED' },
      { key: 'AGREEMENT', label: 'AGREED', isComplete: isAgreed, isCurrent: ['ACCEPTED', 'AGREEMENT_PENDING', 'AGREEMENT_SIGNED', 'ADDRESS_SHARED'].includes(status) },
      { key: 'SHIPPED', label: 'IN TRANSIT', isComplete: isShipped, isCurrent: ['SHIPPED', 'BOTH_SHIPPED', 'DELIVERED'].includes(status) },
      { key: 'COMPLETED', label: 'SWAPPED', isComplete: isCompleted, isCurrent: isCompleted },
    ];
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.trackLineWrapper}>
        <View style={styles.trackLineBg} />
      </View>

      <View style={styles.stepsRow}>
        {steps.map((step, idx) => {
          const isDone = step.isComplete;
          const isCurrent = step.isCurrent;

          return (
            <View key={step.key} style={styles.stepNode}>
              <View
                style={[
                  styles.circle,
                  isDone && styles.circleDone,
                  isCurrent && styles.circleCurrent,
                ]}
              >
                {isDone && !isCurrent ? (
                  <Ionicons name="checkmark" size={11} color={colors.cream} />
                ) : (
                  <View
                    style={[
                      styles.dot,
                      isCurrent && styles.dotCurrent,
                      !isDone && !isCurrent && styles.dotPending,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  (isDone || isCurrent) && styles.stepLabelActive,
                  isCurrent && styles.stepLabelCurrent,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    position: 'relative',
    width: '100%',
  },
  trackLineWrapper: {
    position: 'absolute',
    top: 11,
    left: '12%',
    right: '12%',
    height: 2,
    zIndex: 1,
  },
  trackLineBg: {
    flex: 1,
    backgroundColor: '#E4DFD5',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  stepNode: {
    alignItems: 'center',
    width: '24%',
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#D4CFC5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  circleDone: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  circleCurrent: {
    backgroundColor: '#1E1F22',
    borderColor: colors.copper,
    borderWidth: 2,
    shadowColor: colors.copper,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotCurrent: {
    backgroundColor: colors.copper,
  },
  dotPending: {
    backgroundColor: '#CCC7BC',
  },
  stepLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  stepLabelCurrent: {
    color: colors.copper,
    fontWeight: '900',
  },
  cancelledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F5C2C2',
    borderRadius: 4,
    marginVertical: 4,
  },
  cancelledText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.red,
    letterSpacing: 0.8,
  },
});
