/**
 * Check what Lever API actually returns
 * Usage: npx tsx scripts/check-lever-api.ts idt
 */

async function main() {
  const companySlug = process.argv[2] || 'idt';

  console.log(`Fetching Lever API for: ${companySlug}\n`);

  // Postings API
  const postingsUrl = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
  console.log('=== Postings API ===');
  console.log(`URL: ${postingsUrl}\n`);

  const postingsRes = await fetch(postingsUrl);
  const postings = await postingsRes.json();

  if (Array.isArray(postings) && postings.length > 0) {
    console.log('First job full structure:');
    console.log(JSON.stringify(postings[0], null, 2));

    console.log('\n=== All available fields ===');
    console.log(Object.keys(postings[0]));
  } else {
    console.log('No postings found or error:', postings);
  }

  // Also try the site endpoint (might have company info)
  const siteUrl = `https://api.lever.co/v0/postings/${companySlug}?mode=json&group=team`;
  console.log('\n=== Site API (grouped) ===');
  console.log(`URL: ${siteUrl}\n`);

  const siteRes = await fetch(siteUrl);
  const siteData = await siteRes.json();
  console.log('Response structure:', typeof siteData, Array.isArray(siteData) ? 'array' : 'object');

  if (siteData && !Array.isArray(siteData)) {
    console.log('Site data keys:', Object.keys(siteData));
  }
}

main().catch(console.error);
