import Stripe from 'stripe';

// Lazy initialize Stripe to avoid build-time errors when env vars are not set
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Keep for backwards compatibility but use getStripe() for new code
export const stripe = {
  get checkout() { return getStripe().checkout; },
  get subscriptions() { return getStripe().subscriptions; },
  get billingPortal() { return getStripe().billingPortal; },
  get webhooks() { return getStripe().webhooks; },
};

// Price IDs from Stripe Dashboard
export const STRIPE_PRICES = {
  weekly: 'price_1Sh8hVKHJU6KLxM3W75Rystk',   // €10/week, no trial
  monthly: 'price_1S3HO0KHJU6KLxM30Jgoqizh',  // €20/month, 7-day trial
  annual: 'price_1Sh8fcKHJU6KLxM3lCvLduFe',   // €192/year, 7-day trial
} as const;

export type PriceKey = keyof typeof STRIPE_PRICES;

// Price display info
export const PRICE_INFO: Record<PriceKey, {
  name: string;
  price: string;
  period: string;
  description: string;
  hasTrial: boolean;
  popular?: boolean;
  savings?: string;
}> = {
  weekly: {
    name: 'Weekly',
    price: '€10',
    period: 'week',
    description: 'Quick access for urgent job search',
    hasTrial: false,
  },
  monthly: {
    name: 'Monthly',
    price: '€20',
    period: 'month',
    description: 'Most popular choice',
    hasTrial: true,
    popular: true,
  },
  annual: {
    name: 'Annual',
    price: '€192',
    period: 'year',
    description: 'Best value - save 20%',
    hasTrial: true,
    savings: 'Save €48/year',
  },
};

// Plan features for display
export const PLAN_FEATURES = {
  free: [
    'Browse all job listings',
    'Save unlimited jobs',
    'Basic salary insights (average only)',
    'Email alerts (daily digest)',
  ],
  pro: [
    'Everything in Free, plus:',
    'Full salary insights (range, percentiles, source)',
    'Instant email alerts',
    'Apply to jobs directly',
    'Application tracking',
    'Priority support',
  ],
};

// Create Stripe Checkout session
export async function createCheckoutSession({
  userId,
  userEmail,
  priceKey,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  userEmail: string;
  priceKey: PriceKey;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const priceId = STRIPE_PRICES[priceKey];
  const priceInfo = PRICE_INFO[priceKey];

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    client_reference_id: userId,
    metadata: {
      userId,
      priceKey,
    },
    // Add trial for monthly and annual
    subscription_data: priceInfo.hasTrial
      ? {
          trial_period_days: 7,
          metadata: {
            userId,
            priceKey,
          },
        }
      : {
          metadata: {
            userId,
            priceKey,
          },
        },
    // Allow promotion codes
    allow_promotion_codes: true,
  };

  return stripe.checkout.sessions.create(sessionParams);
}

// Create Stripe Customer Portal session
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// Get subscription details
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    return null;
  }
}

// Cancel subscription at period end
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return null;
  }
}

// Resume a canceled subscription
export async function resumeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return null;
  }
}

// Verify webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
