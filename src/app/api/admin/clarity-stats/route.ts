import { NextResponse } from 'next/server';

const CLARITY_TOKEN = process.env.CLARITY_API_TOKEN;

/**
 * Get Microsoft Clarity analytics data
 * GET /api/admin/clarity-stats
 */
export async function GET() {
  if (!CLARITY_TOKEN) {
    return NextResponse.json({ error: 'CLARITY_API_TOKEN not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3',
      {
        headers: { 'Authorization': `Bearer ${CLARITY_TOKEN}` },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Clarity API error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();

    // Transform data into easier format
    const metrics: Record<string, any> = {};
    for (const item of data) {
      metrics[item.metricName] = item.information;
    }

    // Extract key stats
    const traffic = metrics.Traffic?.[0] || {};
    const engagement = metrics.EngagementTime?.[0] || {};
    const scroll = metrics.ScrollDepth?.[0] || {};

    const result = {
      traffic: {
        sessions: parseInt(traffic.totalSessionCount) || 0,
        botSessions: parseInt(traffic.totalBotSessionCount) || 0,
        realSessions: (parseInt(traffic.totalSessionCount) || 0) - (parseInt(traffic.totalBotSessionCount) || 0),
        uniqueUsers: parseInt(traffic.distinctUserCount) || 0,
        pagesPerSession: parseFloat(traffic.pagesPerSessionPercentage) || 0,
        botPercentage: traffic.totalSessionCount
          ? Math.round((parseInt(traffic.totalBotSessionCount) / parseInt(traffic.totalSessionCount)) * 100)
          : 0,
      },
      engagement: {
        totalTime: parseInt(engagement.totalTime) || 0,
        activeTime: parseInt(engagement.activeTime) || 0,
        scrollDepth: parseFloat(scroll.averageScrollDepth) || 0,
      },
      uxIssues: {
        deadClicks: parseFloat(metrics.DeadClickCount?.[0]?.sessionsWithMetricPercentage) || 0,
        rageClicks: parseFloat(metrics.RageClickCount?.[0]?.sessionsWithMetricPercentage) || 0,
        quickBack: parseFloat(metrics.QuickbackClick?.[0]?.sessionsWithMetricPercentage) || 0,
        scriptErrors: parseFloat(metrics.ScriptErrorCount?.[0]?.sessionsWithMetricPercentage) || 0,
      },
      devices: (metrics.Device || []).map((d: any) => ({
        name: d.name,
        sessions: parseInt(d.sessionsCount) || 0,
      })),
      countries: (metrics.Country || []).slice(0, 10).map((c: any) => ({
        name: c.name,
        sessions: parseInt(c.sessionsCount) || 0,
      })),
      browsers: (metrics.Browser || []).slice(0, 5).map((b: any) => ({
        name: b.name,
        sessions: parseInt(b.sessionsCount) || 0,
      })),
      topPages: (metrics.PopularPages || []).slice(0, 10).map((p: any) => ({
        url: p.url,
        visits: parseInt(p.visitsCount) || 0,
      })),
      referrers: (metrics.ReferrerUrl || []).slice(0, 10).map((r: any) => ({
        url: r.name,
        sessions: parseInt(r.sessionsCount) || 0,
      })),
      pageTitles: (metrics.PageTitle || []).slice(0, 10).map((p: any) => ({
        title: p.name,
        sessions: parseInt(p.sessionsCount) || 0,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Clarity] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
