'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/hooks/useTracker';

/**
 * Global client-side error capture → ActivityLog (action: CLIENT_ERROR).
 *
 * Born 2026-07-23: the paywall card form threw an uncaught IntegrationError for 2 days —
 * every top-up submit died silently (button spun forever, no server trace, no telemetry).
 * This catches window `error` + `unhandledrejection` so that class of failure is visible
 * in the DB within minutes instead of being discovered by the owner reproducing it.
 *
 * Noise control:
 *  - drops cross-origin "Script error." (no info), ResizeObserver loop warnings,
 *    browser-extension frames, and null/undefined messages
 *  - dedupes by message within the tab session
 *  - hard cap of 10 events per tab session (a render-loop crash must not flood the log)
 */

const MAX_ERRORS_PER_SESSION = 10;
const IGNORE = [
  'Script error.', // cross-origin, zero information
  'ResizeObserver loop', // benign browser noise
  'Loading chunk', // stale-deploy chunk 404s — already recovered by a reload, and deploy-correlated
  'googletag', 'gtag', // ad/analytics third-party scripts
];

function shouldIgnore(msg: string, src?: string): boolean {
  if (!msg) return true;
  if (IGNORE.some((p) => msg.includes(p))) return true;
  if (src && (src.startsWith('chrome-extension://') || src.startsWith('moz-extension://') || src.startsWith('safari-extension://'))) return true;
  return false;
}

export function ClientErrorTracker() {
  useEffect(() => {
    const seen = new Set<string>();
    let sent = 0;

    const report = (kind: 'error' | 'rejection', msg: string, src?: string, line?: number, stack?: string) => {
      if (sent >= MAX_ERRORS_PER_SESSION) return;
      if (shouldIgnore(msg, src)) return;
      const key = msg.slice(0, 120);
      if (seen.has(key)) return;
      seen.add(key);
      sent += 1;
      trackEvent('CLIENT_ERROR', {
        kind,
        msg: msg.slice(0, 300),
        src: src ? src.slice(0, 200) : undefined,
        line,
        stack: stack ? stack.slice(0, 500) : undefined,
      });
    };

    const onError = (e: ErrorEvent) => {
      report('error', e.message || String(e.error || ''), e.filename, e.lineno, e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? r.message : typeof r === 'string' ? r : (() => { try { return JSON.stringify(r); } catch { return String(r); } })();
      report('rejection', msg || 'unhandled rejection', undefined, undefined, r instanceof Error ? r.stack : undefined);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
