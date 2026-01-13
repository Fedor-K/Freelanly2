import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Vercel Analytics Drain Webhook
 *
 * Receives Web Analytics events from Vercel Drains and stores them in PostgreSQL.
 * Configure in Vercel Dashboard → Team Settings → Drains → Add Drain → Custom HTTP
 *
 * URL: https://freelanly.com/api/webhooks/vercel-analytics
 * Format: NDJSON
 * Verification Secret: Set in env VERCEL_DRAIN_SECRET
 */

const DRAIN_SECRET = process.env.VERCEL_DRAIN_SECRET || 'aP1GV1qbmZ3vYs3g8FWJK5aFtRAiafF5';

// Vercel sends events in NDJSON format (newline-delimited JSON)
interface VercelAnalyticsEvent {
  type: 'pageview' | 'custom';
  timestamp: string;

  // For custom events
  name?: string;
  data?: Record<string, unknown>;

  // Page info
  path?: string;
  referrer?: string;

  // Visitor info
  visitorId?: string;
  sessionId?: string;

  // Geo
  geo?: {
    country?: string;
    city?: string;
    region?: string;
  };

  // Device
  device?: {
    type?: string;    // desktop, mobile, tablet
    browser?: string;
    os?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify the secret (Vercel sends it in x-vercel-signature or Authorization header)
    const authHeader = request.headers.get('authorization');
    const signature = request.headers.get('x-vercel-signature');

    const providedSecret = authHeader?.replace('Bearer ', '') || signature;

    if (providedSecret && providedSecret !== DRAIN_SECRET) {
      console.error('[Vercel Analytics] Invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the raw body
    const body = await request.text();

    if (!body) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    // Parse NDJSON (each line is a separate JSON object)
    const lines = body.split('\n').filter(line => line.trim());
    const events: VercelAnalyticsEvent[] = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line) as VercelAnalyticsEvent;
        events.push(event);
      } catch {
        console.error('[Vercel Analytics] Failed to parse line:', line);
      }
    }

    if (events.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // Filter to only custom events (skip pageviews to reduce storage)
    const customEvents = events.filter(e => e.type === 'custom' && e.name);

    if (customEvents.length === 0) {
      return NextResponse.json({ success: true, processed: 0, skipped: events.length });
    }

    // Batch insert events
    const created = await prisma.analyticsEvent.createMany({
      data: customEvents.map(event => ({
        name: event.name!,
        properties: event.data as object || null,
        path: event.path || null,
        referrer: event.referrer || null,
        visitorId: event.visitorId || null,
        sessionId: event.sessionId || null,
        country: event.geo?.country || null,
        city: event.geo?.city || null,
        device: event.device?.type || null,
        browser: event.device?.browser || null,
        os: event.device?.os || null,
        timestamp: new Date(event.timestamp),
      })),
      skipDuplicates: true,
    });

    console.log(`[Vercel Analytics] Stored ${created.count} custom events`);

    return NextResponse.json({
      success: true,
      processed: created.count,
      received: events.length,
      customEvents: customEvents.length,
    });
  } catch (error) {
    console.error('[Vercel Analytics] Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process events', details: String(error) },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'vercel-analytics-drain',
    description: 'Receives Web Analytics events from Vercel Drains',
  });
}
