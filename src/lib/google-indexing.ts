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
 * Generate JWT token for Google API authentication
 *
 * Note: This is a placeholder. In production, you would:
 * 1. npm install google-auth-library
 * 2. Use GoogleAuth to generate tokens
 *
 * For now, we use a simple fetch-based approach
 */
async function getAccessToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  // In a real implementation, you would generate a JWT and exchange it for an access token
  // For now, return null to gracefully disable the feature
  console.log('Google Indexing API: Set up google-auth-library for production use');

  // Placeholder for future implementation:
  // 1. Create JWT with RS256 signature
  // 2. Exchange JWT for access token at https://oauth2.googleapis.com/token
  // 3. Return the access token

  return null;
}

/**
 * Notify Google about a new or updated job posting URL
 */
export async function notifyUrlUpdated(jobSlug: string): Promise<boolean> {
  const url = `${siteConfig.url}/job/${jobSlug}`;
  return notifyGoogle(url, 'URL_UPDATED');
}

/**
 * Notify Google that a job posting URL has been deleted
 */
export async function notifyUrlDeleted(jobSlug: string): Promise<boolean> {
  const url = `${siteConfig.url}/job/${jobSlug}`;
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
 */
export async function batchNotifyUrls(
  jobSlugs: string[],
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 };

  // Google allows max 200 requests per day by default
  const batch = jobSlugs.slice(0, 100);

  for (const slug of batch) {
    const url = `${siteConfig.url}/job/${slug}`;
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
export async function getUrlStatus(jobSlug: string): Promise<IndexingResponse | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const url = `${siteConfig.url}/job/${jobSlug}`;

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
