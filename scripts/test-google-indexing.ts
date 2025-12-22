/**
 * Test Google Indexing API integration
 * Run: npx tsx scripts/test-google-indexing.ts
 */

import { createSign } from 'crypto';

async function main() {
  console.log('🧪 Testing Google Indexing API integration...\n');

  // Check if credentials are set
  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credentialsJson) {
    console.error('❌ GOOGLE_INDEXING_CREDENTIALS environment variable is not set');
    console.log('   Please set it in .env file with the service account JSON');
    process.exit(1);
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
    console.log(`✅ Credentials parsed successfully`);
    console.log(`   Service Account: ${credentials.client_email}`);
  } catch (e) {
    console.error('❌ Failed to parse credentials JSON:', e);
    process.exit(1);
  }

  // Test JWT creation and signing
  console.log('\n⏳ Creating JWT assertion...');
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  try {
    const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${base64Header}.${base64Payload}`;

    const sign = createSign('RSA-SHA256');
    sign.update(signatureInput);
    sign.end();
    const signature = sign.sign(credentials.private_key, 'base64url');
    const assertion = `${signatureInput}.${signature}`;

    console.log(`✅ JWT created successfully (${assertion.length} chars)`);

    // Get access token
    console.log('\n⏳ Requesting access token from Google...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('❌ Failed to get access token:', tokenData);
      process.exit(1);
    }

    console.log(`✅ Access token received (${tokenData.access_token.slice(0, 20)}...)`);
    console.log(`   Token type: ${tokenData.token_type}`);
    console.log(`   Expires in: ${tokenData.expires_in}s`);

    // Test URL submission
    const testUrl = 'https://freelanly.com/';
    console.log(`\n⏳ Testing URL submission: ${testUrl}`);

    const indexResponse = await fetch(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        body: JSON.stringify({
          url: testUrl,
          type: 'URL_UPDATED',
        }),
      }
    );

    const indexData = await indexResponse.json();

    if (indexResponse.status === 200) {
      console.log(`✅ URL submitted successfully!`);
      console.log(`   Notification time: ${indexData.urlNotificationMetadata?.latestUpdate?.notifyTime}`);
    } else {
      console.log(`❌ URL submission failed (${indexResponse.status}):`);
      console.log(JSON.stringify(indexData, null, 2));

      if (indexData.error?.message?.includes('API has not been used')) {
        console.log('\n💡 Tip: Enable the Indexing API at:');
        console.log('   https://console.cloud.google.com/apis/library/indexing.googleapis.com');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('\n✅ Google Indexing API test completed!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
