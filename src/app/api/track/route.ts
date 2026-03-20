import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ActivityAction, Prisma } from '@prisma/client';

/**
 * Client-side event tracking endpoint.
 * Accepts a batch of events and writes them to ActivityLog.
 *
 * POST /api/track
 * Body: { events: [{ action, details, pageUrl, sessionId }] }
 */

const VALID_ACTIONS = new Set(Object.values(ActivityAction));
const MAX_BATCH_SIZE = 20;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array required' }, { status: 400 });
    }

    if (events.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `Max ${MAX_BATCH_SIZE} events per batch` }, { status: 400 });
    }

    // Get user from session (optional — anonymous tracking allowed)
    const session = await auth();
    const userId = session?.user?.id || null;

    // Get request metadata directly from NextRequest headers (avoid async headers() issue)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : (request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || null);
    const userAgent = request.headers.get('user-agent') || null;
    const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || null;
    const city = request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!) : (request.headers.get('cf-ipcity') || null);

    // Validate and prepare events
    const validEvents: Prisma.ActivityLogCreateManyInput[] = events
      .filter((e: { action?: string }) => e.action && VALID_ACTIONS.has(e.action as ActivityAction))
      .map((e: { action: string; details?: Record<string, unknown>; pageUrl?: string; sessionId?: string }) => ({
        userId,
        action: e.action as ActivityAction,
        details: e.details ? (e.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        pageUrl: e.pageUrl?.substring(0, 2048) || null,
        sessionId: e.sessionId || null,
        ipAddress,
        userAgent,
        country,
        city,
      }));

    if (validEvents.length === 0) {
      return NextResponse.json({ error: 'No valid events' }, { status: 400 });
    }

    // Batch insert
    await prisma.activityLog.createMany({
      data: validEvents,
    });

    return NextResponse.json({ ok: true, count: validEvents.length });
  } catch (error) {
    console.error('[Track] Error:', error);
    return NextResponse.json({ error: 'Failed to track events' }, { status: 500 });
  }
}
