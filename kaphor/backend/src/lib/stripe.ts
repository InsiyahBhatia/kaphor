import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = secretKey
  ? new Stripe(secretKey, { typescript: true })
  : (null as unknown as Stripe);

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<Stripe.PaymentIntent> {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set');
  const { amount, currency, metadata = {} } = params;
  const amountCents = Math.round(amount * 100);
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

export default stripe;
