import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

/**
 * Daily Report Endpoint
 * GET /api/admin/daily-report?date=2026-03-11
 *
 * Returns all key metrics for a specific day (00:00 - 23:59:59.999 UTC).
 * Read-only — no writes to DB or Stripe.
 */
export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: 'Missing or invalid date parameter. Use format: YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateParam}T23:59:59.999Z`);

    if (isNaN(dayStart.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const dateRange = { gte: dayStart, lte: dayEnd };

    // Fetch all data in parallel
    const [
      registrations,
      newAlertsByCategory,
      cancellations,
      newJobs,
      newAlerts,
      emailsSent,
      emailsDelivered,
      emailsClicked,
      stripePayments,
      googleAdsData,
    ] = await Promise.all([
      // 1. New user registrations
      prisma.user.count({ where: { createdAt: dateRange } }),

      // 2. Alert categories created by users who registered this day
      prisma.jobAlert.groupBy({
        by: ['category'],
        where: { createdAt: dateRange },
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
        take: 10,
      }),

      // 3. Cancellation feedback
      prisma.cancellationFeedback.findMany({
        where: { createdAt: dateRange },
        select: {
          reason: true,
          otherText: true,
          feedback: true,
          planAtCancellation: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 4. New jobs
      prisma.job.count({ where: { createdAt: dateRange } }),

      // 5. New job alerts
      prisma.jobAlert.count({ where: { createdAt: dateRange } }),

      // 6-8. Email events
      prisma.emailEvent.count({ where: { type: 'SENT', timestamp: dateRange } }),
      prisma.emailEvent.count({ where: { type: 'DELIVERED', timestamp: dateRange } }),
      prisma.emailEvent.count({ where: { type: 'CLICKED', timestamp: dateRange } }),

      // 9. Stripe checkout sessions (completed payments)
      getStripePayments(dayStart, dayEnd),

      // 10. Google Ads
      getGoogleAds(dateParam),
    ]);

    // Format categories
    const registrationsByCategory = newAlertsByCategory.map((g) => ({
      category: g.category,
      count: g._count.category,
    }));

    return NextResponse.json({
      success: true,
      date: dateParam,
      registrations,
      registrationsByCategory,
      payments: {
        count: stripePayments.length,
        totalAmount: stripePayments.reduce((sum, p) => sum + p.amount, 0),
        currency: 'EUR',
        sessions: stripePayments,
      },
      cancellations: {
        count: cancellations.length,
        items: cancellations.map((c) => ({
          email: c.user?.email || 'unknown',
          reason: c.reason,
          otherText: c.otherText,
          feedback: c.feedback,
          plan: c.planAtCancellation,
        })),
      },
      newJobs,
      newAlerts,
      emails: {
        sent: emailsSent,
        delivered: emailsDelivered,
        clicked: emailsClicked,
      },
      googleAds: googleAdsData,
    });
  } catch (error) {
    console.error('[DailyReport] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily report', details: String(error) },
      { status: 500 }
    );
  }
}

async function getStripePayments(dayStart: Date, dayEnd: Date) {
  try {
    const stripe = getStripe();
    const sessions = await stripe.checkout.sessions.list({
      created: {
        gte: Math.floor(dayStart.getTime() / 1000),
        lte: Math.floor(dayEnd.getTime() / 1000),
      },
      status: 'complete',
      limit: 100,
    });

    return sessions.data.map((s) => ({
      email: s.customer_email || 'unknown',
      amount: s.amount_total ? s.amount_total / 100 : 0,
      currency: s.currency || 'eur',
      priceKey: s.metadata?.priceKey || 'unknown',
    }));
  } catch (error) {
    console.error('[DailyReport] Stripe error:', error);
    return [];
  }
}

async function getGoogleAds(date: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://freelanly.com';
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return null;

    const res = await fetch(
      `${baseUrl}/api/admin/google-ads?action=account-report&from=${date}&to=${date}`,
      {
        headers: { Authorization: `Bearer ${cronSecret}` },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const dayData = data.report?.find((r: { date: string }) => r.date === date);

    if (!dayData) return { impressions: 0, clicks: 0, cost: 0, conversions: 0, ctr: 0, cpc: 0 };

    return {
      impressions: dayData.impressions || 0,
      clicks: dayData.clicks || 0,
      cost: dayData.cost || 0,
      conversions: dayData.conversions || 0,
      ctr: dayData.ctr || 0,
      cpc: dayData.averageCpc || 0,
    };
  } catch (error) {
    console.error('[DailyReport] Google Ads error:', error);
    return null;
  }
}
