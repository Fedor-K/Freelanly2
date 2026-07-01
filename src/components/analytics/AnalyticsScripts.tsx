'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { analyticsConfig } from '@/lib/analytics';
import { getConsentFromCookie, onConsentChange, type ConsentState } from '@/lib/consent';

/**
 * All third-party tracker scripts, gated on cookie consent.
 *
 * Nothing loads until the visitor grants the matching consent category:
 *  - analytics  → Yandex Metrika, Google Analytics 4, Microsoft Clarity
 *  - marketing  → Google Ads, Leadsy (vtag) visitor identification
 *
 * Reads the consent cookie on mount and re-reads it live on the
 * `consentchange` event (dispatched by CookieConsentBanner), so accepting
 * cookies activates trackers immediately — no page reload.
 *
 * Rendered once in app/layout.tsx.
 */
export function AnalyticsScripts() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    const read = () => setConsent(getConsentFromCookie());
    read();
    return onConsentChange(read);
  }, []);

  const analytics = consent?.analytics === true;
  const marketing = consent?.marketing === true;

  return (
    <>
      {/* ── Analytics category ─────────────────────────────────────── */}

      {/* Яндекс.Метрика */}
      {analytics && analyticsConfig.yandexMetrika.enabled && (
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=${analyticsConfig.yandexMetrika.id}", "ym");

            ym(${analyticsConfig.yandexMetrika.id}, "init", {
              ssr: true,
              clickmap: true,
              trackLinks: true,
              accurateTrackBounce: true,
              webvisor: true,
              trackHash: true,
              ecommerce: "dataLayer"
            });
          `}
        </Script>
      )}

      {/* Google Analytics 4 */}
      {analytics && analyticsConfig.googleAnalytics.enabled && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${analyticsConfig.googleAnalytics.id}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${analyticsConfig.googleAnalytics.id}', {
                page_path: window.location.pathname,
                send_page_view: true
              });
            `}
          </Script>
        </>
      )}

      {/* Microsoft Clarity (session recordings + heatmaps) */}
      {analytics && analyticsConfig.clarity.enabled && (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${analyticsConfig.clarity.id}");
          `}
        </Script>
      )}

      {/* ── Marketing category ─────────────────────────────────────── */}

      {/* Google Ads Conversion Tracking */}
      {marketing && analyticsConfig.googleAds.enabled && (
        <>
          {/* If GA4 isn't loaded, we need our own gtag loader */}
          {!(analytics && analyticsConfig.googleAnalytics.enabled) && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${analyticsConfig.googleAds.id}`}
                strategy="afterInteractive"
              />
              <Script id="google-ads-gtag" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                `}
              </Script>
            </>
          )}
          <Script id="google-ads-config" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('config', '${analyticsConfig.googleAds.id}');
            `}
          </Script>
        </>
      )}

      {/* Leadsy (vtag) visitor identification — moved out of layout <head> */}
      {marketing && (
        <Script
          id="vtag-ai-js"
          src="https://r2.leadsy.ai/tag.js"
          strategy="afterInteractive"
          data-pid="XmXSR8r7W3uP84n0"
          data-version="062024"
        />
      )}
    </>
  );
}
