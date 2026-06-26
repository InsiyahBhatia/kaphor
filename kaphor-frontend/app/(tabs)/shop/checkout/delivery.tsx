import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../../../src/theme';
import { Header } from '../../../../src/components/common/Header';

export default function DeliveryScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  
  const [address, setAddress] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    pincode: '',
    state: '',
  });

  const handleContinue = () => {
    if (!address.name || !address.phone || !address.street || !address.city || !address.pincode) {
      Alert.alert('Missing Details', 'Please fill in all the required fields to proceed.');
      return;
    }
    // In a real app, we would save the address here
    router.push(`/(tabs)/shop/checkout/${orderId}`);
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.bg }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="DELIVERY" showBack />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.step}>
            <View style={[styles.stepDot, styles.activeDot]}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepLabel}>DELIVERY</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.step}>
            <View style={styles.stepDot}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepLabel}>PAYMENT</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>SHIPPING ADDRESS</Text>
        
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>FULL NAME *</Text>
            <TextInput 
              style={styles.input}
              placeholder="e.g. John Doe"
              value={address.name}
              onChangeText={(t) => setAddress({...address, name: t})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PHONE NUMBER *</Text>
            <TextInput 
              style={styles.input}
              placeholder="+91 XXXXX XXXXX"
              keyboardType="phone-pad"
              value={address.phone}
              onChangeText={(t) => setAddress({...address, phone: t})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>STREET ADDRESS *</Text>
            <TextInput 
              style={[styles.input, styles.textArea]}
              placeholder="House No, Street, Area"
              multiline
              numberOfLines={3}
              value={address.street}
              onChangeText={(t) => setAddress({...address, street: t})}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.md }]}>
              <Text style={styles.label}>CITY *</Text>
              <TextInput 
                style={styles.input}
                placeholder="City"
                value={address.city}
                onChangeText={(t) => setAddress({...address, city: t})}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>PINCODE *</Text>
              <TextInput 
                style={styles.input}
                placeholder="600001"
                keyboardType="numeric"
                value={address.pincode}
                onChangeText={(t) => setAddress({...address, pincode: t})}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>STATE *</Text>
            <TextInput 
              style={styles.input}
              placeholder="State"
              value={address.state}
              onChangeText={(t) => setAddress({...address, state: t})}
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          <Text style={styles.infoText}>
            Delivery usually takes 3-5 business days after the seller confirms the order.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueText}>CONTINUE →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  step: { alignItems: 'center' },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  activeDot: {
    backgroundColor: colors.crimson,
    borderColor: colors.crimson,
  },
  stepNum: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  stepLabel: {
    marginTop: 8,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
    marginBottom: 18,
  },

  sectionTitle: {
    fontFamily: typography.headings,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 2,
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  inputGroup: { marginBottom: spacing.lg },
  label: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.bg,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  
  infoBox: {
    flexDirection: 'row',
    marginTop: 32,
    padding: spacing.md,
    backgroundColor: colors.bgMuted,
    borderLeftWidth: 4,
    borderLeftColor: colors.textMuted,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: 40,
    backgroundColor: colors.bg,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  continueBtn: {
    backgroundColor: colors.border,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  continueText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
