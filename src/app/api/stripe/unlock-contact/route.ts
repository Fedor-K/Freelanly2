import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { siteConfig } from '@/config/site';

/**
 * A/B pricing by country GDP tier.
 * Low-GDP countries: €1, Mid: €2, High: €3
 */

// Low GDP — €1 (100 cents)
const LOW_GDP_COUNTRIES = new Set([
  'IN', 'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA', 'VN',
  'PH', 'ID', 'NG', 'KE', 'GH', 'TZ', 'UG', 'ET', 'EG',
  'MA', 'TN', 'DZ', 'UA', 'UZ', 'KG', 'TJ',
]);

// Mid GDP — €2 (200 cents)
const MID_GDP_COUNTRIES = new Set([
  'BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'EC', 'CR',
  'TR', 'ZA', 'TH', 'MY', 'CN', 'RU', 'BY', 'KZ',
  'RO', 'BG', 'RS', 'HR', 'HU', 'PL', 'CZ', 'SK',
  'GR', 'PT',
]);

// Everything else (US, EU, UK, AU, CA, etc.) — €3 (300 cents)

function getPriceCents(countryCode: string | null): number {
  if (!countryCode) return 300;
  const cc = countryCode.toUpperCase();
  if (LOW_GDP_COUNTRIES.has(cc)) return 100;
  if (MID_GDP_COUNTRIES.has(cc)) return 200;
  return 300;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`;
}

/**
 * POST /api/stripe/unlock-contact
 * Creates a Stripe Checkout session for a single contact unlock.
 * Price varies by country: €1 (low GDP), €2 (mid), €3 (high).
 * Body: { jobId?: string, opportunityId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { jobId, opportunityId } = await request.json();
    if (!jobId && !opportunityId) {
      return NextResponse.json({ error: 'jobId or opportunityId required' }, { status: 400 });
    }

    const stripe = getStripe();
    const itemId = jobId || opportunityId;
    const itemType = jobId ? 'job' : 'opportunity';

    // Detect country from Vercel headers
    const country = request.headers.get('x-vercel-ip-country') || null;
    const priceCents = getPriceCents(country);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: session.user.email,
      client_reference_id: session.user.id,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Unlock Contact Details',
              description: 'One-time access to contact details for this job/project',
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.user.id,
        itemId,
        itemType,
        type: 'unlock_contact',
        source: 'upgrade_modal',
        priceKey: 'single_contact',
        country: country || 'unknown',
        priceCents: String(priceCents),
      },
      success_url: `${siteConfig.url}/dashboard?payment=success&unlock=${itemType}`,
      cancel_url: `${siteConfig.url}/${itemType === 'job' ? 'jobs' : 'freelance'}`,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      price: formatPrice(priceCents),
      country,
    });
  } catch (error) {
    console.error('[Unlock Contact] Error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}

/**
 * GET /api/stripe/unlock-contact
 * Returns the price for current user's country (used by frontend to show correct price).
 */
export async function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country') || null;
  const priceCents = getPriceCents(country);
  return NextResponse.json({
    price: formatPrice(priceCents),
    priceCents,
    country,
  });
}
