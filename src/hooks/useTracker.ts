'use client';

import { useCallback, useEffect } from 'react';

type TrackAction =
  // Navigation
  | 'PAGE_VIEW'
  | 'DASHBOARD_VIEW'
  // Jobs
  | 'JOB_VIEW'
  | 'JOB_APPLY'
  | 'JOB_SOURCE_CLICK'
  | 'JOB_SAVE'
  | 'JOB_SHARE'
  // Opportunities
  | 'OPPORTUNITY_VIEW'
  | 'OPPORTUNITY_APPLY_CLICK'
  | 'APPLY_DRAFT'
  // Paywall
  | 'PAYWALL_HIT'
  | 'PAYWALL_CLOSE'
  | 'UPGRADE_CLICK'
  | 'UPGRADE_MODAL_OPEN'
  // Pricing
  | 'PRICING_VIEW'
  | 'PRICING_PLAN_CLICK'
  | 'CHECKOUT_START'
  | 'CHECKOUT_COMPLETE'
  // Search & Filters
  | 'SEARCH'
  | 'FILTER_CHANGE'
  // Auth
  | 'SIGNUP_START'
  | 'SIGNUP_COMPLETE'
  | 'REGISTRATION_MODAL_OPEN'
  // Alerts
  | 'ALERT_CREATED'
  | 'ALERT_DELETED'
  // Auto-Apply
  | 'LOOP_CREATED'
  | 'LOOP_PAUSED'
  | 'LOOP_RESUMED'
  | 'LOOP_DELETED'
  | 'LOOP_UPDATED'
  | 'SMTP_CONNECTED'
  | 'SMTP_DISCONNECTED'
  | 'INBOX_VIEW'
  | 'INBOX_REPLY_SENT'
  | 'INBOX_AI_SUGGEST'
  | 'QUICK_APPLY'
  | 'SETTINGS_UPDATED'
  | 'TEMPLATE_CREATED'
  | 'TEMPLATE_DELETED'
  | 'RESUME_UPLOADED'
  | 'PROFILE_UPDATED'
  // Engagement
  | 'REPLY_VIEWED'
  | 'REPLY_EXPANDED'
  | 'RECRUITER_REPLIED'
  | 'RESUME_UPDATED'
  | 'LOOP_SETTINGS_CHANGED'
  | 'ONBOARDING_STEP'
  | 'FUNNEL_STEP'
  // Other
  | 'UNSUBSCRIBE'
  | 'CONTACT_VIEW'
  | 'CLIENT_ERROR';

interface TrackEvent {
  action: TrackAction;
  details?: Record<string, unknown>;
  pageUrl?: string;
  sessionId?: string;
}

const FLUSH_INTERVAL = 3000; // 3 seconds
const MAX_QUEUE_SIZE = 10;

// Generate a session ID per browser tab
let tabSessionId: string | null = null;
function getTabSessionId(): string {
  if (!tabSessionId) {
    tabSessionId = `ts_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  return tabSessionId;
}

// Global queue shared across all hook instances
let eventQueue: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

async function flushQueue() {
  if (isFlushing || eventQueue.length === 0) return;
  isFlushing = true;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  try {
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: eventsToSend }),
      // Use keepalive so events are sent even on page unload
      keepalive: true,
    });

    if (!response.ok) {
      // Put events back in queue on failure (don't lose data)
      eventQueue = [...eventsToSend, ...eventQueue].slice(0, 50);
    }
  } catch {
    // Network error — put events back
    eventQueue = [...eventsToSend, ...eventQueue].slice(0, 50);
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, FLUSH_INTERVAL);
}

function enqueueEvent(event: TrackEvent) {
  eventQueue.push(event);

  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushQueue();
  } else {
    scheduleFlush();
  }
}

/**
 * Hook for tracking user actions.
 *
 * Usage:
 *   const { track } = useTracker();
 *   track('JOB_VIEW', { jobId: '123', title: 'Developer' });
 */
export function useTracker() {
  // Flush on unmount / page leave. iOS Safari NEVER fires beforeunload — a queued event followed by
  // a hard navigation (e.g. the Stripe checkout redirect) was silently lost, which is exactly how
  // the first real pro5 checkout click vanished from the funnel. pagehide + visibilitychange(hidden)
  // are the events mobile Safari actually fires.
  useEffect(() => {
    const beaconFlush = () => {
      if (eventQueue.length > 0) {
        const data = JSON.stringify({ events: eventQueue });
        eventQueue = [];
        try {
          navigator.sendBeacon('/api/track', new Blob([data], { type: 'application/json' }));
        } catch {
          // sendBeacon not available — events lost
        }
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') beaconFlush(); };

    window.addEventListener('beforeunload', beaconFlush);
    window.addEventListener('pagehide', beaconFlush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', beaconFlush);
      window.removeEventListener('pagehide', beaconFlush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const track = useCallback(
    (action: TrackAction, details?: Record<string, unknown>) => {
      const event: TrackEvent = {
        action,
        details: details || undefined,
        pageUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined,
        sessionId: getTabSessionId(),
      };

      enqueueEvent(event);
    },
    []
  );

  return { track };
}

/**
 * Standalone track function for use outside React components.
 * Does not wait for session — fires immediately.
 */
export function trackEvent(action: TrackAction, details?: Record<string, unknown>) {
  const event: TrackEvent = {
    action,
    details: details || undefined,
    pageUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined,
    sessionId: getTabSessionId(),
  };
  enqueueEvent(event);
}
