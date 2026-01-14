import { getGSCStats } from '../src/lib/google-search-console';

async function main() {
  console.log('=== GSC Stats (last 28 days) ===\n');

  const stats = await getGSCStats(28);

  if (!stats.available) {
    console.log('GSC not available:', stats.error);
    return;
  }

  console.log('--- Summary ---');
  console.log('Clicks:', stats.summary.clicks);
  console.log('Impressions:', stats.summary.impressions);
  console.log('CTR:', stats.summary.ctr + '%');
  console.log('Avg Position:', stats.summary.position);

  console.log('\n--- Top Queries ---');
  for (const q of stats.topQueries) {
    console.log(q.query.substring(0, 40).padEnd(40), '|', q.clicks, 'clicks |', q.impressions, 'imp | pos', q.position);
  }

  console.log('\n--- Top Pages ---');
  for (const p of stats.topPages) {
    console.log(p.page.substring(0, 50).padEnd(50), '|', p.clicks, 'clicks |', p.impressions, 'imp');
  }

  console.log('\n--- Countries ---');
  for (const c of stats.countries) {
    console.log(c.country.padEnd(10), '|', c.clicks, 'clicks |', c.impressions, 'imp');
  }
}

main().catch(console.error);
