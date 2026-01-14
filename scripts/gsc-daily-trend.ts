/**
 * GSC Daily Trend Analysis
 * Compare week-over-week to identify drops
 */

import { SignJWT, importPKCS8 } from 'jose';

interface GSCCredentials {
  client_email: string;
  private_key: string;
}

interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const SITE_URL = 'https://freelanly.com';

async function getAccessToken(): Promise<string | null> {
  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credentialsJson) {
    console.error('GOOGLE_INDEXING_CREDENTIALS not set');
    return null;
  }

  const creds: GSCCredentials = JSON.parse(credentialsJson);
  const fixedKey = creds.private_key.replace(/PRIVATE\s+KEY/g, 'PRIVATE KEY');
  const privateKey = await importPKCS8(fixedKey, 'RS256');

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(creds.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  return data.access_token || null;
}

async function queryGSC(
  accessToken: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = []
): Promise<SearchAnalyticsRow[]> {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit: 100,
      }),
    }
  );

  const data = await response.json();
  return data.rows || [];
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('=== GSC Daily Trend Analysis ===\n');

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('Failed to get access token');
    return;
  }

  // GSC has 3-day delay
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 3);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 28);

  console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log('(GSC data has 3-day delay)\n');

  // Get daily data
  const dailyData = await queryGSC(
    accessToken,
    formatDate(startDate),
    formatDate(endDate),
    ['date']
  );

  if (dailyData.length === 0) {
    console.log('No daily data available');
    return;
  }

  // Sort by date
  dailyData.sort((a, b) => a.keys[0].localeCompare(b.keys[0]));

  console.log('--- Daily Traffic ---');
  console.log('Date       | Clicks | Impressions | CTR   | Position');
  console.log('-----------|--------|-------------|-------|----------');

  let totalClicks = 0;
  let totalImpressions = 0;
  const weeklyData: { [week: string]: { clicks: number; impressions: number; days: number } } = {};

  for (const row of dailyData) {
    const date = row.keys[0];
    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    const ctr = ((row.ctr || 0) * 100).toFixed(1);
    const position = (row.position || 0).toFixed(1);

    console.log(`${date} | ${String(clicks).padStart(6)} | ${String(impressions).padStart(11)} | ${ctr.padStart(5)}% | ${position.padStart(8)}`);

    totalClicks += clicks;
    totalImpressions += impressions;

    // Group by week
    const d = new Date(date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
    const weekKey = formatDate(weekStart);

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { clicks: 0, impressions: 0, days: 0 };
    }
    weeklyData[weekKey].clicks += clicks;
    weeklyData[weekKey].impressions += impressions;
    weeklyData[weekKey].days++;
  }

  console.log('\n--- Weekly Comparison ---');
  console.log('Week of    | Clicks | Impressions | Avg Clicks/Day');
  console.log('-----------|--------|-------------|----------------');

  const weeks = Object.keys(weeklyData).sort();
  let prevWeekClicks = 0;

  for (const week of weeks) {
    const data = weeklyData[week];
    const avgPerDay = (data.clicks / data.days).toFixed(1);
    const change = prevWeekClicks > 0
      ? ((data.clicks - prevWeekClicks) / prevWeekClicks * 100).toFixed(1)
      : 'N/A';

    console.log(`${week} | ${String(data.clicks).padStart(6)} | ${String(data.impressions).padStart(11)} | ${avgPerDay.padStart(14)} (${change}%)`);
    prevWeekClicks = data.clicks;
  }

  // Compare last 7 days vs previous 7 days
  const last7 = dailyData.slice(-7);
  const prev7 = dailyData.slice(-14, -7);

  const last7Clicks = last7.reduce((sum, r) => sum + (r.clicks || 0), 0);
  const prev7Clicks = prev7.reduce((sum, r) => sum + (r.clicks || 0), 0);
  const last7Impressions = last7.reduce((sum, r) => sum + (r.impressions || 0), 0);
  const prev7Impressions = prev7.reduce((sum, r) => sum + (r.impressions || 0), 0);

  const clicksChange = prev7Clicks > 0 ? ((last7Clicks - prev7Clicks) / prev7Clicks * 100) : 0;
  const impressionsChange = prev7Impressions > 0 ? ((last7Impressions - prev7Impressions) / prev7Impressions * 100) : 0;

  console.log('\n--- Week over Week Change ---');
  console.log(`Last 7 days:     ${last7Clicks} clicks, ${last7Impressions} impressions`);
  console.log(`Previous 7 days: ${prev7Clicks} clicks, ${prev7Impressions} impressions`);
  console.log(`Change: ${clicksChange >= 0 ? '+' : ''}${clicksChange.toFixed(1)}% clicks, ${impressionsChange >= 0 ? '+' : ''}${impressionsChange.toFixed(1)}% impressions`);

  if (clicksChange < -20) {
    console.log('\n⚠️  SIGNIFICANT DROP DETECTED in clicks!');
  }
  if (impressionsChange < -20) {
    console.log('\n⚠️  SIGNIFICANT DROP DETECTED in impressions!');
  }

  // Check for indexing issues - get page data
  console.log('\n--- Checking for deindexed pages ---');
  const pageData = await queryGSC(
    accessToken,
    formatDate(new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)),
    formatDate(endDate),
    ['page']
  );

  const jobPages = pageData.filter(p => p.keys[0].includes('/company/') && p.keys[0].includes('/jobs/'));
  const categoryPages = pageData.filter(p => p.keys[0].match(/\/jobs\/[a-z-]+$/));

  console.log(`Job pages with impressions: ${jobPages.length}`);
  console.log(`Category pages with impressions: ${categoryPages.length}`);

  // Check country breakdown
  console.log('\n--- Country Breakdown (last 7 days) ---');
  const countryData = await queryGSC(
    accessToken,
    formatDate(new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)),
    formatDate(endDate),
    ['country']
  );

  countryData.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
  console.log('Country | Clicks | Impressions');
  console.log('--------|--------|------------');
  for (const row of countryData.slice(0, 10)) {
    console.log(`${row.keys[0].padEnd(7)} | ${String(row.clicks || 0).padStart(6)} | ${String(row.impressions || 0).padStart(11)}`);
  }
}

main().catch(console.error);
