'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Mail,
  Send,
  CheckCircle,
  Eye,
  MousePointer,
  AlertTriangle,
  XCircle,
  Loader2,
  TrendingUp,
  Clock,
  Crown,
  Users,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ==================== Types ====================

interface EmailStatsData {
  success: boolean;
  timestamp: string;
  resend: {
    totalEvents: number;
    hasData: boolean;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    clickedTotal: number;
    bounced: number;
    complained: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  alerts: {
    emailsSent: number;
    last7Days: number;
    last30Days: number;
    uniqueRecipients: number;
    avgJobsPerEmail: number;
    totalJobNotifications: number;
  };
  recentEvents: Array<{
    id: string;
    type: string;
    to: string;
    subject: string | null;
    timestamp: string;
    metadata: Record<string, unknown> | null;
  }>;
  chartData: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>;
}

interface AnalyticsData {
  success: boolean;
  period: number;
  funnel: { sent: number; delivered: number; opened: number; clicked: number };
  categories: Array<{
    category: string;
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
  }>;
  topJobs: Array<{ link: string; slug: string; clicks: number }>;
  planStats: {
    free: { users: number; opens: number; clicks: number };
    pro: { users: number; opens: number; clicks: number };
  };
  emailsToPro: { avgEmails: number; proUsers: number };
  proConversions: Array<{
    email: string;
    lastClick: string;
    clickTime: string;
    proStarted: string;
    hoursToConvert: number;
  }>;
  heatmap: Array<{ hour: number; count: number }>;
  chartData: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
}

// ==================== Constants ====================

const typeColors: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  OPENED: 'bg-purple-100 text-purple-700',
  CLICKED: 'bg-indigo-100 text-indigo-700',
  BOUNCED: 'bg-red-100 text-red-700',
  COMPLAINED: 'bg-orange-100 text-orange-700',
};

const typeIcons: Record<string, React.ReactNode> = {
  SENT: <Send className="h-4 w-4" />,
  DELIVERED: <CheckCircle className="h-4 w-4" />,
  OPENED: <Eye className="h-4 w-4" />,
  CLICKED: <MousePointer className="h-4 w-4" />,
  BOUNCED: <XCircle className="h-4 w-4" />,
  COMPLAINED: <AlertTriangle className="h-4 w-4" />,
};

const eventTypes = ['ALL', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED'] as const;
type EventFilter = typeof eventTypes[number];

const periods = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
] as const;

// ==================== Helper Components ====================

