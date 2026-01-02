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
  // Skip type checking during build (faster, less memory)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Allow Replit proxy domains
  allowedDevOrigins: [
    'e142b007-0d8f-4274-a4fd-bfc0664f7ce3-00-i2kmu8tllt1d.janeway.replit.dev',
    '.replit.dev',
    '.replit.app',
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

    return redirects;
  },
};

export default nextConfig;
