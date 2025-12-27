import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { AnalyticsScripts } from "@/components/analytics/AnalyticsScripts";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} - Remote Jobs from LinkedIn & Top Companies`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.creator }],
  creator: siteConfig.creator,
  publisher: siteConfig.creator,
  metadataBase: new URL(siteConfig.url),
  // Note: canonical is NOT set globally - each page must define its own
  // to avoid all pages pointing to homepage
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: `${siteConfig.name} - Find Remote Jobs`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - Remote Jobs`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - Remote Jobs`,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@freelanly",
    site: "@freelanly",
  },
  // Note: robots rules are in robots.ts, not in metadata
  // This prevents duplicate meta robots tags on pages that override robots
  verification: {
    // To get your Google Search Console verification code:
    // 1. Go to https://search.google.com/search-console
    // 2. Add property → Enter https://freelanly.com
    // 3. Choose "HTML tag" verification method
    // 4. Copy the content value from the meta tag
    // 5. Paste it below and redeploy
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
    // yandex: process.env.YANDEX_VERIFICATION || '',
  },
  category: 'jobs',
  manifest: '/manifest.json',
};

// Website and Organization JSON-LD
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${siteConfig.url}/#website`,
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  publisher: {
    '@id': `${siteConfig.url}/#organization`,
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteConfig.url}/jobs?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${siteConfig.url}/#organization`,
  name: siteConfig.name,
  url: siteConfig.url,
  logo: {
    '@type': 'ImageObject',
    url: `${siteConfig.url}/logo.png`,
  },
  sameAs: [
    siteConfig.links.twitter,
    siteConfig.links.github,
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'info@freelanly.com',
    contactType: 'customer service',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <SessionProvider>
          {children}
          <ExitIntentPopup />
          <CookieConsentBanner />
        </SessionProvider>
        <AnalyticsScripts />
        {/* JSON-LD Structured Data - placed in body per Google recommendations */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
