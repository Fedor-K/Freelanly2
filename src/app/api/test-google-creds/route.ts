import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

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

    // Test with googleapis library
    let indexingResult = 'not tested';
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/indexing'],
      });

      const indexing = google.indexing({ version: 'v3', auth });

      const result = await indexing.urlNotifications.publish({
        requestBody: {
          url: 'https://freelanly.com/jobs',
          type: 'URL_UPDATED',
        },
      });

      indexingResult = 'SUCCESS: ' + JSON.stringify(result.data);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        const err = e as { response?: { data?: unknown }, message?: string };
        indexingResult = 'ERROR: ' + (err.message || '') + ' | ' + JSON.stringify(err.response?.data);
      } else {
        indexingResult = 'ERROR: ' + (e instanceof Error ? e.message : String(e));
      }
    }

    return NextResponse.json({
      status: 'OK',
      client_email: creds.client_email,
      indexingResult
    });
  } catch (error) {
    return NextResponse.json({
      status: 'PARSE_ERROR',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
