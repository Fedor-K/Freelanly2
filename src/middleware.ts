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

  // Detect old job URL patterns like /jobs/italian-translation-job-0398f84e
  // These should return 404 instead of matching /jobs/[category]
  const oldJobUrlMatch = pathname.match(/^\/jobs\/([^\/]+)$/);
  if (oldJobUrlMatch) {
    const slug = oldJobUrlMatch[1];
    // If slug is NOT a valid category, it's an old job URL - return 404
    if (!VALID_CATEGORIES.has(slug)) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }

  // WWW to non-WWW redirect (301 permanent)
  if (host.startsWith('www.')) {
    const newHost = host.replace('www.', '');
    const newUrl = new URL(req.url);
    newUrl.host = newHost;
    return NextResponse.redirect(newUrl, 301);
  }

  // SEO redirects for old/removed pages
  const seoRedirects: Record<string, string> = {
    '/for-interpreters': '/jobs/translation',
    '/for-translators': '/jobs/translation',
  };

  if (seoRedirects[pathname]) {
    return NextResponse.redirect(new URL(seoRedirects[pathname], req.url), 301);
  }

  // Check for session cookie (NextAuth session token)
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
    signInUrl.searchParams.set('callbackUrl', pathname);
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
