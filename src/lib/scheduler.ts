/**
 * Node-cron scheduler for background jobs
 *
 * Runs on Reserved VM 24/7
 * All times are in UTC
 */

import cron from 'node-cron';

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.AUTH_URL || 'https://freelanly.com';

async function callCron(endpoint: string, name: string) {
  if (!CRON_SECRET) {
    console.error(`[Scheduler] CRON_SECRET not set, skipping ${name}`);
    return;
  }

  try {
    console.log(`[Scheduler] Running ${name}...`);
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });

    if (res.ok) {
      console.log(`[Scheduler] ${name} completed successfully`);
    } else {
      console.error(`[Scheduler] ${name} failed: ${res.status}`);
    }
  } catch (error) {
    console.error(`[Scheduler] ${name} error:`, error);
  }
}

let initialized = false;

export function initScheduler() {
  // Prevent double initialization
  if (initialized) {
    console.log('[Scheduler] Already initialized, skipping');
    return;
  }

  // Only run in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Scheduler] Skipping in development mode');
    return;
  }

  initialized = true;
  console.log('[Scheduler] Initializing cron jobs...');

  // ============================================
  // PARSING
  // ============================================

  // Fetch all sources - Daily at 6:00 UTC
  cron.schedule('0 6 * * *', () => {
    callCron('/api/cron/fetch-sources', 'fetch-sources');
  });

  // ============================================
  // EMAILS
  // ============================================

  // Process instant alerts - Every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    callCron('/api/cron/process-instant-alerts', 'process-instant-alerts');
  });

  // Trial onboarding emails - Every hour
  cron.schedule('0 * * * *', () => {
    callCron('/api/cron/send-trial-emails', 'send-trial-emails');
  });

  // Abandoned checkout emails - Every hour (offset by 30 min)
  cron.schedule('30 * * * *', () => {
    callCron('/api/cron/send-abandoned-checkout-emails', 'send-abandoned-checkout-emails');
  });

  // Win-back emails - Daily at 10:00 UTC
  cron.schedule('0 10 * * *', () => {
    callCron('/api/cron/send-winback-emails', 'send-winback-emails');
  });

  // Nurture emails - Daily at 9:00 UTC
  cron.schedule('0 9 * * *', () => {
    callCron('/api/cron/send-nurture', 'send-nurture');
  });

  // Re-engagement emails - Daily at 11:00 UTC
  cron.schedule('0 11 * * *', () => {
    callCron('/api/cron/send-reengagement-emails', 'send-reengagement-emails');
  });

  // ============================================
  // SEO & SOCIAL
  // ============================================

  // Submit to search engines - Daily at 8:00 UTC
  cron.schedule('0 8 * * *', () => {
    callCron('/api/cron/submit-to-index', 'submit-to-index');
  });

  // Post to social media - Every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    callCron('/api/cron/post-to-social', 'post-to-social');
  });

  console.log('[Scheduler] Cron jobs initialized:');
  console.log('  - fetch-sources: Daily 6:00 UTC');
  console.log('  - process-instant-alerts: Every 5 min');
  console.log('  - send-trial-emails: Hourly :00');
  console.log('  - send-abandoned-checkout-emails: Hourly :30');
  console.log('  - send-winback-emails: Daily 10:00 UTC');
  console.log('  - send-nurture: Daily 9:00 UTC');
  console.log('  - send-reengagement-emails: Daily 11:00 UTC');
  console.log('  - submit-to-index: Daily 8:00 UTC');
  console.log('  - post-to-social: Every 15 min');
}
