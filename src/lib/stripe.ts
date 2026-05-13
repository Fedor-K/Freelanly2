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
// Legacy prices (old model)
export const STRIPE_PRICES_LEGACY = {
  monthly: 'price_1Sk2G8KHJU6KLxM31y73p1lD',    // €15/month
  quarterly: 'price_1Sk2I0KHJU6KLxM33CN9mn0E',  // €35/3 months
  annual: 'price_1Sk2JYKHJU6KLxM3QE0ffgxt',     // €150/year
} as const;

// New auto-apply plans (TODO: create in Stripe Dashboard and update IDs)
export const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_TODO',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual_TODO',
  agency_monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY || 'price_agency_monthly_TODO',
  agency_annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL || 'price_agency_annual_TODO',
} as const;

export type PriceKey = keyof typeof STRIPE_PRICES;

// Plan limits
export const PLAN_LIMITS = {
  FREE: { appsPerMonth: 10, inboxes: 1, templates: 3, autoApply: false, followUps: false, earlyAccess: false, aiModel: 'basic' },
  PRO: { appsPerMonth: 500, inboxes: 3, templates: -1, autoApply: true, followUps: true, earlyAccess: true, aiModel: 'premium' },
  AGENCY: { appsPerMonth: -1, inboxes: 10, templates: -1, autoApply: true, followUps: true, earlyAccess: true, aiModel: 'premium', seats: 5 },
} as const;

// Price display info
export const PRICE_INFO: Record<PriceKey, {
  name: string;
  price: string;
  annualPrice?: string;
  period: string;
  periodLabel: string;
  description: string;
  hasTrial: boolean;
  popular?: boolean;
  savings?: string;
  plan: 'PRO' | 'AGENCY';
}> = {
  pro_monthly: {
    name: 'Pro',
    price: '$29',
    period: 'month',
    periodLabel: 'per month',
    description: 'Auto-apply + AI cover letters + follow-ups',
    hasTrial: true,
    popular: true,
    plan: 'PRO',
  },
  pro_annual: {
    name: 'Pro (Annual)',
    price: '$23',
    annualPrice: '$276',
    period: 'month',
    periodLabel: 'per month, billed annually',
    description: 'Save 20% vs monthly',
    hasTrial: true,
    savings: 'Save 20%',
    plan: 'PRO',
  },
  agency_monthly: {
    name: 'Agency',
    price: '$89',
    period: 'month',
    periodLabel: 'per month, up to 5 seats',
    description: 'Unlimited apps, team features, API',
    hasTrial: false,
    plan: 'AGENCY',
  },
  agency_annual: {
    name: 'Agency (Annual)',
    price: '$71',
    annualPrice: '$852',
    period: 'month',
    periodLabel: 'per month, billed annually',
    description: 'Save 20% vs monthly',
    hasTrial: false,
    savings: 'Save 20%',
    plan: 'AGENCY',
  },
};

// Plan features for display
export const PLAN_FEATURES = {
  free: [
    '10 AI applications / month',
    'Browse all 13,842+ live gigs',
    'Basic AI cover letter',
    'Manual send only',
  ],
  pro: [
    'Everything in Free, plus:',
    '500 AI applications / month',
    'Auto-apply with smart filters',
    'Auto follow-ups after 5 days',
    'Premium AI model',
    'Tracking & reply analytics',
    'Send from your own inbox',
    'Early access to new jobs (3hr edge)',
  ],
  agency: [
    'Everything in Pro, plus:',
    'Unlimited applications',
    '5 seats ($15/extra seat)',
    'Shared template library',
    'Team analytics & pipeline view',
    'API access',
    'Priority support (4hr SLA)',
    'Custom AI training on your style',
  ],
};

// Create Stripe Checkout session
export async function createCheckoutSession({
  userId,
  userEmail,
  priceKey,
  successUrl,
  cancelUrl,
  source,
  jobId,
  opportunityId,
  gclid,
  promotionCodeId,
  conversionSource,
  conversionMedium,
  conversionCampaign,
}: {
  userId: string;
  userEmail: string;
  priceKey: PriceKey;
  successUrl: string;
  cancelUrl: string;
  source?: string;
  jobId?: string;
  opportunityId?: string;
  gclid?: string;
  promotionCodeId?: string; // Stripe promotion_code ID to auto-apply
  conversionSource?: string;
  conversionMedium?: string;
  conversionCampaign?: string;
}): Promise<Stripe.Checkout.Session> {
  const priceId = STRIPE_PRICES[priceKey];
  const priceInfo = PRICE_INFO[priceKey];

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
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
      ...(source && { source }),
      ...(jobId && { jobId }),
      ...(opportunityId && { opportunityId }),
      ...(gclid && { gclid }),
      ...(conversionSource && { conversionSource }),
      ...(conversionMedium && { conversionMedium }),
      ...(conversionCampaign && { conversionCampaign }),
    },
    // Add trial for monthly and annual
    subscription_data: priceInfo.hasTrial
      ? {
          trial_period_days: 2,
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
    // Apply promotion code if provided, otherwise allow manual entry
    ...(promotionCodeId
      ? { discounts: [{ promotion_code: promotionCodeId }] }
      : { allow_promotion_codes: true }),
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
