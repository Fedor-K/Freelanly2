/**
 * Search Engine Indexing Service
 *
 * Notifies search engines about new/updated URLs for faster indexing.
 * Supports:
 * - IndexNow (Bing, Yandex, Seznam, Naver)
 * - Google Indexing API (requires setup)
 */

import { createSign } from 'crypto';
import { siteConfig } from '@/config/site';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY;
const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  // Can also submit directly to specific engines:
  // 'https://www.bing.com/indexnow',
  // 'https://yandex.com/indexnow',
];

interface IndexingResult {
  service: string;
  success: boolean;
  status?: number;
  error?: string;
}

/**
 * Submit URLs to IndexNow (Bing, Yandex, and other participating search engines)
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexingResult> {
  if (!INDEXNOW_KEY) {
    console.warn('⚠️ INDEXNOW_KEY not configured, skipping IndexNow submission');
    return { service: 'IndexNow', success: false, error: 'Key not configured' };
  }

  if (urls.length === 0) {
    return { service: 'IndexNow', success: true, status: 200 };
  }

  // IndexNow accepts up to 10,000 URLs per request
  const batchSize = 10000;
  const batches = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  try {
    const host = new URL(siteConfig.url).host;
    const keyLocation = `${siteConfig.url}/${INDEXNOW_KEY}.txt`;

    for (const batch of batches) {
      const payload = {
        host,
        key: INDEXNOW_KEY,
        keyLocation,
        urlList: batch,
      };

      // Submit to IndexNow API (automatically shared with all participating engines)
      const response = await fetch(INDEXNOW_ENDPOINTS[0], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (response.status !== 200 && response.status !== 202) {
        const errorText = await response.text();
        console.error(`❌ IndexNow error: ${response.status} - ${errorText}`);
        return {
          service: 'IndexNow',
          success: false,
          status: response.status,
          error: errorText,
        };
      }
    }

    const timestamp = new Date().toISOString();
    console.log(`✅ IndexNow [${timestamp}]: Submitted ${urls.length} URLs:`);
    urls.forEach(url => console.log(`   → ${url}`));
    return { service: 'IndexNow', success: true, status: 200 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ IndexNow error: ${errorMessage}`);
    return { service: 'IndexNow', success: false, error: errorMessage };
  }
}

/**
 * Submit URLs to Google Indexing API
 * Requires Google Cloud service account credentials
 *
 * Setup:
 * 1. Create Google Cloud project
 * 2. Enable Indexing API
 * 3. Create service account
 * 4. Add service account to Search Console
 * 5. Set GOOGLE_INDEXING_CREDENTIALS env var with JSON key
 */
export async function submitToGoogle(urls: string[]): Promise<IndexingResult> {
  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;

  if (!credentialsJson) {
    // Silently skip if not configured - Google API is optional
    return { service: 'Google', success: false, error: 'Credentials not configured' };
  }

  try {
    const credentials = JSON.parse(credentialsJson);

    // Google Indexing API requires OAuth2 JWT authentication
    const jwt = await getGoogleJWT(credentials);

    // Google allows batch requests but recommends single URL submissions
    // Rate limit: 200 requests per day for new sites
    const results = await Promise.all(
      urls.slice(0, 200).map(url => submitSingleToGoogle(url, jwt))
    );

    const successCount = results.filter(r => r).length;
    console.log(`✅ Google: Submitted ${successCount}/${urls.length} URLs`);

    return {
      service: 'Google',
      success: successCount > 0,
      status: 200,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Google Indexing error: ${errorMessage}`);
    return { service: 'Google', success: false, error: errorMessage };
  }
}

/**
 * Generate Google OAuth2 JWT token
 */
async function getGoogleJWT(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const assertion = createJWTAssertion(header, payload, credentials.private_key);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await tokenResponse.json();

  if (!data.access_token) {
    console.error('❌ Google OAuth error:', data);
    throw new Error(data.error_description || data.error || 'Failed to get access token');
  }

  return data.access_token;
}

/**
 * Create JWT assertion with RS256 signing
 */
function createJWTAssertion(
  header: object,
  payload: object,
  privateKey: string
): string {
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${base64Header}.${base64Payload}`;

  // Sign with RS256 using Node.js crypto
  const sign = createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign(privateKey, 'base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Submit single URL to Google Indexing API
 */
async function submitSingleToGoogle(url: string, accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          url: url,
          type: 'URL_UPDATED',
        }),
      }
    );

    if (response.status !== 200) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ Google Indexing error for ${url}:`, errorData);
    }

    return response.status === 200;
  } catch (error) {
    console.error(`❌ Google Indexing error for ${url}:`, error);
    return false;
  }
}

/**
 * Main function - submit URLs to all configured search engines
 */
export async function notifySearchEngines(urls: string[]): Promise<IndexingResult[]> {
  if (urls.length === 0) {
    return [];
  }

  // Filter to only valid URLs
  const validUrls = urls.filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });

  if (validUrls.length === 0) {
    return [];
  }

  console.log(`📤 Submitting ${validUrls.length} URLs to search engines...`);

  const results = await Promise.all([
    submitToIndexNow(validUrls),
    submitToGoogle(validUrls),
  ]);

  return results;
}

/**
 * Build job URL from company slug and job slug
 */
export function buildJobUrl(companySlug: string, jobSlug: string): string {
  return `${siteConfig.url}/company/${companySlug}/jobs/${jobSlug}`;
}

/**
 * Build company URL from slug
 */
export function buildCompanyUrl(companySlug: string): string {
  return `${siteConfig.url}/company/${companySlug}`;
}
