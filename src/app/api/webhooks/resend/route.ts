import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked';

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For click events
    click?: {
      link: string;
      timestamp: string;
    };
    // For bounce events
    bounce?: {
      type: string;
      message: string;
    };
  };
}

// Map Resend event types to our enum
function mapEventType(resendType: ResendEventType): string {
  const mapping: Record<ResendEventType, string> = {
    'email.sent': 'SENT',
    'email.delivered': 'DELIVERED',
    'email.delivery_delayed': 'DELIVERED', // Treat as delivered for now
    'email.complained': 'COMPLAINED',
    'email.bounced': 'BOUNCED',
    'email.opened': 'OPENED',
    'email.clicked': 'CLICKED',
  };
  return mapping[resendType] || 'SENT';
}

// Verify Resend webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret) {
    return false;
  }

  try {
    // Resend uses HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Resend sends signature in format: v1,signature
    const signatureParts = signature.split(',');
    const actualSignature = signatureParts.length > 1 ? signatureParts[1] : signatureParts[0];

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(actualSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('svix-signature') || request.headers.get('resend-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify signature in production
    if (process.env.NODE_ENV === 'production' && webhookSecret) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('[Resend Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload: ResendWebhookPayload = JSON.parse(rawBody);
    console.log(`[Resend Webhook] Received event: ${payload.type}`);

    // Extract data
    const { type, created_at, data } = payload;
    const eventType = mapEventType(type);
    const to = data.to?.[0] || '';

    // Build metadata based on event type
    let metadata: Record<string, unknown> = {};

    if (type === 'email.clicked' && data.click) {
      metadata = {
        link: data.click.link,
        clickedAt: data.click.timestamp,
      };
    }

    if (type === 'email.bounced' && data.bounce) {
      metadata = {
        bounceType: data.bounce.type,
        bounceMessage: data.bounce.message,
      };
    }

    // Store event in database
    await prisma.emailEvent.create({
      data: {
        messageId: data.email_id,
        type: eventType as any,
        to,
        subject: data.subject,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        timestamp: new Date(created_at),
      },
    });

    console.log(`[Resend Webhook] Stored ${eventType} event for ${to}`);

    // Handle specific events
    if (type === 'email.bounced') {
      console.warn(`[Resend Webhook] Email bounced: ${to} - ${data.bounce?.message}`);
      // Could mark user email as invalid, unsubscribe, etc.
    }

    if (type === 'email.complained') {
      console.warn(`[Resend Webhook] Spam complaint: ${to}`);
      // Should unsubscribe user from marketing emails
      await prisma.user.updateMany({
        where: { email: to },
        data: {
          unsubscribedFromMarketing: true,
          unsubscribedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Resend requires GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'Resend webhook endpoint active' });
}
