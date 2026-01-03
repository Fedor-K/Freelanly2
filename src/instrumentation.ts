/**
 * Next.js Instrumentation
 *
 * This file runs when the server starts.
 * Used to initialize background services like cron scheduler.
 */

export async function register() {
  // Only run on server (not during build or on client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initScheduler } = await import('./lib/scheduler');
    initScheduler();
  }
}
