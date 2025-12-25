import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
          {
          },
        ],
      },
    ];
  },

  // Compression
  compress: true,
};

export default nextConfig;
