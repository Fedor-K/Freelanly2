import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
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

// Verify Svix webhook signature (used by Resend)
// https://docs.svix.com/receiving/verifying-payloads/how-manual
function verifySvixSignature(
  payload: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  webhookSecret: string
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature || !webhookSecret) {
    console.error('[Resend Webhook] Missing required headers or secret');
    return false;
  }

  try {
    // Check timestamp to prevent replay attacks (5 minute tolerance)
    const timestamp = parseInt(svixTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      console.error('[Resend Webhook] Timestamp too old or in future');
      return false;
    }

    // Signed content is: svix_id.svix_timestamp.body
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;

    // Extract base64 secret (after whsec_ prefix)
    const secretBytes = Buffer.from(
      webhookSecret.startsWith('whsec_') ? webhookSecret.slice(6) : webhookSecret,
      'base64'
    );

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // Svix signature format: v1,base64sig v1,base64sig2 ...
    const signatures = svixSignature.split(' ');
    for (const sig of signatures) {
      const [version, signature] = sig.split(',');
      if (version === 'v1' && signature === expectedSignature) {
        return true;
      }
    }

    console.error('[Resend Webhook] Signature mismatch');
    return false;
  } catch (error) {
    console.error('[Resend Webhook] Verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Log headers for debugging
    console.log('[Resend Webhook] Headers:', {
      svixId: svixId ? 'present' : 'missing',
      svixTimestamp: svixTimestamp ? 'present' : 'missing',
      svixSignature: svixSignature ? 'present' : 'missing',
      webhookSecret: webhookSecret ? 'configured' : 'missing',
    });

    // Verify signature in production when a webhook secret is configured
    if (process.env.NODE_ENV === 'production' && webhookSecret) {
      const isValid = verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, webhookSecret);
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
        metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
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
