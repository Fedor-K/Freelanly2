import { NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * GSC Daily Trend API
 * GET /api/admin/gsc-trend
 *
 * Returns day-by-day GSC data to identify traffic drops
 */

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
  if (!credentialsJson) return null;

  try {
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
  } catch {
    return null;
  }
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

export async function GET() {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'No GSC credentials' }, { status: 500 });
    }

    // GSC has 3-day delay
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 3);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 28);

    // Get daily data
    const dailyData = await queryGSC(
      accessToken,
      formatDate(startDate),
      formatDate(endDate),
      ['date']
    );

    dailyData.sort((a, b) => a.keys[0].localeCompare(b.keys[0]));

    // Format daily data
    const daily = dailyData.map(row => ({
      date: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 1000) / 10,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    // Calculate week-over-week
    const last7 = dailyData.slice(-7);
    const prev7 = dailyData.slice(-14, -7);

    const last7Clicks = last7.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const prev7Clicks = prev7.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const last7Impressions = last7.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const prev7Impressions = prev7.reduce((sum, r) => sum + (r.impressions || 0), 0);

    const clicksChange = prev7Clicks > 0 ? ((last7Clicks - prev7Clicks) / prev7Clicks * 100) : 0;
    const impressionsChange = prev7Impressions > 0 ? ((last7Impressions - prev7Impressions) / prev7Impressions * 100) : 0;

    // Get query changes - compare same queries across periods
    const [recentQueries, oldQueries] = await Promise.all([
      queryGSC(accessToken, formatDate(new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)), formatDate(endDate), ['query']),
      queryGSC(accessToken, formatDate(new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000)), formatDate(new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)), ['query']),
    ]);

    // Find queries that dropped
    const oldQueryMap = new Map(oldQueries.map(q => [q.keys[0], q]));
    const droppedQueries = [];

    for (const oldQ of oldQueries) {
      const query = oldQ.keys[0];
      const recentQ = recentQueries.find(r => r.keys[0] === query);
      const oldClicks = oldQ.clicks || 0;
      const newClicks = recentQ?.clicks || 0;

      if (oldClicks > 5 && newClicks < oldClicks * 0.5) {
        droppedQueries.push({
          query,
          oldClicks,
          newClicks,
          change: Math.round((newClicks - oldClicks) / oldClicks * 100),
        });
      }
    }

    droppedQueries.sort((a, b) => a.change - b.change);

    // Get page changes
    const [recentPages, oldPages] = await Promise.all([
      queryGSC(accessToken, formatDate(new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)), formatDate(endDate), ['page']),
      queryGSC(accessToken, formatDate(new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000)), formatDate(new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)), ['page']),
    ]);

    const droppedPages = [];
    for (const oldP of oldPages) {
      const page = oldP.keys[0].replace(SITE_URL, '');
      const recentP = recentPages.find(r => r.keys[0] === oldP.keys[0]);
      const oldClicks = oldP.clicks || 0;
      const newClicks = recentP?.clicks || 0;

      if (oldClicks > 3 && newClicks < oldClicks * 0.5) {
        droppedPages.push({
          page,
          oldClicks,
          newClicks,
          change: Math.round((newClicks - oldClicks) / oldClicks * 100),
        });
      }
    }

    droppedPages.sort((a, b) => a.change - b.change);

    // Determine severity
    let severity: 'normal' | 'warning' | 'critical' = 'normal';
    if (clicksChange < -30 || impressionsChange < -30) {
      severity = 'critical';
    } else if (clicksChange < -15 || impressionsChange < -15) {
      severity = 'warning';
    }

    return NextResponse.json({
      success: true,
      dateRange: {
        start: formatDate(startDate),
        end: formatDate(endDate),
        note: 'GSC data has 3-day delay',
      },
      daily,
      weekOverWeek: {
        last7Days: {
          clicks: last7Clicks,
          impressions: last7Impressions,
          avgClicksPerDay: Math.round(last7Clicks / 7 * 10) / 10,
        },
        prev7Days: {
          clicks: prev7Clicks,
          impressions: prev7Impressions,
          avgClicksPerDay: Math.round(prev7Clicks / 7 * 10) / 10,
        },
        change: {
          clicks: Math.round(clicksChange * 10) / 10,
          impressions: Math.round(impressionsChange * 10) / 10,
        },
        severity,
      },
      droppedQueries: droppedQueries.slice(0, 10),
      droppedPages: droppedPages.slice(0, 10),
    });
  } catch (error) {
    console.error('[GSC-Trend] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
