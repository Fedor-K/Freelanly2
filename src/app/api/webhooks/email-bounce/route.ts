import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/webhooks/email-bounce
 * Handles bounce notifications from Elastic Email.
 * Increments emailBounceCount on the User record.
 * Configure in Elastic Email: Settings → Notifications → HTTP webhook.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Elastic Email sends: { category, date, status, channel, to, from, ... }
    const email = body.to || body.recipient || body.email;
    const status = body.status || body.category || '';

    if (!email) {
      return NextResponse.json({ ok: true });
    }

    // Only track hard bounces (not soft/temporary)
    const isHardBounce =
      status === 'Error' ||
      status === 'Bounce' ||
      status === 'bounce' ||
      status === 'hard_bounce' ||
      (typeof body.message === 'string' && body.message.includes('RecipientNotFound'));

    if (!isHardBounce) {
      return NextResponse.json({ ok: true });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Increment bounce count
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, emailBounceCount: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailBounceCount: { increment: 1 } },
      });
      console.log(`[Bounce] Recorded bounce for ${normalizedEmail}, count: ${(user.emailBounceCount || 0) + 1}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Bounce] Webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to prevent retries
  }
}
