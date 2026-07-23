import type { NextConfig } from "next";

// Skills that have dedicated pages at /jobs/skills/[skill]
const skillRedirects = [
  'react', 'typescript', 'python', 'javascript', 'nodejs',
  'java', 'golang', 'rust', 'aws', 'kubernetes',
  'docker', 'terraform', 'graphql', 'nextjs', 'vue',
  'angular', 'flutter', 'swift', 'kotlin', 'ruby',
  'rails', 'django', 'laravel', 'postgresql', 'mongodb',
  'redis', 'elasticsearch', 'kafka', 'spark', 'machine-learning',
  'data-science', 'devops', 'sre', 'cloud', 'security',
  'frontend', 'backend', 'fullstack', 'mobile',
  'product-manager', 'product-designer', 'ui-ux', 'figma',
  'php', 'csharp', 'scala', 'svelte', 'fastapi', 'spring',
  'react-native', 'mysql', 'gcp', 'azure', 'ansible',
  'jenkins', 'github-actions', 'pandas', 'tensorflow', 'pytorch',
  'rest-api', 'blockchain',
];

const nextConfig: NextConfig = {
  // @react-pdf/renderer needs to be external for server-side rendering
  serverExternalPackages: ['@react-pdf/renderer'],

  // CV PDF rendering (tailored-cv.tsx) reads Unicode TTFs at runtime — force them into the
  // lambdas of every route that renders a CV, or Vercel's file tracing drops them and the
  // render throws (send then falls back to the stock résumé, silently untailored).
  outputFileTracingIncludes: {
    '/api/user/quick-apply': ['./src/lib/fonts/**/*'],
    '/api/user/auto-apply/[id]': ['./src/lib/fonts/**/*'],
    '/api/user/resume-preauth': ['./src/lib/fonts/**/*'],
  },

  // Enforce no trailing slashes — prevents duplicate URLs
  // /company/x/jobs/y/ → 301 → /company/x/jobs/y
  trailingSlash: false,

  // Type errors fail the build (tsc is clean as of the 58-error cleanup). This is the
  // guardrail that catches regressions; flip back to true only as a temporary unblock.
  typescript: {
    ignoreBuildErrors: false,
  },

  // Allowed dev origins (Vercel handles this automatically in production)
  allowedDevOrigins: [
    'localhost:3000',
  ],

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Compression
  compress: true,

  // 301 Redirects: Landing pages → Skill pages
  async redirects() {
    const redirects = [];

    // /features removed 2026-07-23 (owner): 24-card page was an overclaim factory; the simplified
    // homepage carries the story now. 301 keeps the indexed URL's equity.
    redirects.push({ source: '/features', destination: '/', permanent: true });

    // === ALL job/freelance pages → signup with context ===

    // /jobs/[category] → signup with category context
    redirects.push({ source: '/jobs/:category', destination: '/auth/signin?ref=jobs&category=:category', permanent: true });
    redirects.push({ source: '/jobs/:category/:level', destination: '/auth/signin?ref=jobs&category=:category', permanent: true });
    redirects.push({ source: '/jobs/:category/salary/:range', destination: '/auth/signin?ref=jobs&category=:category', permanent: true });
    redirects.push({ source: '/jobs/:category/country/:country', destination: '/auth/signin?ref=jobs&category=:category', permanent: true });
    redirects.push({ source: '/jobs/translation/:pair', destination: '/auth/signin?ref=jobs&category=translation', permanent: true });
    redirects.push({ source: '/jobs/skills/:skill', destination: '/auth/signin?ref=jobs', permanent: true });
    redirects.push({ source: '/jobs/country/:country', destination: '/auth/signin?ref=country&country=:country', permanent: true });
    redirects.push({ source: '/jobs', destination: '/auth/signin?ref=jobs', permanent: true });

    // /freelance index → signup (but /freelance/:slug is a public project page — no redirect)
    redirects.push({ source: '/freelance', destination: '/auth/signin?ref=freelance', permanent: true });

    // /country → signup
    redirects.push({ source: '/country', destination: '/auth/signin?ref=jobs', permanent: true });
    redirects.push({ source: '/country/:slug', destination: '/auth/signin?ref=country&country=:slug', permanent: true });
    redirects.push({ source: '/country/:slug/jobs/:role', destination: '/auth/signin?ref=country&country=:slug', permanent: true });

    // /company pages → signup
    redirects.push({ source: '/company/:slug/jobs/:job', destination: '/auth/signin?ref=job', permanent: true });
    redirects.push({ source: '/company/:slug/jobs', destination: '/auth/signin?ref=jobs', permanent: true });
    redirects.push({ source: '/company/:slug', destination: '/auth/signin?ref=jobs', permanent: true });
    redirects.push({ source: '/companies', destination: '/auth/signin?ref=jobs', permanent: true });

    // Legacy skill/category URLs → signup
    for (const skill of skillRedirects) {
      redirects.push({ source: `/remote-${skill}-jobs`, destination: '/auth/signin?ref=jobs', permanent: true });
      redirects.push({ source: `/remote-${skill}-jobs-:location`, destination: '/auth/signin?ref=jobs', permanent: true });
    }

    // Legacy pages → signup
    redirects.push({ source: '/language-is-:pair', destination: '/auth/signin?ref=jobs&category=translation', permanent: true });
    redirects.push({ source: '/posts/:id', destination: '/auth/signin?ref=jobs', permanent: true });
    redirects.push({ source: '/register', destination: '/auth/signin', permanent: true });
    redirects.push({ source: '/contact-us', destination: '/about', permanent: true });
    redirects.push({ source: '/terms-of-use', destination: '/terms', permanent: true });
    redirects.push({ source: '/privacy-policy', destination: '/privacy', permanent: true });
    redirects.push({ source: '/popular', destination: '/auth/signin?ref=jobs', permanent: true });
    redirects.push({ source: '/linguist-rate-calculator', destination: '/auth/signin?ref=jobs&category=translation', permanent: true });
    redirects.push({ source: '/for-interpreters', destination: '/auth/signin?ref=jobs&category=translation', permanent: true });
    redirects.push({ source: '/for-translators', destination: '/auth/signin?ref=jobs&category=translation', permanent: true });

    return redirects;
  },
};

export default nextConfig;
