import { NextRequest, NextResponse } from 'next/server';
import { processPostsFromDataset, processPostsFromRun } from '@/services/linkedin-processor';

// Apify Webhook Endpoint
// Configure in Apify: https://console.apify.com -> Actor -> Integrations -> Webhooks
// URL: https://yoursite.com/api/webhooks/apify?secret=YOUR_WEBHOOK_SECRET
// Event types: ACTOR.RUN.SUCCEEDED

interface ApifyWebhookPayload {
  eventType: string;
  eventData: {
    actorId: string;
    actorRunId: string;
    actorTaskId?: string;
    defaultDatasetId: string;
    defaultKeyValueStoreId: string;
    buildId: string;
    buildNumber: string;
    status: 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
    startedAt: string;
    finishedAt: string;
    statusMessage?: string;
  };
  createdAt: string;
  userId: string;
  resource: {
    id: string;
    actId: string;
    userId: string;
    startedAt: string;
    finishedAt: string;
    status: string;
    defaultDatasetId: string;
    defaultKeyValueStoreId: string;
  };
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.nextUrl.searchParams.get('secret');
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;

  if (webhookSecret && secret !== webhookSecret) {
    console.error('Invalid webhook secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload: ApifyWebhookPayload = await request.json();

    console.log('Received Apify webhook:', {
      eventType: payload.eventType,
      actorRunId: payload.eventData?.actorRunId,
      status: payload.eventData?.status,
    });

    // Only process successful runs
    if (payload.eventType !== 'ACTOR.RUN.SUCCEEDED') {
      console.log(`Ignoring event type: ${payload.eventType}`);
      return NextResponse.json({
        success: true,
        message: `Ignored event type: ${payload.eventType}`,
      });
    }

    if (payload.eventData.status !== 'SUCCEEDED') {
      console.log(`Run status not SUCCEEDED: ${payload.eventData.status}`);
      return NextResponse.json({
        success: true,
        message: `Run not succeeded: ${payload.eventData.status}`,
      });
    }

    // Process the dataset
    const datasetId = payload.eventData.defaultDatasetId || payload.resource?.defaultDatasetId;

    if (!datasetId) {
      console.error('No dataset ID in webhook payload');
      return NextResponse.json({ error: 'No dataset ID provided' }, { status: 400 });
    }

    console.log(`Processing dataset: ${datasetId}`);

    const stats = await processPostsFromDataset(datasetId);

    console.log('Processing completed:', stats);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Apify webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;

  if (webhookSecret && secret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'Apify webhook endpoint is ready',
    usage: {
      method: 'POST',
      url: '/api/webhooks/apify?secret=YOUR_SECRET',
      eventTypes: ['ACTOR.RUN.SUCCEEDED'],
    },
  });
}
