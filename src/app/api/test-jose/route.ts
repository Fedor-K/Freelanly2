import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const steps: string[] = [];

  try {
    // Step 1: Check env var
    const credsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
    if (!credsJson) {
      return NextResponse.json({ error: 'GOOGLE_INDEXING_CREDENTIALS not set', steps });
    }
    steps.push('1. Env var exists, length: ' + credsJson.length);

    // Step 2: Parse JSON
    const creds = JSON.parse(credsJson);
    steps.push('2. JSON parsed, client_email: ' + creds.client_email);

    // Step 2.5: Check private key format
    const pk = creds.private_key;
    steps.push('2.5. Key length: ' + pk.length);
    steps.push('2.6. Has \\n: ' + pk.includes('\\n'));
    steps.push('2.7. Has newline: ' + pk.includes('\n'));
    steps.push('2.8. First 60: ' + pk.slice(0, 60));
    steps.push('2.9. Last 40: ' + pk.slice(-40));

    // Step 3: Import key (with fix for extra spaces)
    const fixedKey = pk.replace(/PRIVATE\s+KEY/g, 'PRIVATE KEY');
    const privateKey = await importPKCS8(fixedKey, 'RS256');
    steps.push('3. Key imported successfully');

    // Step 4: Create JWT
    const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/indexing' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(creds.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    steps.push('4. JWT created, length: ' + jwt.length);

    // Step 5: Get token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();

    if (data.access_token) {
      steps.push('5. Got access token, length: ' + data.access_token.length);

      // Step 6: Test submit
      const indexRes = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.access_token}`,
        },
        body: JSON.stringify({ url: 'https://freelanly.com/jobs', type: 'URL_UPDATED' }),
      });
      const indexData = await indexRes.json();
      steps.push('6. Index result: ' + JSON.stringify(indexData));

      return NextResponse.json({ success: true, steps });
    } else {
      steps.push('5. Token error: ' + JSON.stringify(data));
      return NextResponse.json({ error: 'Token failed', steps });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push('ERROR: ' + msg);
    return NextResponse.json({ error: msg, steps });
  }
}