function FunnelBar({ label, value, maxValue, color, icon }: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  icon: React.ReactNode;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-24 shrink-0">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-sm font-semibold">
          {value.toLocaleString()}
          {maxValue > 0 && value < maxValue && (
            <span className="text-gray-500 ml-1 font-normal">
              ({pct.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function HeatmapRow({ data }: { data: Array<{ hour: number; count: number }> }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex gap-1">
      {data.map((d) => {
        const intensity = d.count / maxCount;
        const bg = intensity === 0
          ? 'bg-gray-100'
          : intensity < 0.25
            ? 'bg-purple-100'
            : intensity < 0.5
              ? 'bg-purple-200'
              : intensity < 0.75
                ? 'bg-purple-400'
                : 'bg-purple-600';
        const text = intensity >= 0.5 ? 'text-white' : 'text-gray-700';
        return (
          <div
            key={d.hour}
            className={`flex-1 h-10 rounded flex items-center justify-center text-xs font-medium ${bg} ${text}`}
            title={`${d.hour}:00 UTC — ${d.count} opens`}
          >
            {d.count > 0 ? d.count : ''}
          </div>
        );
      })}
    </div>
  );
}

// ==================== Main Page ====================

export default function EmailStatsPage() {
  const [data, setData] = useState<EmailStatsData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>('ALL');
  const [period, setPeriod] = useState<number>(30);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const [statsRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/email-stats'),
        fetch(`/api/admin/email-analytics?days=${period}`),
      ]);
      if (!statsRes.ok) throw new Error(`Stats: HTTP ${statsRes.status}`);
      if (!analyticsRes.ok) throw new Error(`Analytics: HTTP ${analyticsRes.status}`);
      const [statsJson, analyticsJson] = await Promise.all([
        statsRes.json(),
        analyticsRes.json(),
      ]);
      if (statsJson.success) setData(statsJson);
      else throw new Error(statsJson.error || 'Failed to load stats');
      if (analyticsJson.success) setAnalytics(analyticsJson);
      else throw new Error(analyticsJson.error || 'Failed to load analytics');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-4">Email Analytics</h1>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <p className="text-red-600">Failed to load: {error}</p>
            <Button onClick={fetchData} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Email Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Job alert delivery & engagement metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex bg-muted rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Job Alert Emails Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Job Alert Emails
          </CardTitle>
          <CardDescription>Actual emails sent to users (one email = many jobs)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-blue-600">
                {(data.alerts?.emailsSent ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Emails Sent</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-600">
                {(data.alerts?.last7Days ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-purple-600">
                {(data.alerts?.uniqueRecipients ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Unique Recipients</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-orange-600">
                ~{data.alerts?.avgJobsPerEmail ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Jobs per Email</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Total job notifications: {(data.alerts?.totalJobNotifications ?? 0).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* Funnel: Sent -> Delivered -> Opened -> Clicked */}
      {analytics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Email Funnel ({period} days)
            </CardTitle>
            <CardDescription>
              How emails flow from send to click
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FunnelBar label="Sent" value={analytics.funnel.sent} maxValue={analytics.funnel.sent} color="bg-blue-500" icon={<Send className="h-4 w-4 text-blue-600" />} />
            <FunnelBar label="Delivered" value={analytics.funnel.delivered} maxValue={analytics.funnel.sent} color="bg-green-500" icon={<CheckCircle className="h-4 w-4 text-green-600" />} />
            <FunnelBar label="Opened" value={analytics.funnel.opened} maxValue={analytics.funnel.sent} color="bg-purple-500" icon={<Eye className="h-4 w-4 text-purple-600" />} />
            <FunnelBar label="Clicked" value={analytics.funnel.clicked} maxValue={analytics.funnel.sent} color="bg-indigo-500" icon={<MousePointer className="h-4 w-4 text-indigo-600" />} />

            {/* Rate summary */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className={`text-xl font-bold ${(data.resend?.deliveryRate ?? 0) >= 95 ? 'text-green-600' : (data.resend?.deliveryRate ?? 0) >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {analytics.funnel.sent > 0 ? ((analytics.funnel.delivered / analytics.funnel.sent) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Delivery Rate</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${(data.resend?.openRate ?? 0) >= 20 ? 'text-green-600' : (data.resend?.openRate ?? 0) >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {analytics.funnel.delivered > 0 ? ((analytics.funnel.opened / analytics.funnel.delivered) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${(data.resend?.clickRate ?? 0) >= 5 ? 'text-green-600' : (data.resend?.clickRate ?? 0) >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {analytics.funnel.opened > 0 ? ((analytics.funnel.clicked / analytics.funnel.opened) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Click Rate (of opened)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Trend Chart */}
      {analytics && analytics.chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Trend ({period} days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
                />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} dot={false} name="Delivered" />
                <Line type="monotone" dataKey="opened" stroke="#a855f7" strokeWidth={2} dot={false} name="Opened" />
                <Line type="monotone" dataKey="clicked" stroke="#6366f1" strokeWidth={2} dot={false} name="Clicked" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category Stats + FREE vs PRO side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Stats */}
        {analytics && analytics.categories.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">By Category</CardTitle>
              <CardDescription>Engagement rates by job alert category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.categories.map((cat) => {
                  const maxSent = Math.max(...analytics.categories.map(c => c.sent), 1);
                  const barWidth = (cat.sent / maxSent) * 100;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{cat.category || 'unknown'}</span>
                        <span className="text-muted-foreground">
                          {cat.sent} sent / {cat.openRate}% open / {cat.clickRate}% click
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FREE vs PRO */}
        {analytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                FREE vs PRO
              </CardTitle>
              <CardDescription>Who engages more with email alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* FREE */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-gray-600" />
                    <span className="font-semibold">FREE</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Users</span>
                      <span className="font-medium">{analytics.planStats.free.users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Opens</span>
                      <span className="font-medium">{analytics.planStats.free.opens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clicks</span>
                      <span className="font-medium">{analytics.planStats.free.clicks}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Click/Open</span>
                      <span className="font-bold">
                        {analytics.planStats.free.opens > 0
                          ? ((analytics.planStats.free.clicks / analytics.planStats.free.opens) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
                {/* PRO */}
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-4 w-4 text-amber-600" />
                    <span className="font-semibold text-amber-800">PRO</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Users</span>
                      <span className="font-medium">{analytics.planStats.pro.users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Opens</span>
                      <span className="font-medium">{analytics.planStats.pro.opens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clicks</span>
                      <span className="font-medium">{analytics.planStats.pro.clicks}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Click/Open</span>
                      <span className="font-bold text-amber-700">
                        {analytics.planStats.pro.opens > 0
                          ? ((analytics.planStats.pro.clicks / analytics.planStats.pro.opens) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emails to PRO */}
              {analytics.emailsToPro.proUsers > 0 && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg emails before PRO purchase</p>
                      <p className="text-sm text-muted-foreground">
                        Based on {analytics.emailsToPro.proUsers} PRO user{analytics.emailsToPro.proUsers > 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-amber-600">
                      ~{analytics.emailsToPro.avgEmails}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Last Click Before PRO */}
      {analytics && analytics.proConversions && analytics.proConversions.length > 0 && (() => {
        // Parse each conversion into a readable source
        const parsed = analytics.proConversions.map((conv) => {
          const url = conv.lastClick || '';
          let source: string;
          let detail: string;
          let sourceType: 'abandoned_checkout' | 'job_alert' | 'freelance' | 'login' | 'pricing' | 'other';
          let badgeColor: string;

          if (url.includes('coupon=') || url.includes('source=email_abandoned')) {
            source = 'Abandoned Checkout Email';
            const couponMatch = url.match(/coupon=([^&]+)/);
            detail = couponMatch ? `coupon: ${couponMatch[1]}` : '';
            sourceType = 'abandoned_checkout';
            badgeColor = 'bg-orange-100 text-orange-700';
          } else if (url.includes('/company/') && url.includes('/jobs/')) {
            const match = url.match(/\/company\/[^/]+\/jobs\/([^?]+)/);
            source = 'Job Alert Click';
            detail = match ? decodeURIComponent(match[1]).replace(/-/g, ' ') : '';
            sourceType = 'job_alert';
            badgeColor = 'bg-blue-100 text-blue-700';
          } else if (url.includes('/freelance/') && !url.includes('callback')) {
            const match = url.match(/\/freelance\/([^?]+)/);
            source = 'Freelance Project Click';
            detail = match ? decodeURIComponent(match[1]).replace(/-/g, ' ') : '';
            sourceType = 'freelance';
            badgeColor = 'bg-purple-100 text-purple-700';
          } else if (url.includes('callback') && url.includes('pricing')) {
            source = 'Login → Pricing';
            const planMatch = url.match(/plan=([^&]+)/);
            detail = planMatch ? planMatch[1] : '';
            sourceType = 'pricing';
            badgeColor = 'bg-green-100 text-green-700';
          } else if (url.includes('callback') && url.includes('freelance')) {
            const match = url.match(/callbackUrl=[^/]*\/freelance\/([^&?]+)/);
            source = 'Login → Freelance';
            detail = match ? decodeURIComponent(match[1]).replace(/-/g, ' ') : '';
            sourceType = 'freelance';
            badgeColor = 'bg-purple-100 text-purple-700';
          } else if (url.includes('callback') && url.includes('jobs')) {
            source = 'Login → Jobs';
            detail = '';
            sourceType = 'job_alert';
            badgeColor = 'bg-blue-100 text-blue-700';
          } else if (url.includes('callback')) {
            source = 'Login (magic link)';
            detail = '';
            sourceType = 'login';
            badgeColor = 'bg-gray-100 text-gray-700';
          } else if (url.includes('/pricing')) {
            source = 'Pricing Page';
            detail = '';
            sourceType = 'pricing';
            badgeColor = 'bg-green-100 text-green-700';
          } else {
            source = 'Other';
            detail = url.replace(/https?:\/\/[^/]+/, '').split('?')[0];
            sourceType = 'other';
            badgeColor = 'bg-gray-100 text-gray-700';
          }

          return { ...conv, source, detail, sourceType, badgeColor };
        });

        // Count by source type for summary
        const sourceCounts: Record<string, number> = {};
        for (const p of parsed) {
          sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
        }
        const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-600" />
                Last Click Before PRO Purchase
              </CardTitle>
              <CardDescription>
                What brought {analytics.proConversions.length} users to PRO — their last email click before upgrading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary: what type of email click led to PRO */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Что кликнули последним перед покупкой PRO:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sortedSources.map(([source, count]) => (
                    <div key={source} className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm">
                      <span className="font-semibold">{count}</span>
                      <span className="text-muted-foreground ml-1">× {source}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual conversions */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {parsed.map((conv, i) => {
                  const hoursLabel = conv.hoursToConvert < 1
                    ? 'same session'
                    : conv.hoursToConvert < 24
                      ? `${conv.hoursToConvert}h before`
                      : `${Math.round(conv.hoursToConvert / 24)}d before`;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100"
                    >
                      <span className="text-sm font-medium text-muted-foreground w-6 text-right shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${conv.badgeColor}`}>
                            {conv.source}
                          </span>
                          {conv.detail && (
                            <span className="text-sm truncate" title={conv.detail}>
                              {conv.detail}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{conv.email}</span>
                          <span>·</span>
                          <span>{new Date(conv.clickTime).toLocaleDateString()}</span>
                          <span>·</span>
                          <span className="text-amber-600 font-medium">{hoursLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Top Clicked Jobs */}
      {analytics && analytics.topJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MousePointer className="h-5 w-5" />
              Top Clicked Jobs ({period} days)
            </CardTitle>
            <CardDescription>Most popular job links from email alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topJobs.map((job, i) => {
                const maxClicks = analytics.topJobs[0].clicks;
                const barWidth = (job.clicks / maxClicks) * 100;
                return (
                  <div key={job.link} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6 text-right">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" title={job.slug}>
                          {decodeURIComponent(job.slug).replace(/-/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {job.clicks} click{job.clicks > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Heatmap */}
      {analytics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Opens by Hour (UTC)
            </CardTitle>
            <CardDescription>When people open their email alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <HeatmapRow data={analytics.heatmap} />
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>0:00</span>
                <span>6:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resend Webhook Stats (All Time) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resend Webhook Events (All Time)
          </CardTitle>
          <CardDescription>
            {data.resend?.hasData
              ? `${(data.resend?.totalEvents ?? 0).toLocaleString()} total events tracked`
              : 'No webhook events yet. Configure webhook in Resend Dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.resend?.hasData ? (
            <div className="space-y-6">
              {/* Event counts */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <Send className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-600">{(data.resend?.sent ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-600">{(data.resend?.delivered ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <Eye className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-600">{(data.resend?.opened ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Opened</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg text-center">
                  <MousePointer className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-indigo-600">{(data.resend?.clicked ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Unique Clickers</p>
                  {(data.resend?.clickedTotal ?? 0) > (data.resend?.clicked ?? 0) && (
                    <p className="text-xs text-indigo-400 mt-0.5">({data.resend?.clickedTotal} clicks)</p>
                  )}
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-600">{data.resend?.bounced ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Bounced</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-orange-600">{data.resend?.complained ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Complaints</p>
                </div>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${(data.resend?.deliveryRate ?? 0) >= 95 ? 'text-green-600' : (data.resend?.deliveryRate ?? 0) >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend?.deliveryRate ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Delivery Rate</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${(data.resend?.openRate ?? 0) >= 20 ? 'text-green-600' : (data.resend?.openRate ?? 0) >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend?.openRate ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${(data.resend?.clickRate ?? 0) >= 5 ? 'text-green-600' : (data.resend?.clickRate ?? 0) >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend?.clickRate ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Click Rate</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${(data.resend?.bounceRate ?? 0) <= 2 ? 'text-green-600' : (data.resend?.bounceRate ?? 0) <= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend?.bounceRate ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Bounce Rate</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No Resend webhook data yet</p>
              <p className="text-sm mt-2">
                Configure webhook in Resend Dashboard pointing to:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                https://freelanly.com/api/webhooks/resend
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Events
          </CardTitle>
          <CardDescription>Filter by event type to see who clicked, opened, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Event Type Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            {eventTypes.map((type) => (
              <button
                key={type}
                onClick={() => setEventFilter(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  eventFilter === type
                    ? type === 'ALL'
                      ? 'bg-gray-900 text-white'
                      : typeColors[type] || 'bg-gray-900 text-white'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {type === 'ALL' ? 'All' : (
                  <span className="flex items-center gap-1">
                    {typeIcons[type]}
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </span>
                )}
              </button>
            ))}
          </div>

          {(data.recentEvents?.length ?? 0) > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(data.recentEvents ?? [])
                .filter((event) => eventFilter === 'ALL' || event.type === eventFilter)
                .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${typeColors[event.type] || 'bg-gray-100'}`}>
                    {typeIcons[event.type]}
                    {event.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block" title={event.to}>
                      {event.to}
                    </span>
                    {event.subject && (
                      <span className="text-xs text-muted-foreground truncate block" title={event.subject}>
                        {event.subject}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
              {(data.recentEvents ?? []).filter((event) => eventFilter === 'ALL' || event.type === eventFilter).length === 0 && (
                <p className="text-center py-4 text-muted-foreground">
                  No {eventFilter.toLowerCase()} events yet
                </p>
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No events recorded yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timestamp */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
