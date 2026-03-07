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
  // Enforce no trailing slashes — prevents duplicate URLs
  // /company/x/jobs/y/ → 301 → /company/x/jobs/y
  trailingSlash: false,

  // Skip type checking during build (faster, less memory)
  typescript: {
    ignoreBuildErrors: true,
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

    // Redirect /remote-[skill]-jobs → /jobs/skills/[skill]
    for (const skill of skillRedirects) {
      redirects.push({
        source: `/remote-${skill}-jobs`,
        destination: `/jobs/skills/${skill}`,
        permanent: true,
      });

      // Also redirect /remote-[skill]-jobs-[location] → /jobs/skills/[skill]
      // Location filtering can be done on the skill page
      redirects.push({
        source: `/remote-${skill}-jobs-:location`,
        destination: `/jobs/skills/${skill}`,
        permanent: true,
      });
    }

    // Redirect category landing pages to category pages
    // /remote-engineering-jobs → /jobs/engineering
    const categoryRedirects = [
      'engineering', 'design', 'data', 'devops', 'qa', 'security',
      'product', 'marketing', 'sales', 'finance', 'hr', 'operations',
      'legal', 'project-management', 'writing', 'translation', 'creative',
      'support', 'education', 'research', 'consulting',
    ];

    for (const category of categoryRedirects) {
      redirects.push({
        source: `/remote-${category}-jobs`,
        destination: `/jobs/${category}`,
        permanent: true,
      });
    }

    // === Legacy URL redirects (GSC 404s) ===

    // Language pair pages → translation category
    redirects.push({
      source: '/language-is-:pair',
      destination: '/freelance/translation',
      permanent: true,
    });

    // Legacy posts → general freelance
    redirects.push({
      source: '/posts/:id',
      destination: '/freelance',
      permanent: true,
    });

    // Legacy blog pages → general freelance
    redirects.push({
      source: '/blog/:slug',
      destination: '/freelance',
      permanent: true,
    });

    // Static legacy pages
    const legacyRedirects: Record<string, string> = {
      '/how-it-works': '/freelance',
      '/register': '/freelance',
      '/faq': '/freelance',
      '/contact-us': '/freelance',
      '/terms-of-use': '/freelance',
      '/privacy-policy': '/freelance',
      '/popular': '/freelance',
      '/linguist-rate-calculator': '/freelance/translation',
      '/for-interpreters': '/freelance/translation',
      '/for-translators': '/freelance/translation',
    };

    for (const [source, destination] of Object.entries(legacyRedirects)) {
      redirects.push({
        source,
        destination,
        permanent: true,
      });
    }

    return redirects;
  },
};

export default nextConfig;
