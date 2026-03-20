import { siteConfig } from '@/config/site';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;

/**
 * Generate a tracking pixel <img> tag for email open tracking.
 */
export function getTrackingPixel(alertId: string, userId?: string): string {
  const params = new URLSearchParams({ aid: alertId });
  if (userId) params.set('uid', userId);
  return `<img src="${APP_URL}/api/track/open?${params}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`;
}

/**
 * Wrap a URL with click tracking redirect.
 */
export function wrapLinkWithTracking(
  url: string,
  alertId: string,
  userId?: string,
  type?: 'job' | 'opportunity'
): string {
  const params = new URLSearchParams({
    url,
    aid: alertId,
  });
  if (userId) params.set('uid', userId);
  if (type) params.set('type', type);
  return `${APP_URL}/api/track/click?${params}`;
}

/**
 * Process email HTML: wrap all links with tracking and add tracking pixel.
 *
 * - Wraps href links (except unsubscribe) with click tracking
 * - Adds 1x1 tracking pixel before closing </body>
 */
export function addEmailTracking(
  html: string,
  alertId: string,
  userId?: string,
  type?: 'job' | 'opportunity'
): string {
  // Wrap links with click tracking (skip unsubscribe and manage alert links)
  const wrappedHtml = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url: string) => {
      // Don't wrap unsubscribe or manage-alerts links
      if (url.includes('/unsubscribe') || url.includes('/api/user/alerts/')) {
        return match;
      }
      const trackedUrl = wrapLinkWithTracking(url, alertId, userId, type);
      return `href="${trackedUrl}"`;
    }
  );

  // Add tracking pixel before </body>
  const pixel = getTrackingPixel(alertId, userId);
  return wrappedHtml.replace('</body>', `${pixel}</body>`);
}
