import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { EmailEventType } from '@prisma/client';

/**
 * POST /api/webhooks/postal?secret=<POSTAL_WEBHOOK_SECRET>
 *
 * Receives delivery events from the self-hosted Postal server and writes them to EmailEvent
 * (OPENED / CLICKED / BOUNCED / DELIVERED / COMPLAINED), reviving that table — dead since the
 * pre-Postal era. Until now the only email signal was EMAIL_SENT ("handed to Postal"); opens,
 * clicks and bounces were invisible, so we couldn't tell a slow hook from an undelivered one and
 * User.emailBounceCount never moved (we kept mailing dead addresses).
 *
 * Auth: a shared secret in the query string, the same pattern the other inbound webhooks use — set
 * POSTAL_WEBHOOK_SECRET here and put the same value in the Postal webhook URL. (Postal also signs
 * every payload with its server key; verifying that needs the server's public key from the Postal
 * admin panel, which we don't hold here — the shared secret is the pragmatic equivalent.)
 *
 * Always returns 200 for anything it understood or safely ignored, so Postal doesn't retry forever.
 */

// Postal event name → our EmailEventType. Unknown events are ignored (200, no row).
function mapEvent(event: string): EmailEventType | null {
  switch (event) {
    case 'MessageLoaded':        return 'OPENED';   // tracking pixel loaded
    case 'MessageLinkClicked':   return 'CLICKED';
    case 'MessageBounced':       return 'BOUNCED';
    case 'MessageDeliveryFailed':return 'BOUNCED';
    case 'MessageHeld':          return 'BOUNCED';  // held = not delivered
    case 'MessageDelivered':     return 'DELIVERED';
    case 'MessageSent':          return 'DELIVERED';
    default:                     return null;
  }
}

interface PostalWebhook {
  event?: string;
  timestamp?: number;
  uuid?: string;
  payload?: {
    message?: {
      id?: number;
      token?: string;
      to?: string;
      subject?: string;
      tag?: string;
      message_id?: string;
    };
    url?: string;         // MessageLinkClicked
    details?: string;     // bounce/fail detail
    output?: string;      // remote server response
    bounce?: unknown;
    spam_status?: string;
  };
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const expected = process.env.POSTAL_WEBHOOK_SECRET;
  if (expected) {
    if (!secret || secret.length !== expected.length ||
        !require('crypto').timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: PostalWebhook;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const event = body.event || '';
  const msg = body.payload?.message;
  if (!msg) return NextResponse.json({ received: true, ignored: 'no message' });

  // A spam complaint arrives as a bounce whose spam_status flags it — record it as COMPLAINED.
  let type = mapEvent(event);
  if (type === 'BOUNCED' && /spam|complain/i.test(String(body.payload?.spam_status || ''))) {
    type = 'COMPLAINED';
  }
  if (!type) return NextResponse.json({ received: true, ignored: event });

  const messageId = msg.token || msg.message_id || String(msg.id || '');
  const to = (msg.to || '').toLowerCase();
  const eventTs = body.timestamp ? new Date(body.timestamp * 1000) : new Date();

  try {
    await prisma.emailEvent.create({
      data: {
        messageId,
        type,
        to,
        subject: msg.subject || null,
        timestamp: eventTs,
        metadata: {
          tag: msg.tag || undefined,
          event,
          uuid: body.uuid || undefined,
          url: body.payload?.url || undefined,          // which link was clicked
          detail: body.payload?.details || undefined,   // bounce reason
        },
      },
    });

    // A bounce/complaint raises the user's bounce counter — the daily digest and other bulk mail
    // stop at emailBounceCount >= 3, so this is what keeps us off dead addresses. Idempotent per
    // message: only the FIRST hard-failure event for a given messageId increments.
    if ((type === 'BOUNCED' || type === 'COMPLAINED') && to) {
      const priorHardFail = await prisma.emailEvent.count({
        where: { messageId, type: { in: ['BOUNCED', 'COMPLAINED'] }, id: { not: undefined } },
      });
      // count() includes the row we just wrote (=1) — increment only when this is the first.
      if (priorHardFail <= 1) {
        await prisma.user.updateMany({
          where: { email: to },
          data: { emailBounceCount: { increment: 1 } },
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[PostalWebhook] write failed:', e instanceof Error ? e.message : e);
    // Still 200 — a DB hiccup shouldn't make Postal hammer us with retries.
  }

  return NextResponse.json({ received: true, type });
}
