import { submitToIndexNow, submitToGoogle } from '../src/lib/indexing';

async function main() {
  console.log('=== Testing Indexing ===\n');

  // Check env vars
  const indexNowKey = process.env.INDEXNOW_KEY;
  const googleCreds = process.env.GOOGLE_INDEXING_CREDENTIALS;

  console.log('INDEXNOW_KEY:', indexNowKey ? '✅ Set (' + indexNowKey.slice(0,8) + '...)' : '❌ Not set');
  console.log('GOOGLE_INDEXING_CREDENTIALS:', googleCreds ? '✅ Set' : '❌ Not set');

  if (!indexNowKey && !googleCreds) {
    console.log('\n❌ No indexing credentials configured');
    return;
  }

  // Test with a real job URL
  const testUrl = 'https://freelanly.com/jobs';
  console.log('\n📤 Testing with URL:', testUrl);

  if (indexNowKey) {
    console.log('\n--- IndexNow ---');
    const result1 = await submitToIndexNow([testUrl]);
    console.log('Result:', JSON.stringify(result1, null, 2));
  }

  if (googleCreds) {
    console.log('\n--- Google Indexing API ---');
    const result2 = await submitToGoogle([testUrl]);
    console.log('Result:', JSON.stringify(result2, null, 2));
  }

  console.log('\n✅ Test complete!');
}

main().catch(console.error);
