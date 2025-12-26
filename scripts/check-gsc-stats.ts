// Google Search Console API client
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

const SITE_URL = 'https://freelanly.com/'; // try with full URL

async function main() {
  console.log('=== Google Search Console Stats ===\n');

  // Auth
  const auth = new google.auth.GoogleAuth({
    credentials: GSC_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // Get date range (last 28 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  try {
    // First, list available sites
    console.log('--- Available Sites ---');
    const sites = await searchconsole.sites.list();
    console.log(JSON.stringify(sites.data, null, 2));

    // Get search analytics
    console.log('\n--- Top Queries (last 28 days) ---');
    const queryData = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['query'],
        rowLimit: 20,
      },
    });

    if (queryData.data.rows) {
      console.log('\nQuery | Clicks | Impressions | CTR | Position');
      console.log('------|--------|-------------|-----|----------');
      for (const row of queryData.data.rows) {
        const query = row.keys?.[0] || '';
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const ctr = ((row.ctr || 0) * 100).toFixed(1);
        const position = (row.position || 0).toFixed(1);
        console.log(`${query.substring(0, 30)} | ${clicks} | ${impressions} | ${ctr}% | ${position}`);
      }
    } else {
      console.log('No query data available');
    }

    // Get top pages
    console.log('\n--- Top Pages ---');
    const pageData = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        rowLimit: 15,
      },
    });

    if (pageData.data.rows) {
      console.log('\nPage | Clicks | Impressions | CTR');
      console.log('-----|--------|-------------|----');
      for (const row of pageData.data.rows) {
        const page = (row.keys?.[0] || '').replace('https://freelanly.com', '');
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const ctr = ((row.ctr || 0) * 100).toFixed(1);
        console.log(`${page.substring(0, 40)} | ${clicks} | ${impressions} | ${ctr}%`);
      }
    }

    // Overall stats
    console.log('\n--- Overall Stats ---');
    const overallData = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      },
    });

    if (overallData.data.rows && overallData.data.rows[0]) {
      const row = overallData.data.rows[0];
      console.log(`Total Clicks: ${row.clicks}`);
      console.log(`Total Impressions: ${row.impressions}`);
      console.log(`Average CTR: ${((row.ctr || 0) * 100).toFixed(2)}%`);
      console.log(`Average Position: ${(row.position || 0).toFixed(1)}`);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main().catch(console.error);
