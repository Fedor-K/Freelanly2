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
    const pk = creds.private_key || '';

    // Check what kind of newlines are in the key
    const hasBackslashN = pk.includes('\\n');
    const hasRealNewline = pk.includes('\n');
    const first50 = pk.slice(0, 50);

    // Try to sign something
    let signResult = 'not tested';
    try {
      const { createSign } = require('crypto');
      let key = pk;
      if (hasBackslashN && !hasRealNewline) {
        key = pk.replace(/\\n/g, '\n');
      }
      const sign = createSign('RSA-SHA256');
      sign.update('test');
      sign.end();
      sign.sign(key, 'base64');
      signResult = 'OK';
    } catch (e: unknown) {
      signResult = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      status: 'OK',
      client_email: creds.client_email,
      private_key_length: pk.length,
      hasBackslashN,
      hasRealNewline,
      first50,
      signResult
    });
  } catch (error) {
    return NextResponse.json({
      status: 'PARSE_ERROR',
      message: error instanceof Error ? error.message : String(error),
      first_100_chars: credentialsJson.slice(0, 100)
    });
  }
}
