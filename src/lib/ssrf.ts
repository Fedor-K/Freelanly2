import dns from 'dns/promises';
import net from 'net';

function ipIsBlocked(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;          // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fec0')) return true;
    const m = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return ipIsBlocked(m[1]);
    return false;
  }
  return true;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http/https allowed');
  const host = u.hostname;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('Blocked host');
  if (net.isIP(host)) {
    if (ipIsBlocked(host)) throw new Error('Blocked private address');
    return u;
  }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw new Error('DNS resolution failed'); }
  if (!addrs.length) throw new Error('DNS resolution failed');
  for (const a of addrs) if (ipIsBlocked(a.address)) throw new Error('Blocked private address');
  return u;
}

export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let url = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(url);
    const resp = await fetch(url, { ...init, redirect: 'manual' });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (!loc) return resp;
      url = new URL(loc, url).toString();
      continue;
    }
    return resp;
  }
  throw new Error('Too many redirects');
}
