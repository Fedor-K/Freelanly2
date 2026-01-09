/**
 * Google Search Console API client
 *
 * Provides search analytics data:
 * - Top queries (keywords)
 * - Clicks, impressions, CTR, position
 * - Top pages by organic traffic
 * - Country breakdown
 *
 * Uses same service account as Indexing API.
 * Requires service account to be added to Search Console property.
 */

import { SignJWT, importPKCS8 } from 'jose';
import { siteConfig } from '@/config/site';

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

interface SearchAnalyticsResponse {
  rows?: SearchAnalyticsRow[];
  responseAggregationType?: string;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export interface GSCStats {
  available: boolean;
  error?: string;
  summary: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  countries: Array<{
    country: string;
    clicks: number;
    impressions: number;
  }>;
}

// Cache credentials
let credentials: GSCCredentials | null = null;

function getCredentials(): GSCCredentials | null {
  if (credentials) return credentials;

  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credentialsJson) {
    return null;
  }

  try {
    credentials = JSON.parse(credentialsJson);
    return credentials;
  } catch {
    return null;
  }
}

/**
 * Get access token for Search Console API
 */
async function getAccessToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  try {
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
    if (!data.access_token) {
      console.error('[GSC] Failed to get access token:', data);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('[GSC] Error getting access token:', error);
    return null;
  }
}

/**
 * Query Search Console API
 */
async function querySearchAnalytics(
  accessToken: string,
  params: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    rowLimit?: number;
  }
): Promise<SearchAnalyticsResponse | null> {
  const siteUrl = siteConfig.url; // https://freelanly.com

  try {
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          startDate: params.startDate,
          endDate: params.endDate,
          dimensions: params.dimensions || [],
          rowLimit: params.rowLimit || 10,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('[GSC] API error:', data.error);
      return data;
    }

    return data;
  } catch (error) {
    console.error('[GSC] Query error:', error);
    return null;
  }
}

/**
 * Get Search Console stats for last N days
 */
export async function getGSCStats(days: number = 28): Promise<GSCStats> {
  const emptyStats: GSCStats = {
    available: false,
    summary: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    topQueries: [],
    topPages: [],
    countries: [],
  };

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { ...emptyStats, error: 'No credentials' };
  }

  // Calculate date range (GSC has 3-day delay)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const dateParams = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };

  try {
    // Parallel fetch all data
    const [summaryData, queriesData, pagesData, countriesData] = await Promise.all([
      // Summary (no dimensions)
      querySearchAnalytics(accessToken, { ...dateParams }),
      // Top queries
      querySearchAnalytics(accessToken, {
        ...dateParams,
        dimensions: ['query'],
        rowLimit: 10,
      }),
      // Top pages
      querySearchAnalytics(accessToken, {
        ...dateParams,
        dimensions: ['page'],
        rowLimit: 10,
      }),
      // Countries
      querySearchAnalytics(accessToken, {
        ...dateParams,
        dimensions: ['country'],
        rowLimit: 10,
      }),
    ]);

    // Check for errors
    if (summaryData?.error) {
      return {
        ...emptyStats,
        error: summaryData.error.message || 'API error',
      };
    }

    // Parse summary
    const summaryRow = summaryData?.rows?.[0];
    const summary = summaryRow
      ? {
          clicks: summaryRow.clicks || 0,
          impressions: summaryRow.impressions || 0,
          ctr: Math.round((summaryRow.ctr || 0) * 1000) / 10, // Convert to %
          position: Math.round((summaryRow.position || 0) * 10) / 10,
        }
      : emptyStats.summary;

    // Parse queries
    const topQueries = (queriesData?.rows || []).map((row) => ({
      query: row.keys[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 1000) / 10,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    // Parse pages
    const topPages = (pagesData?.rows || []).map((row) => ({
      page: row.keys[0]?.replace(siteConfig.url, '') || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 1000) / 10,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    // Parse countries
    const countries = (countriesData?.rows || []).map((row) => ({
      country: row.keys[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
    }));

    return {
      available: true,
      summary,
      topQueries,
      topPages,
      countries,
    };
  } catch (error) {
    console.error('[GSC] Error fetching stats:', error);
    return { ...emptyStats, error: String(error) };
  }
}

/**
 * Test GSC connection
 */
export async function testGSCConnection(): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteConfig.url)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}
