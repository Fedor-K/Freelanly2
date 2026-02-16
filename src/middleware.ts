import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Valid category slugs (must match categories in site.ts)
const VALID_CATEGORIES = new Set([
  'engineering', 'design', 'data', 'devops', 'qa', 'security',
  'product', 'marketing', 'sales', 'finance', 'hr', 'operations',
  'legal', 'project-management', 'writing', 'translation', 'creative',
  'support', 'education', 'research', 'consulting'
]);

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

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

  // 3. Old job URL patterns → 410 Gone (not 404!)
  // Google deindexes 410 on first crawl, 404 requires multiple recrawls
  // Catches: /jobs/italian-translation-job-0398f84e, /jobs/some-old-slug
  const oldJobUrlMatch = pathname.match(/^\/jobs\/([^\/]+)$/);
  if (oldJobUrlMatch) {
    const slug = oldJobUrlMatch[1];
    if (!VALID_CATEGORIES.has(slug)) {
      return new NextResponse('Gone', { status: 410 });
    }
  }

  // 4. SEO redirects for old/removed pages (301 permanent)
  const seoRedirects: Record<string, string> = {
    '/for-interpreters': '/jobs/translation',
    '/for-translators': '/jobs/translation',
  };

  if (seoRedirects[pathname]) {
    return NextResponse.redirect(new URL(seoRedirects[pathname], req.url), 301);
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

  // Redirect to dashboard if accessing auth routes while logged in
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Run on all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap|api/).*)',
  ],
};
