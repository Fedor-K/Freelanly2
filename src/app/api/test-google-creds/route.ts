import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;

  if (!credentialsJson) {
    return NextResponse.json({
      status: 'NOT_SET',
      message: 'GOOGLE_INDEXING_CREDENTIALS environment variable is not set'
    });
  }

  try {
    const creds = JSON.parse(credentialsJson);
    return NextResponse.json({
      status: 'OK',
      client_email: creds.client_email,
      has_private_key: !!creds.private_key,
      private_key_length: creds.private_key?.length || 0
    });
  } catch (error) {
    return NextResponse.json({
      status: 'PARSE_ERROR',
      message: error instanceof Error ? error.message : String(error),
      first_100_chars: credentialsJson.slice(0, 100)
    });
  }
}
