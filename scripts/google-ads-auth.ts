/**
 * Google Ads OAuth2 — получение refresh token
 *
 * Требуемые env переменные:
 *   GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET
 *
 * Запуск:
 *   npx tsx scripts/google-ads-auth.ts
 */

import { createInterface } from 'readline';

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost';
const SCOPE = 'https://www.googleapis.com/auth/adwords';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\n=== Google Ads OAuth2 ===\n');
  console.log('1. Open this URL in browser:\n');
  console.log(authUrl.toString());
  console.log('\n2. Sign in and authorize');
  console.log('3. Copy the URL from the address bar (http://localhost/?code=...)\n');

  const input = await ask('Paste URL or code here: ');

  let code = input.trim();
  if (code.includes('code=')) {
    const url = new URL(code.startsWith('http') ? code : `http://localhost/?${code}`);
    code = url.searchParams.get('code') || code;
  }

  console.log('\nExchanging code for tokens...');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    console.error('\nError:', tokens.error, tokens.error_description);
    rl.close();
    process.exit(1);
  }

  console.log('\nRefresh token obtained!');
  console.log('GOOGLE_ADS_REFRESH_TOKEN=' + tokens.refresh_token);

  rl.close();
}

main().catch(console.error);
