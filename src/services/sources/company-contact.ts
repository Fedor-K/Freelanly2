// Block 3 — resolve a real contact email for a Lever company, for FREE.
//
// Lever postings give the company but NOT a recruiter email (the apply form is anonymous), so we
// derive one ourselves instead of paying Apollo/Hunter for every company:
//   1. resolve the company's REAL domain (Lever slug ≠ domain) via the free Clearbit autocomplete
//      (name → domain), with a wrong-match guard + a slug-based fallback;
//   2. find a live role-based alias (careers@/jobs@/…) by an SMTP RCPT probe that NEVER sends mail
//      — the server tells us 250 (exists) / 550 (no such user); catch-all domains accept anything,
//      so we detect that and fall back to careers@ by convention.
// Measured ~80–85% of companies get a usable contact at $0; the rest (named-recruiter-only) go to
// a paid finder. Results are cached in ActivityLog per domain so we probe each company once.
//
// ⚠️ PORT 25: the SMTP probe needs outbound port 25, which Vercel/serverless BLOCKS. Run this on the
// Hetzner worker (port 25 open, mail infra present). On a host without port 25 set
// CONTACT_PROBE_ENABLED=false — it then returns an UNVERIFIED careers@ guess instead of probing.
import dns from 'node:dns/promises';
import net from 'node:net';
import { prisma } from '@/lib/db';
import type { LeverPosting } from './lever-ats';

const ALIASES = ['careers', 'jobs', 'recruiting', 'talent', 'hr', 'people', 'hiring'];
const PROBE_FROM = process.env.CONTACT_PROBE_FROM || 'verify@freelanly.com';
const PROBE_EHLO = process.env.CONTACT_PROBE_EHLO || 'freelanly.com';
const PROBE_ENABLED = process.env.CONTACT_PROBE_ENABLED !== 'false';
const CACHE_DAYS = 30;

export type CompanyContact = {
  domain: string;
  email: string | null;                          // best contact to send to (null = nothing usable)
  method: 'verified' | 'catch-all' | 'guess' | 'none';
  verifiedAlias: string | null;                  // the alias the server confirmed (250), if any
  catchAll: boolean;
  mx: boolean;
};

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slugGuessDomain = (slug: string) =>
  slug.includes('.') ? slug : `${slug.replace(/-\d+$/, '')}.com`;

// ── Domain resolution ───────────────────────────────────────────────────────
// Free Clearbit autocomplete maps a company NAME → domain. The first hit can be a different company
// with a similar name (e.g. "mistral" → a bistro), so we only trust a suggestion whose domain label
// actually matches the slug/name; otherwise we fall back to the slug-based guess.
export async function resolveCompanyDomain(opts: { slug: string; name?: string | null }): Promise<string> {
  const guess = slugGuessDomain(opts.slug.toLowerCase().trim());
  const query = (opts.name && opts.name.trim()) || opts.slug;
  try {
    const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Freelanly/1.0' } });
    if (!res.ok) return guess;
    const list = (await res.json()) as Array<{ name?: string; domain?: string }>;
    if (!Array.isArray(list) || !list.length) return guess;
    const slugN = norm(opts.slug);
    const nameN = norm(query);
    const label = (d: string) => norm((d || '').split('.')[0]);
    // EXACT matches only. A loose "startsWith" picks look-alikes (Mistral AI → mistralair.it,
    // Shield AI → shieldair.com), and mis-sending to the wrong company is worse than a miss — a
    // missed company just falls through to the slug guess and gets dropped by the SMTP probe.
    const pick =
      list.find(c => c.domain && label(c.domain) === slugN) ||
      list.find(c => c.domain && label(c.domain) === nameN) ||
      list.find(c => c.domain && norm(c.name || '') === nameN);
    return (pick?.domain || guess).toLowerCase();
  } catch {
    return guess;
  }
}

// ── SMTP alias probe (no mail sent) ─────────────────────────────────────────
function readReply(sock: net.Socket): Promise<string> {
  return new Promise(resolve => {
    let buf = '';
    const onData = (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split(/\r\n/).filter(Boolean);
      if (lines.length && /^\d{3} /.test(lines[lines.length - 1])) { cleanup(); resolve(buf); }
    };
    const to = setTimeout(() => { cleanup(); resolve(buf || 'TIMEOUT'); }, 8000);
    const cleanup = () => { clearTimeout(to); sock.removeListener('data', onData); };
    sock.on('data', onData);
  });
}
const codeOf = (r: string) => parseInt(((r || '').split(/\r\n/).filter(Boolean).pop() || '').slice(0, 3)) || 0;
const is2xx = (c: number) => c >= 250 && c < 260;

