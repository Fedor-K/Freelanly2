/**
 * Next.js Instrumentation
 *
 * This file runs when the server starts.
 * Used to initialize background services like cron scheduler.
 *
 * Note: On Vercel, crons are handled via vercel.json, not node-cron.
 */

export async function register() {
  // Skip on Vercel - it uses vercel.json crons, not node-cron
  if (process.env.VERCEL) {
    console.log('[Instrumentation] Running on Vercel, skipping node-cron scheduler');
    return;
  }

  // Only run on server (not during build or on client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initScheduler } = await import('./lib/scheduler');
    initScheduler();
  }
}
