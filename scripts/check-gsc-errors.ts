// Google Search Console - Check indexing errors
import { google } from 'googleapis';

const GSC_CREDENTIALS = {
  client_email: "freelanly2@freelanly2.iam.gserviceaccount.com",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDhns/eprgjUZ5C
cIJCSqkbOnSZNm3iBz0P5PA0R9QjvKPR+v/pg3ciF0CV7OU+mPUku81nYtuiIYTW
f4u7D534Voirp9xXP+zJLU12IBiCayju9HfOxiK93dxB07Js0m9zzSfBYge5+rol
4QPH38h4iIm+nng0zEWa0vmSW/wPtXxzthoKOkPF9H8id3Pfa2otVaN2Ld5bNU+x
aGdU+yLLVU+bfvDI0vd4ko7jO8Hj3VBLNDPsFZ5oQ6hbJA5B+9WFHsS6e9UJl+lQ
bnigJzZTGz9/EKq8cdbAAx38yNPPrRLyQxwfLKE8JkgvMtYGDBwPmyVtG9zJDO1t
NqYgnEHdAgMBAAECggEAYtFL+hjLTazRxAfDBYXtyx8vMmvEdNr2w59iFYPgRka4
+Z8VtxD9fNDyWLgJMAGOXShkLoP97mT/6XKzoJqWdc5wzb4Xo5879mEBLFuiYHzO
0NoCH25oiQBDGBHAdCk252FTqD9nYu2N2klTfpdlFmW27uY5f+Z4FfeRl6jyHW5s
0o2aw1OyHJv6NBPp1xwV4md9Q2yuhf8YmWjcOyx26ARNWUlwvBf7jsES4nkA6Em6
oYTkLMXPoawL6zM0Im3hEJJlO+V/3pkU/Z3N0YSQc0Fd3BR7DzG65TSOmGWQeGS3
2WRc319x2T5xN7N8Mi/Rf2SHsLjxFjozsOC1jqcjgQKBgQD+to4fRYXSPYE3t7Pq
O2/fajna7o9ZzkbTDRe9qvtNiwI+Y6fMm5VllpGcpxFAJQEK3jOUnrlfJTvO3k0Y
Jg4klKkVSyRuFR+X/WZkKuwET9o3e4aenJQX+hwk/reWUC4z6zLg4fBpRALJUsz+
t7t7/RWER/CwyG70lnqtzr7/twKBgQDiwqDeXPosm3I4JduHi2K9SmjX2AMaN3oO
1NHBB9Em+ijsbG90CcYQQMj+ebSbtH3Hd0froXaJHNOAPKIrSQDIEfZ9XPr4wXJv
X7Ttgej73EgDeGNQBBGY5XF/lW7FXVgyqlfz22CYf45s+AoNMfQfy0MRr92HMZq+
hO3bW5jjCwKBgQCHmRX2DePc9cM5r0FHfBblgD6Gj6Oe8pJ/vqOZ5FFeiZdLMXBe
G6Gf8FVaaRJk7I4ug/Y/s3QJ899wFKZEKdYzoTSWUmd1dydXmZ4Ny0/UR9Jq4Qbc
n4yzawHarAN+MPc3yolOcNm0oHE/TiY1oAheTHBM+KNo6XswGH/80Wia5wKBgAPo
6zEqVT3zqDKDpJdfteIhqFEgbl1DW51p2fwEEH0ljxMUg49yo7GgDFcm7hBJOmn4
CotriOmt74+ke/9XEOZiOOfMdJ9ZZom5EruNo+DD2ZIFv2Cf0VXbjutuPiy1AVJO
UZnozG+Us3X5iOLVW6o4rP1fFOjB2DM0w40mtSolAoGBAN5Qjr8B5GtwZ1L+12GU
Urv+dsaCNaHzDCjfRAhwFEo5fd7rQ3eszKqMXKfbL5sJzrFP/RxyEDecq+nM6sAq
r+hkm4JF08vRs3qmKsmKGeyWd+LP78CQ0BTIY85+aL90QN3HU5DYGGsC9fZ4zeXq
l1JdNTRhv2LtELY890DcN5T6
-----END PRIVATE KEY-----`,
};

const SITE_URL = 'https://freelanly.com/';

async function main() {
  console.log('=== Google Search Console Errors ===\n');

  const auth = new google.auth.GoogleAuth({
    credentials: GSC_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    // Get URL inspection results - this requires specific URL
    // Instead, let's check sitemaps status
    console.log('--- Sitemaps ---');
    const sitemaps = await searchconsole.sitemaps.list({
      siteUrl: SITE_URL,
    });

    if (sitemaps.data.sitemap) {
      for (const sitemap of sitemaps.data.sitemap) {
        console.log(`\nSitemap: ${sitemap.path}`);
        console.log(`  Last submitted: ${sitemap.lastSubmitted}`);
        console.log(`  Last downloaded: ${sitemap.lastDownloaded}`);
        console.log(`  Pending: ${sitemap.isPending}`);
        console.log(`  Errors: ${sitemap.errors}`);
        console.log(`  Warnings: ${sitemap.warnings}`);

        if (sitemap.contents) {
          for (const content of sitemap.contents) {
            console.log(`  Type: ${content.type}, Submitted: ${content.submitted}, Indexed: ${content.indexed}`);
          }
        }
      }
    } else {
      console.log('No sitemaps found');
    }

    // Check for crawl errors using search analytics with error dimension
    console.log('\n--- Pages with low impressions (potential issues) ---');

    // Get pages that are indexed but getting 0 clicks
    const lowPerformance = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dimensions: ['page'],
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'page',
            operator: 'contains',
            expression: '/jobs/'
          }]
        }],
        rowLimit: 50,
      },
    });

    if (lowPerformance.data.rows) {
      const zeroClicks = lowPerformance.data.rows.filter(r => r.clicks === 0);
      console.log(`\nJob pages with impressions but 0 clicks: ${zeroClicks.length}`);

      // Show some examples
      for (const row of zeroClicks.slice(0, 10)) {
        const page = (row.keys?.[0] || '').replace('https://freelanly.com', '');
        console.log(`  ${page} - ${row.impressions} impressions, position ${(row.position || 0).toFixed(1)}`);
      }
    }

    // Check country distribution
    console.log('\n--- Top Countries ---');
    const countries = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dimensions: ['country'],
        rowLimit: 15,
      },
    });

    if (countries.data.rows) {
      console.log('Country | Clicks | Impressions | CTR');
      for (const row of countries.data.rows) {
        console.log(`${row.keys?.[0]} | ${row.clicks} | ${row.impressions} | ${((row.ctr || 0) * 100).toFixed(1)}%`);
      }
    }

    // Check device distribution
    console.log('\n--- Device Distribution ---');
    const devices = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dimensions: ['device'],
        rowLimit: 5,
      },
    });

    if (devices.data.rows) {
      console.log('Device | Clicks | Impressions | CTR');
      for (const row of devices.data.rows) {
        console.log(`${row.keys?.[0]} | ${row.clicks} | ${row.impressions} | ${((row.ctr || 0) * 100).toFixed(1)}%`);
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main().catch(console.error);