type ProbeResult = { mx: boolean; catchAll: boolean; verifiedAlias: string | null; greylisted: boolean };

async function probeAliases(domain: string): Promise<ProbeResult> {
  let mx: string;
  try {
    const recs = await dns.resolveMx(domain);
    if (!recs.length) return { mx: false, catchAll: false, verifiedAlias: null, greylisted: false };
    mx = recs.sort((a, b) => a.priority - b.priority)[0].exchange;
  } catch {
    return { mx: false, catchAll: false, verifiedAlias: null, greylisted: false };
  }
  return new Promise<ProbeResult>(resolve => {
    const out: ProbeResult = { mx: true, catchAll: false, verifiedAlias: null, greylisted: false };
    const sock = net.createConnection({ host: mx, port: 25 });
    sock.setTimeout(9000);
    const rnd = `zz${Math.abs(Date.now() % 1e9)}rcptcheck@${domain}`;
    const seq = ['EHLO ' + PROBE_EHLO, `MAIL FROM:<${PROBE_FROM}>`, `RCPT TO:<${rnd}>`,
      ...ALIASES.map(a => `RCPT TO:<${a}@${domain}>`), 'QUIT'];
    let any4xx = false;
    (async () => {
      try {
        await readReply(sock); // greeting
        for (let i = 0; i < seq.length; i++) {
          sock.write(seq[i] + '\r\n');
          const c = codeOf(await readReply(sock));
          if (i === 2) out.catchAll = is2xx(c);                       // random addr accepted ⇒ catch-all
          else if (i >= 3 && i < 3 + ALIASES.length) {
            if (c >= 400 && c < 500) any4xx = true;
            if (!out.verifiedAlias && is2xx(c) && !out.catchAll) out.verifiedAlias = `${ALIASES[i - 3]}@${domain}`;
          }
        }
      } catch { /* socket error — leave defaults */ }
      finally {
        if (!out.verifiedAlias && !out.catchAll && any4xx) out.greylisted = true; // deferred → retry later
        sock.destroy();
        resolve(out);
      }
    })();
    sock.on('error', () => { sock.destroy(); resolve(out); });
    sock.on('timeout', () => { out.greylisted = true; sock.destroy(); resolve(out); });
  });
}

// ── Cache (ActivityLog, no migration) ───────────────────────────────────────
async function readCache(domain: string): Promise<CompanyContact | null> {
  try {
    const row = await prisma.activityLog.findFirst({
      where: {
        action: 'COMPANY_CONTACT_RESOLVED',
        details: { path: ['domain'], equals: domain },
        createdAt: { gte: new Date(Date.now() - CACHE_DAYS * 864e5) },
      },
      orderBy: { createdAt: 'desc' },
      select: { details: true },
    });
    return (row?.details as CompanyContact | undefined) ?? null;
  } catch { return null; }
}
async function writeCache(c: CompanyContact): Promise<void> {
  try {
    await prisma.activityLog.create({ data: { action: 'COMPANY_CONTACT_RESOLVED', details: c as unknown as object } });
  } catch { /* cache is best-effort */ }
}

// ── Public entry: resolve ONE contact for a company (cached, never throws) ───
export async function resolveCompanyContact(opts: { slug: string; name?: string | null }): Promise<CompanyContact> {
  const domain = await resolveCompanyDomain(opts);
  const cached = await readCache(domain);
  if (cached) return cached;

  let contact: CompanyContact;
  if (!PROBE_ENABLED) {
    // No port 25 here — return an unverified careers@ guess, don't probe, don't cache.
    return { domain, email: `careers@${domain}`, method: 'guess', verifiedAlias: null, catchAll: false, mx: true };
  }
  const p = await probeAliases(domain);
  if (p.verifiedAlias) contact = { domain, email: p.verifiedAlias, method: 'verified', verifiedAlias: p.verifiedAlias, catchAll: false, mx: true };
  else if (p.catchAll) contact = { domain, email: `careers@${domain}`, method: 'catch-all', verifiedAlias: null, catchAll: true, mx: true };
  else contact = { domain, email: null, method: 'none', verifiedAlias: null, catchAll: false, mx: p.mx };

  // Cache definitive results only; a greylisted (4xx/timeout) miss stays uncached so the next run retries.
  if (!(contact.method === 'none' && p.greylisted)) await writeCache(contact);
  return contact;
}

/** Convenience: resolve the contact for a Lever role's company. */
export function resolveRoleContact(role: LeverPosting, name?: string | null): Promise<CompanyContact> {
  return resolveCompanyContact({ slug: role.companySlug, name });
}
