import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { watcherForHost } from '@/config/watchers';

// Valid category slugs (must match categories in site.ts)
const VALID_CATEGORIES = new Set([
  'engineering', 'design', 'data', 'devops', 'qa', 'security',
  'product', 'marketing', 'sales', 'finance', 'hr', 'operations',
  'legal', 'project-management', 'writing', 'translation', 'creative',
  'support', 'education', 'research', 'consulting'
]);

// Site-wide IP geo block (owner decision 2026-06-17). Visitors whose Vercel-resolved IP country is
// in SITE_GEO_BLOCK (comma ISO2) get a hard 403 — the site is simply unavailable to them. IP-based,
// so it's leaky (VPN gets in; in-region travellers wrongly blocked) — the résumé/profile-location
// registration block and the supply-side poster filter are the precise backstops. /api/* is already
// excluded by the matcher config below, so webhooks/crons/tracking keep working. Unknown IP country
// (crawlers, datacenters) is NOT blocked. Empty/unset env = off.
const SITE_GEO_BLOCK = new Set((process.env.SITE_GEO_BLOCK || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

  // ── WATCHER FACTORY (owner 2026-07-24): niche products on their own domains, one engine. ──
  // A watcher host (reactwatcher.net / qa.freelanly.com test alias / …) serves ONLY its /w/{slug}
  // tree — every path is rewritten there, so the Freelanly site is unreachable on these hosts and
  // no Freelanly-specific rule below (geo block aside) applies. www → apex first.
  const watcher = watcherForHost(host);
  if (watcher) {
    if (host.startsWith('www.')) {
      const url = new URL(req.url);
      url.host = host.replace('www.', '');
      return NextResponse.redirect(url, 301);
    }
    // Already-internal paths (client navigations to /w/…) pass through; everything else rewrites.
    if (!pathname.startsWith('/w/')) {
      const url = req.nextUrl.clone();
      url.pathname = `/w/${watcher.slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }
  // Freelanly hosts must never serve the /w tree directly (duplicate content + brand leak).
  if (pathname.startsWith('/w/') && !host.includes('localhost')) {
    return NextResponse.redirect(new URL('/', req.url), 301);
  }

  // 0. Geo block — earliest, before anything else.
  if (SITE_GEO_BLOCK.size) {
    const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
    if (country && SITE_GEO_BLOCK.has(country)) {
      return new NextResponse(
        '<!doctype html><html><head><meta charset="utf-8"><title>Not available</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;background:#0B0C0F;color:#FAFAF7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1 style="font-weight:600;font-size:22px;margin:0 0 8px">Freelanly isn\'t available in your region yet.</h1><p style="color:#8A8780;font-size:14px;margin:0">We\'re not accepting users from your location at this time.</p></div></body></html>',
        { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
      );
    }
  }

  // 1. WWW to non-WWW redirect (301 permanent) — MUST be first
  // Fixes 12.3K "Duplicate without user-selected canonical" in GSC
  if (host.startsWith('www.')) {
    const newHost = host.replace('www.', '');
    const newUrl = new URL(req.url);
    newUrl.host = newHost;
    return NextResponse.redirect(newUrl, 301);
  }

  // 2. Trailing slash redirect: /path/ → /path (301 permanent)
  // Fixes duplicate content: /company/x/jobs/y vs /company/x/jobs/y/
  // Don't redirect root "/" or paths that are just "/"
  if (pathname.length > 1 && pathname.endsWith('/')) {
    const newUrl = new URL(req.url);
    newUrl.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(newUrl, 301);
  }

  // 3. All /jobs/*, /company/*, /country/* → signup (but NOT /freelance/* — public project pages)
  if (pathname.startsWith('/jobs') || pathname.startsWith('/company') || pathname.startsWith('/companies') || pathname.startsWith('/country')) {
    const category = pathname.match(/^\/jobs\/([^\/]+)/)?.[1];
    const country = pathname.match(/^\/country\/([^\/]+)/)?.[1];
    let dest = '/auth/signin?ref=jobs';
    if (category && VALID_CATEGORIES.has(category)) {
      dest = `/auth/signin?ref=jobs&category=${category}`;
    } else if (country) {
      dest = `/auth/signin?ref=country&country=${country}`;
    }
    return NextResponse.redirect(new URL(dest, req.url), 301);
  }

  // 5. Auth: check for session cookie (NextAuth session token)
  const sessionToken =
    req.cookies.get('authjs.session-token')?.value ||
    req.cookies.get('__Secure-authjs.session-token')?.value;

  const isLoggedIn = !!sessionToken;

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard'];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Auth routes - redirect to dashboard if already logged in
  const authRoutes = ['/auth/signin'];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Redirect to sign in if accessing protected route without auth
  if (isProtectedRoute && !isLoggedIn) {
    const signInUrl = new URL('/auth/signin', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Allow re-authentication even if session cookie exists (it may be expired/invalid).
  // Users must be able to request a new magic link at any time.

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Run on all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap|api/).*)',
  ],
};
