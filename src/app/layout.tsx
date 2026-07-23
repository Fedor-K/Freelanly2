import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
import { siteConfig } from "@/config/site";
import { AnalyticsScripts } from "@/components/analytics/AnalyticsScripts";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { GclidCapture } from "@/components/analytics/GclidCapture";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { PaymentReturnHandler } from "@/components/PaymentReturnHandler";
import { ConversionUTMTracker } from "@/components/ConversionUTMTracker";
import { ClientErrorTracker } from "@/components/analytics/ClientErrorTracker";
import { ChatWidget } from "@/components/ChatWidget";
import { Suspense } from "react";
import Script from "next/script";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // iOS auto-zooms on input focus and the page STAYS zoomed after (cut-off right edge, buttons off
  // screen). maximumScale stops the auto-zoom; Safari still allows manual pinch-zoom (it ignores
  // this cap for user gestures since iOS 10), so accessibility is preserved.
  maximumScale: 1,
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Personal AI Assistant for Remote Tech-Job Applications`,
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
    title: `${siteConfig.name} — Personal AI Assistant for Remote Tech-Job Applications`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — AI application assistant for remote tech roles`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — Personal AI Assistant for Remote Tech-Job Applications`,
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
  category: 'productivity',
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
  // SearchAction removed: /jobs 301s to /auth/signin and drops the query — a sitelinks searchbox
  // pointing there was functionally broken.
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
      <head>
        {/* Yandex Metrika + all other trackers load once via <AnalyticsScripts /> in <body> —
            the inline duplicate that double-counted visits was removed 2026-07-16. */}
        <script id="vtag-ai-js" async src="https://r2.leadsy.ai/tag.js" data-pid="XmXSR8r7W3uP84n0" data-version="062024" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <SessionProvider>
          <Suspense fallback={null}>
            <GclidCapture />
            <TrackPageView />
            <PaymentReturnHandler />
            <ConversionUTMTracker />
          </Suspense>
          <ClientErrorTracker />
          {children}
          <Analytics />
          {/* ExitIntentPopup removed — annoying UX */}
          <CookieConsentBanner />
        </SessionProvider>
        <AnalyticsScripts />
        <ChatWidget />
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
