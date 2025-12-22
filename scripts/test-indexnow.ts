/**
 * Test IndexNow integration
 * Run: npx tsx scripts/test-indexnow.ts
 */

import { submitToIndexNow, buildJobUrl } from '../src/lib/indexing';

async function main() {
  console.log('🧪 Testing IndexNow integration...\n');

  // Check if INDEXNOW_KEY is set
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.error('❌ INDEXNOW_KEY environment variable is not set');
    console.log('   Please set it in .env file');
    process.exit(1);
  }
  console.log(`✅ INDEXNOW_KEY is configured (${key.slice(0, 8)}...)`);

  // Build test URLs
  const testUrls = [
    buildJobUrl('test-company', 'test-job-1'),
    buildJobUrl('test-company', 'test-job-2'),
  ];

  console.log(`\n📤 Submitting ${testUrls.length} test URLs:`);
  testUrls.forEach(url => console.log(`   - ${url}`));

  // Submit to IndexNow
  console.log('\n⏳ Sending to IndexNow API...');
  const result = await submitToIndexNow(testUrls);

  console.log('\n📊 Result:');
  console.log(`   Service: ${result.service}`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Status: ${result.status || 'N/A'}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }

  // Status codes explained
  console.log('\n📝 IndexNow status codes:');
  console.log('   200 - OK, URLs submitted');
  console.log('   202 - Accepted, URLs pending');
  console.log('   400 - Bad request (invalid URLs)');
  console.log('   403 - Key not valid for this host');
  console.log('   422 - Invalid URL format');
  console.log('   429 - Too many requests');

  if (result.success) {
    console.log('\n✅ IndexNow test passed!');
  } else {
    console.log('\n❌ IndexNow test failed');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
