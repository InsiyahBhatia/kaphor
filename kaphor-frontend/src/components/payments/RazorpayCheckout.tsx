import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRazorpay } from '@codearcade/expo-razorpay';
import api from '../../services/api';
import { colors } from '../../theme';

type Props = {
  razorpayKeyId: string;
  garmentId: string;
  garmentTitle?: string;
  imageUrl?: string;
  buyerEmail?: string;
  onPaid: (orderId: string) => void;
  onClose?: () => void;
};

export function RazorpayCheckout(props: Props) {
  const { openCheckout, RazorpayUI, closeCheckout } = useRazorpay();
  const [inFlight, setInFlight] = useState(false);

  useEffect(() => {
    console.log('[RAZORPAY] Component mounted');
    start();
    return () => {
      console.log('[RAZORPAY] Component unmounting');
      try {
        closeCheckout();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    if (inFlight) return;
    setInFlight(true);
    console.log('[RAZORPAY] Initializing payment for garment:', props.garmentId);
    try {
      const { data } = await api.post<{
        data: { orderId: string; razorpayOrderId: string; amount: number; currency: string };
      }>('/payments/razorpay/create-order', { garmentId: props.garmentId });

      const rp = data.data;
      console.log('[RAZORPAY] Order created:', rp.razorpayOrderId);

      const options = {
        key: props.razorpayKeyId,
        amount: rp.amount,
        currency: rp.currency,
        order_id: rp.razorpayOrderId,
        name: 'Kaphor',
        description: `Purchase: ${props.garmentTitle ?? 'Garment'}`,
        image: props.imageUrl,
        prefill: { email: props.buyerEmail, contact: '' },
        notes: { orderId: rp.orderId },
        theme: { color: colors.crimson },
      };

      console.log('[RAZORPAY] Opening checkout with options:', JSON.stringify(options, null, 2));

      openCheckout(
        options,
        {
          onSuccess: async (success: any) => {
            console.log('[RAZORPAY] Payment success:', success?.razorpay_payment_id);
            try {
              await api.post('/payments/razorpay/verify', {
                orderId: rp.orderId,
                razorpay_order_id: success?.razorpay_order_id,
                razorpay_payment_id: success?.razorpay_payment_id,
                razorpay_signature: success?.razorpay_signature,
              });
              props.onPaid(rp.orderId);
            } catch (e: any) {
              console.error('[RAZORPAY] Verification failed:', e?.response?.data || e.message);
              Alert.alert('Payment verification failed', e?.response?.data?.message ?? 'Please try again.');
            } finally {
              setInFlight(false);
            }
          },
          onFailure: (error: any) => {
            console.error('[RAZORPAY] Payment failed:', error);
            Alert.alert('Payment failed', error?.description ?? 'Please try again.');
            setInFlight(false);
          },
          onClose: () => {
            console.log('[RAZORPAY] Checkout closed internally');
            setInFlight(false);
            props.onClose?.();
          },
        }
      );
    } catch (e: any) {
      console.error('[RAZORPAY] Start failed:', e?.response?.data || e.message);
      Alert.alert('Payment', e?.response?.data?.message ?? 'Failed to start payment.');
      setInFlight(false);
    }
  };

  return RazorpayUI;
}

