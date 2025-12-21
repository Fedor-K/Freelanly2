'use client';

import Script from 'next/script';
import { analyticsConfig } from '@/lib/analytics';

/**
 * Компонент для вставки всех скриптов аналитики
 *
 * Добавь в app/layout.tsx:
 * <AnalyticsScripts />
 */
export function AnalyticsScripts() {
  return (
    <>
      {/* Яндекс.Метрика */}
      {analyticsConfig.yandexMetrika.enabled && (
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

            ym(${analyticsConfig.yandexMetrika.id}, "init", {
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
      {analyticsConfig.googleAnalytics.enabled && (
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

      {/* Microsoft Clarity (бесплатные записи сессий + heatmaps) */}
      {analyticsConfig.clarity.enabled && (
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

      {/* Noscript fallback для Яндекс.Метрики */}
      {analyticsConfig.yandexMetrika.enabled && (
        <noscript>
          <div>
            <img
              src={`https://mc.yandex.ru/watch/${analyticsConfig.yandexMetrika.id}`}
              style={{ position: 'absolute', left: '-9999px' }}
              alt=""
            />
          </div>
        </noscript>
      )}
    </>
  );
}
