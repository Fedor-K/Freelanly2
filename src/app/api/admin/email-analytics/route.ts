import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const validDays = [7, 30, 90].includes(days) ? days : 30;

    const now = new Date();
    const periodStart = new Date(now.getTime() - validDays * 24 * 60 * 60 * 1000);

    // Queries that don't depend on AlertNotification.messageId column
    const [
      funnelData,
      topClickedLinks,
      freeVsProStats,
      emailsToProData,
      hourlyOpens,
      dailyTrend,
    ] = await Promise.all([
      // 1. Funnel: sent -> delivered -> opened -> clicked (for period)
      prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
        SELECT "type", COUNT(*) as count
        FROM "EmailEvent"
        WHERE "timestamp" >= ${periodStart}
          AND "type" IN ('SENT', 'DELIVERED', 'OPENED', 'CLICKED')
        GROUP BY "type"
      `,

      // 3. Top clicked job links (from click event metadata)
      prisma.$queryRaw<Array<{ link: string; clicks: bigint }>>`
        SELECT
          metadata->>'link' as link,
          COUNT(*) as clicks
        FROM "EmailEvent"
        WHERE "type" = 'CLICKED'
          AND "timestamp" >= ${periodStart}
          AND metadata->>'link' IS NOT NULL
          AND metadata->>'link' LIKE '%/company/%/jobs/%'
        GROUP BY metadata->>'link'
        ORDER BY clicks DESC
        LIMIT 20
      `,

      // 4. FREE vs PRO user engagement
      prisma.$queryRaw<Array<{ plan: string; users: bigint; opens: bigint; clicks: bigint }>>`
        SELECT
          COALESCE(u."plan", 'FREE') as plan,
          COUNT(DISTINCT ee."to") as users,
          COUNT(DISTINCT CASE WHEN ee."type" = 'OPENED' THEN ee."id" END) as opens,
          COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) as clicks
        FROM "EmailEvent" ee
        LEFT JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
        WHERE ee."timestamp" >= ${periodStart}
          AND ee."type" IN ('DELIVERED', 'OPENED', 'CLICKED')
        GROUP BY u."plan"
      `,

      // 5. Average emails before PRO purchase
      prisma.$queryRaw<Array<{ avg_emails: number; pro_users: bigint }>>`
        SELECT
          ROUND(AVG(email_count)::numeric, 1) as avg_emails,
          COUNT(*) as pro_users
        FROM (
          SELECT
            u."id",
            COUNT(DISTINCT CONCAT(ja."email", DATE(an."sentAt"))) as email_count
          FROM "User" u
          JOIN "JobAlert" ja ON ja."userId" = u."id"
          JOIN "AlertNotification" an ON an."jobAlertId" = ja."id"
          WHERE u."plan" = 'PRO'
            AND u."proStartedAt" IS NOT NULL
            AND an."status" = 'SENT'
            AND an."sentAt" < u."proStartedAt"
          GROUP BY u."id"
          HAVING COUNT(DISTINCT CONCAT(ja."email", DATE(an."sentAt"))) > 0
        ) sub
      `,

      // 6. Hourly open heatmap (0-23 hours, UTC)
      prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT
          EXTRACT(HOUR FROM "timestamp")::int as hour,
          COUNT(*) as count
        FROM "EmailEvent"
        WHERE "type" = 'OPENED'
          AND "timestamp" >= ${periodStart}
        GROUP BY hour
        ORDER BY hour
      `,

      // 7. Daily trend (for chart)
      prisma.$queryRaw<Array<{ date: string; type: string; count: bigint }>>`
        SELECT
          DATE("timestamp") as date,
          "type",
          COUNT(*) as count
        FROM "EmailEvent"
        WHERE "timestamp" >= ${periodStart}
          AND "type" IN ('SENT', 'DELIVERED', 'OPENED', 'CLICKED')
        GROUP BY DATE("timestamp"), "type"
        ORDER BY date ASC
      `,
    ]);

    // Last click before PRO purchase — what link did each user click before converting
    const lastClickBeforePro = await prisma.$queryRaw<Array<{
      email: string;
      last_click: string | null;
      click_time: Date;
      pro_started: Date;
      hours_to_convert: number;
    }>>`
      SELECT DISTINCT ON (u."id")
        u."email",
        ee."metadata"->>'link' as last_click,
        ee."timestamp" as click_time,
        u."proStartedAt" as pro_started,
        EXTRACT(EPOCH FROM (u."proStartedAt" - ee."timestamp")) / 3600 as hours_to_convert
      FROM "User" u
      JOIN "EmailEvent" ee ON LOWER(ee."to") = LOWER(u."email")
      WHERE u."plan" = 'PRO'
        AND u."proStartedAt" IS NOT NULL
        AND ee."type" = 'CLICKED'
        AND ee."timestamp" < u."proStartedAt"
      ORDER BY u."id", ee."timestamp" DESC
    `;

    // Full journey for each PRO user: all email events before conversion
    const proJourneys = await prisma.$queryRaw<Array<{
      email: string;
      pro_started: Date;
      source: string | null;
      utm_medium: string | null;
      type: string;
      subject: string | null;
      link: string | null;
      timestamp: Date;
    }>>`
      SELECT
        u."email",
        u."proStartedAt" as pro_started,
        u."source",
        u."utmMedium" as utm_medium,
        ee."type",
        ee."subject",
        ee."metadata"->>'link' as link,
        ee."timestamp"
      FROM "User" u
      JOIN "EmailEvent" ee ON LOWER(ee."to") = LOWER(u."email")
      WHERE u."plan" = 'PRO'
        AND u."proStartedAt" IS NOT NULL
        AND ee."timestamp" < u."proStartedAt"
        AND ee."type" IN ('SENT', 'CLICKED')
      ORDER BY u."email", ee."timestamp" ASC
    `;

    // Category stats query uses AlertNotification.messageId — may fail if column not yet added
    let categoryStats: Array<{ category: string; sent: bigint; opened: bigint; clicked: bigint }> = [];
    try {
      categoryStats = await prisma.$queryRaw`
        SELECT
          COALESCE(ja."category", 'unknown') as category,
          COUNT(DISTINCT CASE WHEN ee."type" = 'SENT' THEN ee."id" END) as sent,
          COUNT(DISTINCT CASE WHEN ee."type" = 'OPENED' THEN ee."id" END) as opened,
          COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) as clicked
        FROM "EmailEvent" ee
        JOIN "AlertNotification" an ON ee."messageId" = an."messageId"
        JOIN "JobAlert" ja ON an."jobAlertId" = ja."id"
        WHERE ee."timestamp" >= ${periodStart}
          AND an."messageId" IS NOT NULL
        GROUP BY ja."category"
        ORDER BY sent DESC
      `;
    } catch (e) {
      console.warn('[Email Analytics] Category stats query failed (messageId column may not exist yet):', e);
    }

    // Process funnel
    const funnelMap: Record<string, number> = {};
    for (const row of funnelData) {
      funnelMap[row.type] = Number(row.count);
    }
    const funnel = {
      sent: funnelMap['SENT'] || 0,
      delivered: funnelMap['DELIVERED'] || 0,
      opened: funnelMap['OPENED'] || 0,
      clicked: funnelMap['CLICKED'] || 0,
    };

    // Process categories
    const categories = categoryStats.map((row) => ({
      category: row.category,
      sent: Number(row.sent),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
      openRate: Number(row.sent) > 0 ? Number(((Number(row.opened) / Number(row.sent)) * 100).toFixed(1)) : 0,
      clickRate: Number(row.sent) > 0 ? Number(((Number(row.clicked) / Number(row.sent)) * 100).toFixed(1)) : 0,
    }));

    // Process top clicked jobs - extract job title from URL
    const topJobs = topClickedLinks.map((row) => {
      const link = row.link;
      // Extract slug from URL pattern /company/{company}/jobs/{slug}
      const match = link.match(/\/company\/[^/]+\/jobs\/([^?]+)/);
      const slug = match ? match[1] : link;
      return {
        link,
        slug,
        clicks: Number(row.clicks),
      };
    });

    // Process FREE vs PRO
    const planStats = {
      free: { users: 0, opens: 0, clicks: 0 },
      pro: { users: 0, opens: 0, clicks: 0 },
    };
    for (const row of freeVsProStats) {
      const key = row.plan === 'PRO' ? 'pro' : 'free';
      planStats[key].users += Number(row.users);
      planStats[key].opens += Number(row.opens);
      planStats[key].clicks += Number(row.clicks);
    }

    // Process emails to PRO
    const emailsToPro = {
      avgEmails: emailsToProData[0]?.avg_emails ? Number(emailsToProData[0].avg_emails) : 0,
      proUsers: Number(emailsToProData[0]?.pro_users || 0),
    };

    // Process hourly heatmap (fill in missing hours with 0)
    const hourlyMap = new Map<number, number>();
    for (const row of hourlyOpens) {
      hourlyMap.set(row.hour, Number(row.count));
    }
    const heatmap = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyMap.get(i) || 0,
    }));

    // Process last click before PRO — strip tokens for security
    const proConversions = lastClickBeforePro.map((row) => {
      let link = row.last_click || '';
      // Remove sensitive tokens from URL
      link = link.replace(/[&?]token=[^&]+/g, '');
      // Remove email params
      link = link.replace(/[&?]email=[^&]+/g, '');
      // Clean up leftover ? or & at end
      link = link.replace(/[?&]$/, '');
      return {
        email: row.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // mask email
        lastClick: link,
        clickTime: row.click_time,
        proStarted: row.pro_started,
        hoursToConvert: Math.round(Number(row.hours_to_convert)),
      };
    }).sort((a, b) => new Date(b.clickTime).getTime() - new Date(a.clickTime).getTime()); // newest first

    // Process PRO journeys — group events by user
    const journeyMap = new Map<string, {
      email: string;
      proStarted: Date;
      source: string | null;
      events: Array<{ type: string; subject: string | null; link: string | null; timestamp: Date }>;
    }>();
    for (const row of proJourneys) {
      const masked = row.email.replace(/(.{2}).*(@.*)/, '$1***$2');
      if (!journeyMap.has(row.email)) {
        const src = row.source || row.utm_medium || null;
        journeyMap.set(row.email, { email: masked, proStarted: row.pro_started, source: src, events: [] });
      }
      let link = row.link || null;
      if (link) {
        link = link.replace(/[&?]token=[^&]+/g, '').replace(/[&?]email=[^&]+/g, '').replace(/[?&]$/, '');
      }
      journeyMap.get(row.email)!.events.push({
        type: row.type,
        subject: row.subject,
        link,
        timestamp: row.timestamp,
      });
    }
    const proJourneyList = Array.from(journeyMap.values())
      .map((j) => {
        // Detect conversion channel from last click before purchase
        const lastClick = [...j.events].reverse().find(e => e.type === 'CLICKED');
        const lastClickLink = lastClick?.link || '';
        const alertSubjects = j.events.filter(e =>
          e.type === 'SENT' && e.subject && (
            e.subject.includes('freelance project') ||
            e.subject.includes('Freelance Project') ||
            e.subject.includes('matched you') ||
            e.subject.includes('client contact inside')
          )
        );
        let channel: string | null = null;
        if (lastClickLink.includes('track/click') || lastClickLink.includes('utm_source=job_alert')) {
          channel = 'job_alert';
        } else if (alertSubjects.length > 0 && alertSubjects.length >= j.events.filter(e => e.type === 'SENT').length * 0.5) {
          channel = 'job_alert';
        }

        // Extract entry point: first clicked link (the post/job that brought them)
        const firstClick = j.events.find(e => e.type === 'CLICKED');
        let entryLink = firstClick?.link || null;
        let entryType: string | null = null;
        if (entryLink) {
          if (entryLink.includes('/freelance/')) {
            entryType = 'opportunity';
          } else if (entryLink.includes('/company/') && entryLink.includes('/jobs/')) {
            entryType = 'job';
          } else if (entryLink.includes('/pricing')) {
            entryType = 'pricing';
          }
        }

        return {
          ...j,
          channel,
          entryLink,
          entryType,
          totalEmails: j.events.filter(e => e.type === 'SENT').length,
          totalClicks: j.events.filter(e => e.type === 'CLICKED').length,
          firstEmail: j.events.find(e => e.type === 'SENT')?.timestamp || null,
          daysFromFirstEmail: j.events.find(e => e.type === 'SENT')
            ? Math.round((j.proStarted.getTime() - new Date(j.events.find(e => e.type === 'SENT')!.timestamp).getTime()) / (1000 * 60 * 60 * 24))
            : null,
        };
      })
      .sort((a, b) => new Date(b.proStarted).getTime() - new Date(a.proStarted).getTime());

    // Process daily trend
    const dailyMap: Record<string, Record<string, number>> = {};
    for (const row of dailyTrend) {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { sent: 0, delivered: 0, opened: 0, clicked: 0 };
      }
      dailyMap[dateStr][row.type.toLowerCase()] = Number(row.count);
    }
    const chartData = Object.entries(dailyMap)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      period: validDays,
      funnel,
      categories,
      topJobs,
      planStats,
      emailsToPro,
      proConversions,
      proJourneys: proJourneyList,
      heatmap,
      chartData,
    });
  } catch (error) {
    console.error('[Email Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email analytics' },
      { status: 500 }
    );
  }
}
