// Test Google Indexing API
import { createSign } from 'crypto';

const credentials = {
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

async function getAccessToken(): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const assertion = createJWTAssertion(header, payload, credentials.private_key);

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
    throw new Error(JSON.stringify(data));
  }
  return data.access_token;
}

async function submitUrl(url: string, accessToken: string): Promise<any> {
  const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      url: url,
      type: 'URL_UPDATED',
    }),
  });

  return response.json();
}

async function main() {
  console.log('=== Testing Google Indexing API ===\n');

  try {
    console.log('1. Getting access token...');
    const token = await getAccessToken();
    console.log('   ✅ Token received\n');

    console.log('2. Submitting test URL...');
    const testUrl = 'https://freelanly.com/';
    const result = await submitUrl(testUrl, token);
    console.log('   Result:', JSON.stringify(result, null, 2));

    if (result.urlNotificationMetadata) {
      console.log('\n✅ SUCCESS! Indexing API is working.');
    } else if (result.error) {
      console.log('\n❌ Error:', result.error.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
