/**
 * Google Indexing API client for faster job posting indexing
 *
 * Setup:
 * 1. Create a service account in Google Cloud Console
 * 2. Enable Indexing API
 * 3. Add service account email to Search Console as owner
 * 4. Download JSON key and set GOOGLE_INDEXING_CREDENTIALS env var
 *
 * Note: Requires approval from Google for job posting URLs
 * Apply at: https://developers.google.com/search/apis/indexing-api/v3/prereqs
 */

import { createSign } from 'crypto';
import { siteConfig } from '@/config/site';

interface IndexingCredentials {
  client_email: string;
  private_key: string;
}

interface IndexingResponse {
  urlNotificationMetadata?: {
    url: string;
    latestUpdate?: {
      url: string;
      type: string;
      notifyTime: string;
    };
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// Lazy load credentials
let credentials: IndexingCredentials | null = null;

function getCredentials(): IndexingCredentials | null {
  if (credentials) return credentials;

  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credentialsJson) {
    console.warn('GOOGLE_INDEXING_CREDENTIALS not set - Indexing API disabled');
    return null;
  }

  try {
    credentials = JSON.parse(credentialsJson);
    return credentials;
  } catch (error) {
    console.error('Failed to parse GOOGLE_INDEXING_CREDENTIALS:', error);
    return null;
  }
}

/**
 * Create JWT assertion for Google OAuth
 */
function createJWTAssertion(header: object, payload: object, privateKey: string): string {
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${base64Header}.${base64Payload}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign(privateKey, 'base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Generate access token for Google Indexing API
 */
async function getAccessToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  try {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const assertion = createJWTAssertion(header, payload, creds.private_key);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    const data = await response.json();
    if (!data.access_token) {
      console.error('Failed to get access token:', data);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

/**
 * Notify Google about a new or updated job posting URL
 * URL format: /company/[companySlug]/jobs/[jobSlug]
 */
export async function notifyUrlUpdated(companySlug: string, jobSlug: string): Promise<boolean> {
  const url = `${siteConfig.url}/company/${companySlug}/jobs/${jobSlug}`;
  return notifyGoogle(url, 'URL_UPDATED');
}

/**
 * Notify Google that a job posting URL has been deleted
 * URL format: /company/[companySlug]/jobs/[jobSlug]
 */
export async function notifyUrlDeleted(companySlug: string, jobSlug: string): Promise<boolean> {
  const url = `${siteConfig.url}/company/${companySlug}/jobs/${jobSlug}`;
  return notifyGoogle(url, 'URL_DELETED');
}

/**
 * Internal function to call Google Indexing API
 */
async function notifyGoogle(url: string, type: 'URL_UPDATED' | 'URL_DELETED'): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.log('Indexing API: No access token, skipping notification');
    return false;
  }

  try {
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url, type }),
    });

    const data: IndexingResponse = await response.json();

    if (data.error) {
      console.error('Indexing API error:', data.error);
      return false;
    }

    console.log(`Indexing API: ${type} notification sent for ${url}`);
    return true;
  } catch (error) {
    console.error('Failed to notify Google Indexing API:', error);
    return false;
  }
}

/**
 * Batch notify multiple URLs (max 100 per batch)
 * Jobs should include { companySlug, jobSlug }
 */
export async function batchNotifyUrls(
  jobs: Array<{ companySlug: string; jobSlug: string }>,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 };

  // Google allows max 200 requests per day by default
  const batch = jobs.slice(0, 100);

  for (const job of batch) {
    const url = `${siteConfig.url}/company/${job.companySlug}/jobs/${job.jobSlug}`;
    const success = await notifyGoogle(url, type);
    if (success) {
      results.success++;
    } else {
      results.failed++;
    }

    // Rate limiting - 1 request per 100ms
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Get URL notification status from Google
 */
export async function getUrlStatus(companySlug: string, jobSlug: string): Promise<IndexingResponse | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const url = `${siteConfig.url}/company/${companySlug}/jobs/${jobSlug}`;

  try {
    const response = await fetch(
      `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.json();
  } catch (error) {
    console.error('Failed to get URL status:', error);
    return null;
  }
}
