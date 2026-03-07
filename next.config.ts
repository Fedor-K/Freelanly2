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

    // Group 1: Language pair pages → translation landing pages
    const languagePairRedirects: Record<string, string> = {
      'English-to-Arabic': '/jobs/translation/english-arabic',
      'English-to-French': '/jobs/translation/english-french',
      'English-to-German': '/jobs/translation/english-german',
      'English-to-Russian': '/jobs/translation/english-russian',
      'English-to-Chinese': '/jobs/translation/english-chinese',
      'English-to-Korean': '/jobs/translation/english-korean',
      'English-to-Portuguese': '/jobs/translation/english-portuguese',
      'English-to-Italian': '/jobs/translation/english-italian',
      'English-to-Dutch': '/jobs/translation/english-dutch',
      'English-to-Polish': '/jobs/translation/english-polish',
      'English-to-Spanish': '/jobs/translation/english-spanish',
      'English-to-Japanese': '/jobs/translation/english-japanese',
      'English-to-Turkish': '/jobs/translation/english-turkish',
      'English-to-Swedish': '/jobs/translation/english-swedish',
      'Chinese-to-English': '/jobs/translation/chinese-english',
      'French-to-English': '/jobs/translation/french-english',
      'Japanese-to-English': '/jobs/translation/japanese-english',
      'Arabic-to-English': '/jobs/translation/arabic-english',
      'German-to-English': '/jobs/translation/german-english',
      'Korean-to-English': '/jobs/translation/korean-english',
      'Italian-to-English': '/jobs/translation/italian-english',
      'Russian-to-English': '/jobs/translation/russian-english',
      'Spanish-to-English': '/jobs/translation/spanish-english',
      'Portuguese-to-English': '/jobs/translation/portuguese-english',
      'Dutch-to-English': '/jobs/translation/dutch-english',
      'Polish-to-English': '/jobs/translation/polish-english',
      'Turkish-to-English': '/jobs/translation/turkish-english',
      'Swedish-to-English': '/jobs/translation/swedish-english',
    };

    for (const [pair, destination] of Object.entries(languagePairRedirects)) {
      redirects.push({
        source: `/language-is-${pair}`,
        destination,
        permanent: true,
      });
    }

    // Catch-all for remaining language pair URLs
    redirects.push({
      source: '/language-is-:pair',
      destination: '/jobs/translation',
      permanent: true,
    });

    // Group 2: Legacy posts → /freelance
    redirects.push({
      source: '/posts/:id',
      destination: '/freelance',
      permanent: true,
    });

    // Group 3: Legacy blog pages → /blog
    redirects.push({
      source: '/blog/:slug',
      destination: '/blog',
      permanent: true,
    });

    // Group 5: Static page redirects
    const staticRedirects: Record<string, string> = {
      '/how-it-works': '/',
      '/register': '/auth/signin',
      '/faq': '/',
      '/contact-us': '/',
      '/terms-of-use': '/terms',
      '/privacy-policy': '/privacy',
      '/popular': '/jobs',
      '/linguist-rate-calculator': '/jobs/translation',
    };

    for (const [source, destination] of Object.entries(staticRedirects)) {
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
