// Mint a recruiter-portal magic link for any email.
// Usage:  AUTH_SECRET='...' node scripts/recruiter-link.js [email]
const { createHmac } = require('crypto');

const SECRET = process.env.AUTH_SECRET;
const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://freelanly.com';
const email = (process.argv[2] || 'faithfulfamily001@gmail.com').toLowerCase().trim();

if (!SECRET) { console.error('Set AUTH_SECRET (Vercel → Settings → Env Vars)'); process.exit(1); }

const sig = createHmac('sha256', SECRET).update(email).digest('hex').slice(0, 32);
const token = `${Buffer.from(email).toString('base64url')}.${sig}`;
console.log(`${BASE}/r/${token}`);
