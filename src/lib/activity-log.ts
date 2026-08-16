/**
 * Activity Logging for Dispute Evidence
 *
 * Logs user actions with IP, user agent, and timestamps
 * for use as evidence in payment disputes.
 */

import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { ActivityAction } from '@prisma/client';

export { ActivityAction };

interface LogActivityParams {
  userId?: string | null;
  action: ActivityAction;
  details?: Record<string, unknown>;
  sessionId?: string;
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(): string | null {
  const headersList = headers();

  // Try various headers in order of preference
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headersList.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = headersList.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return null;
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(): string | null {
  const headersList = headers();
  return headersList.get('user-agent');
}

/**
 * Get country from Vercel/Cloudflare headers
 */
export function getCountry(): string | null {
  const headersList = headers();

  // Vercel
  const vercelCountry = headersList.get('x-vercel-ip-country');
  if (vercelCountry) return vercelCountry;

  // Cloudflare
  const cfCountry = headersList.get('cf-ipcountry');
  if (cfCountry) return cfCountry;

  return null;
}

/**
 * Get city from Vercel/Cloudflare headers
 */
export function getCity(): string | null {
  const headersList = headers();

  // Vercel
  const vercelCity = headersList.get('x-vercel-ip-city');
  if (vercelCity) return decodeURIComponent(vercelCity);

  // Cloudflare
  const cfCity = headersList.get('cf-ipcity');
  if (cfCity) return cfCity;

  return null;
}

/**
 * Log a user activity
 *
 * @example
 * await logActivity({
 *   userId: session.user.id,
 *   action: 'LOGIN',
 *   details: { method: 'google' },
 * });
 */
export async function logActivity({
  userId,
  action,
  details,
  sessionId,
}: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId || null,
        action,
        details: details || null,
        ipAddress: getClientIP(),
        userAgent: getUserAgent(),
        country: getCountry(),
        city: getCity(),
        sessionId: sessionId || null,
      },
    });
  } catch (error) {
    // Don't throw - logging should not break the main flow
    console.error('[ActivityLog] Failed to log activity:', error);
  }
}

/**
 * Get activity logs for a user (for dispute evidence)
 */
export async function getUserActivityLogs(
  userId: string,
  options?: { limit?: number; since?: Date }
) {
  return prisma.activityLog.findMany({
    where: {
      userId,
      ...(options?.since && { createdAt: { gte: options.since } }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
  });
}

/**
 * Get activity summary for dispute evidence
 */
export async function getDisputeEvidence(userId: string) {
  const [logs, applications, alerts] = await Promise.all([
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.application.count({
      where: { userId },
    }),
    prisma.jobAlert.count({
      where: { userId },
    }),
  ]);

  // Group by IP to show unique IPs
  const uniqueIPs = [...new Set(logs.map((l) => l.ipAddress).filter(Boolean))];
  const uniqueCountries = [...new Set(logs.map((l) => l.country).filter(Boolean))];

  return {
    totalActions: logs.length,
    totalApplications: applications,
    totalAlerts: alerts,
    uniqueIPs,
    uniqueCountries,
    firstActivity: logs[logs.length - 1]?.createdAt,
    lastActivity: logs[0]?.createdAt,
    recentLogs: logs.slice(0, 10),
  };
}
