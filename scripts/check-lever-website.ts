/**
 * Extract company website from Lever job page footer
 * Usage: npx tsx scripts/check-lever-website.ts idt
 */

async function main() {
  const companySlug = process.argv[2] || 'idt';

  // First get a job ID from the API
  const apiUrl = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
  const apiRes = await fetch(apiUrl);
  const jobs = await apiRes.json();

  if (!Array.isArray(jobs) || jobs.length === 0) {
    console.log('No jobs found');
    return;
  }

  const jobId = jobs[0].id;
  const jobPageUrl = `https://jobs.lever.co/${companySlug}/${jobId}`;

  console.log(`Fetching job page: ${jobPageUrl}\n`);

  const pageRes = await fetch(jobPageUrl);
  const html = await pageRes.text();

  // Look for company home page link in footer
  // Pattern: <a class="company-url" href="https://idt.by" ...>IDT Home Page</a>
  // Or: <a href="..." ...>Company Name Home Page</a>

  // Try multiple patterns
  const patterns = [
    /<a[^>]+class="[^"]*company-url[^"]*"[^>]+href="([^"]+)"/i,
    /<a[^>]+href="([^"]+)"[^>]*>\s*\w+\s*Home\s*Page/i,
    /href="(https?:\/\/[^"]+)"[^>]*>[^<]*Home\s*Page/i,
    /<footer[\s\S]*?href="(https?:\/\/(?!jobs\.lever\.co)[^"]+)"/i,
  ];

  console.log('=== Searching for company website ===\n');

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      console.log(`Found with pattern: ${pattern}`);
      console.log(`Website: ${match[1]}\n`);
    }
  }

  // Also extract all external links from page for analysis
  const allLinks = html.matchAll(/href="(https?:\/\/(?!jobs\.lever\.co)[^"]+)"/g);
  const externalLinks = new Set<string>();
  for (const m of allLinks) {
    externalLinks.add(m[1]);
  }

  console.log('=== All external links on page ===');
  for (const link of externalLinks) {
    console.log(link);
  }

  // Check for specific footer section
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch) {
    console.log('\n=== Footer HTML ===');
    console.log(footerMatch[1].substring(0, 1000));
  }
}

main().catch(console.error);
