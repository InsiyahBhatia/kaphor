import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

const stripe = secretKey
  ? new Stripe(secretKey, { typescript: true })
  : (null as unknown as Stripe);

export default stripe;
