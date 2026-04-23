import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Elastic Email webhook endpoint
 * Receives: sent, opened, clicked, unsubscribed, complained, bounced events
 * Configure at: Elastic Email Dashboard → Settings → Notifications → Manage Webhook
 * URL: https://freelanly.com/api/webhooks/elasticemail
 */

// Map Elastic Email event categories to our types
function mapEventType(category: string): string {
  const c = category.toLowerCase();
  if (c === 'sent') return 'SENT';
  if (c === 'opened') return 'OPENED';
  if (c === 'clicked') return 'CLICKED';
  if (c === 'unsubscribed') return 'UNSUBSCRIBED';
  if (c === 'complaint' || c === 'complaints' || c === 'complained') return 'COMPLAINED';
  if (c === 'error' || c === 'bounce' || c.includes('blacklisted') || c.includes('nomailbox')) return 'BOUNCED';
  return 'SENT';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Elastic Email sends events in different formats
    // Support both single event and batch
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      const category = event.category || event.status || event.event || '';
      const eventType = mapEventType(category);
      const to = event.to || event.recipient || '';
      const subject = event.subject || '';
      const messageId = event.messageid || event.message_id || event.transactionid || '';

      // Build metadata
      let metadata: Record<string, unknown> = {};
      if (eventType === 'CLICKED' && event.target) {
        metadata.link = event.target;
      }
      if (eventType === 'BOUNCED') {
        metadata.bounceCategory = event.category;
        metadata.bounceMessage = event.errormsg || event.error || '';
      }

      // Store event
      await prisma.emailEvent.create({
        data: {
          messageId,
          type: eventType as any,
          to,
          subject,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          timestamp: event.date ? new Date(event.date) : new Date(),
        },
      });

      // Handle bounces — deactivate alerts
      if (eventType === 'BOUNCED' && to) {
        console.warn(`[ElasticEmail Webhook] Bounce: ${to} - ${event.category}`);
      }

      // Handle complaints — unsubscribe
      if (eventType === 'COMPLAINED' && to) {
        console.warn(`[ElasticEmail Webhook] Complaint: ${to}`);
        await prisma.user.updateMany({
          where: { email: to },
          data: {
            unsubscribedFromMarketing: true,
            unsubscribedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ElasticEmail Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Elastic Email validates webhook URL with GET request
export async function GET() {
  return NextResponse.json({ status: 'Elastic Email webhook endpoint active' });
}
