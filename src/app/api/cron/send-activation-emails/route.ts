import { NextRequest, NextResponse } from 'next/server';
import { processActivationEmails } from '@/services/activation-emails';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Activation Cron] Starting activation email processing...');

  try {
    const result = await processActivationEmails();

    console.log(`[Activation Cron] Completed:`, {
      processed: result.processed,
      sent: result.sent,
      errors: result.errors,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Activation Cron] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process activation emails' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing via browser
export async function GET(request: NextRequest) {
  return POST(request);
}
