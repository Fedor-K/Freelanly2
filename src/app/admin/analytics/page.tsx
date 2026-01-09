'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Mail,
  MousePointer,
  Globe,
  Loader2,
  Calendar,
  Zap,
  Search,
} from 'lucide-react';

interface DashboardData {
  success: boolean;
  timestamp: string;
  goal: {
    targetMRR: number;
    currentMRR: number;
    progressPercent: number;
    remaining: number;
    targetDate: string;
    daysRemaining: number;
    requiredDailyGrowth: number;
  };
  funnel: {
    traffic: { value: number; source: string };
    registrations: { value: number; total: number; conversionFromTraffic: number };
    jobAlerts: { value: number; activeAlerts: number; conversionFromRegistration: number };
    paywallHits: { value: number; total30d: number; conversionFromAlerts: number };
    proUsers: { value: number; new30d: number; trialing: number; conversionFromPaywall: number };
    mrr: { value: number; currency: string; arpu: number };
  };
  stripe: {
    mrr: { total: string; currency: string };
    arr: { total: string; currency: string };
    subscriptions: {
      active: number;
      trialing: number;
      byPlan: Record<string, { count: number; mrr: string }>;
    };
    trials: { current: number; converted30d: number; canceled30d: number; conversionRate: number };
    churn: { canceled30d: number; rate: number };
  };
  churn: {
    total: number;
    byReason: Array<{ reason: string; label: string; count: number; percent: number }>;
    topReason: string;
    trend: { current30d: number; previous30d: number; change: number };
  };
  emails: {
    trial: { totalSent: number; last7Days: number };
    winback: { totalSent: number; resubscribed: number; conversionRate: number };
    abandonedCheckout: { totalSent: number; converted: number; conversionRate: number };
    alerts: { sent30d: number };
  };
  traffic: {
    source: string;
    sessions30d: number;
    visitors30d: number;
    sources: Record<string, number>;
  };
  uxIssues: {
    available: boolean;
    deadClicks: number;
    rageClicks: number;
    quickBack: number;
    scriptErrors: number;
    hasIssues: boolean;
  };
  gsc: {
    available: boolean;
    error?: string;
    summary: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    topQueries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
    topPages: Array<{
      page: string;
      clicks: number;
      impressions: number;
    }>;
    countries: Array<{
      country: string;
      clicks: number;
      impressions: number;
    }>;
  };
  trends: {
    last30Days: Array<{ date: string; mrr: number; signups: number; conversions: number; churns: number }>;
  };
  alerts: Array<{ type: 'warning' | 'critical' | 'success' | 'info'; title: string; message: string }>;
}

// ============================================
// COMPONENTS
// ============================================

function GoalProgressCard({ goal }: { goal: DashboardData['goal'] }) {
  const progressColor = goal.progressPercent >= 50 ? 'bg-green-500' : goal.progressPercent >= 25 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          MRR Goal Progress
        </CardTitle>
        <CardDescription>Target: {goal.targetDate}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="relative">
            <div className="h-6 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {goal.progressPercent.toFixed(1)}%
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{goal.currentMRR.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Current MRR</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{goal.targetMRR.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Target MRR</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{goal.remaining.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>

          {/* Daily growth needed */}
          <div className="flex items-center justify-between pt-2 border-t text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{goal.daysRemaining} days left</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Need +{goal.requiredDailyGrowth.toFixed(0)}/day</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelVisualization({ funnel }: { funnel: DashboardData['funnel'] }) {
  const stages = [
    {
      name: 'Traffic',
      value: funnel.traffic.value,
      label: funnel.traffic.source === 'metrika' ? 'Sessions' : 'N/A',
      conversion: null,
      icon: Globe,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      name: 'Signups',
      value: funnel.registrations.value,
      label: '30d new',
      conversion: funnel.registrations.conversionFromTraffic,
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      name: 'Alerts',
      value: funnel.jobAlerts.value,
      label: 'with alerts',
      conversion: funnel.jobAlerts.conversionFromRegistration,
      icon: Mail,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      name: 'Paywall',
      value: funnel.paywallHits.value,
      label: 'hit paywall',
      conversion: funnel.paywallHits.conversionFromAlerts,
      icon: Target,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      name: 'PRO',
      value: funnel.proUsers.value,
      label: `+${funnel.proUsers.trialing} trialing`,
      conversion: funnel.proUsers.conversionFromPaywall,
      icon: DollarSign,
      color: 'bg-green-100 text-green-600',
    },
    {
      name: 'MRR',
      value: funnel.mrr.value,
      label: funnel.mrr.currency,
      conversion: null,
      icon: TrendingUp,
      color: 'bg-emerald-100 text-emerald-600',
      isCurrency: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Conversion Funnel</CardTitle>
        <CardDescription>30-day user journey from traffic to MRR</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-1 overflow-x-auto py-4">
          {stages.map((stage, i) => (
            <div key={stage.name} className="flex items-center">
              {/* Stage */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className={`w-12 h-12 rounded-full ${stage.color} flex items-center justify-center mb-2`}>
                  <stage.icon className="h-6 w-6" />
                </div>
                <p className="text-xl font-bold">
                  {stage.isCurrency ? `${stage.value.toFixed(0)}` : stage.value.toLocaleString()}
                </p>
                <p className="text-xs font-medium">{stage.name}</p>
                <p className="text-xs text-muted-foreground">{stage.label}</p>
              </div>

              {/* Arrow with conversion */}
              {i < stages.length - 1 && (
                <div className="flex flex-col items-center mx-1">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  {stages[i + 1].conversion !== null && (
                    <span className="text-xs font-medium text-primary mt-1">
                      {stages[i + 1].conversion}%
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StripeMetricsCard({ stripe }: { stripe: DashboardData['stripe'] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Stripe Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{stripe.mrr.total}</p>
            <p className="text-xs text-muted-foreground">MRR ({stripe.mrr.currency})</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stripe.arr.total}</p>
            <p className="text-xs text-muted-foreground">ARR ({stripe.arr.currency})</p>
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Active Subscriptions</span>
            <span className="font-medium">{stripe.subscriptions.active}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Currently Trialing</span>
            <span className="font-medium">{stripe.subscriptions.trialing}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Trial Conversion</span>
            <span className={`font-medium ${stripe.trials.conversionRate >= 50 ? 'text-green-600' : stripe.trials.conversionRate >= 30 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stripe.trials.conversionRate}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Churn Rate (30d)</span>
            <span className={`font-medium ${stripe.churn.rate <= 5 ? 'text-green-600' : stripe.churn.rate <= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stripe.churn.rate}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChurnAnalysisCard({ churn }: { churn: DashboardData['churn'] }) {
  const maxCount = Math.max(...churn.byReason.map(r => r.count), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500" />
          Churn Analysis
        </CardTitle>
        <CardDescription>
          {churn.trend.change !== 0 && (
            <span className={churn.trend.change > 0 ? 'text-red-500' : 'text-green-500'}>
              {churn.trend.change > 0 ? '+' : ''}{churn.trend.change}% vs prev 30d
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground mb-2">
          Top reason: <span className="font-medium text-foreground">{churn.topReason}</span>
        </div>

        {churn.byReason.slice(0, 5).map((reason) => (
          <div key={reason.reason} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="truncate">{reason.label}</span>
              <span className="font-medium">{reason.count} ({reason.percent}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full"
                style={{ width: `${(reason.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmailEffectivenessCard({ emails }: { emails: DashboardData['emails'] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Effectiveness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Trial Emails</p>
            <p className="text-lg font-bold">{emails.trial.totalSent}</p>
            <p className="text-xs text-muted-foreground">last 7d: {emails.trial.last7Days}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600 font-medium">Win-back</p>
            <p className="text-lg font-bold">{emails.winback.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">{emails.winback.resubscribed} resubscribed</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-orange-600 font-medium">Abandoned Cart</p>
            <p className="text-lg font-bold">{emails.abandonedCheckout.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">{emails.abandonedCheckout.converted} recovered</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-600 font-medium">Job Alerts</p>
            <p className="text-lg font-bold">{emails.alerts.sent30d.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">sent (30d)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrafficSourcesCard({ traffic }: { traffic: DashboardData['traffic'] }) {
  const sources = Object.entries(traffic.sources || {}).sort((a, b) => b[1] - a[1]);
  const total = sources.reduce((sum, [, val]) => sum + val, 0) || 1;

  const colors: Record<string, string> = {
    organic: 'bg-green-400',
    direct: 'bg-blue-400',
    social: 'bg-purple-400',
    referral: 'bg-orange-400',
    email: 'bg-pink-400',
    other: 'bg-gray-400',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Traffic Sources
        </CardTitle>
        <CardDescription>
          {traffic.source === 'metrika' ? 'Yandex Metrika (30d)' : 'Data unavailable'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {traffic.source !== 'unavailable' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold">{traffic.sessions30d.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{traffic.visitors30d.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Visitors</p>
              </div>
            </div>

            {sources.map(([source, value]) => (
              <div key={source} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{source}</span>
                  <span className="font-medium">{value.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors[source] || 'bg-gray-400'} rounded-full`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Configure YANDEX_METRIKA_TOKEN to see traffic data
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function UXIssuesCard({ uxIssues }: { uxIssues: DashboardData['uxIssues'] }) {
  const issues = [
    { name: 'Dead Clicks', value: uxIssues.deadClicks, threshold: 5 },
    { name: 'Rage Clicks', value: uxIssues.rageClicks, threshold: 5 },
    { name: 'Quick Back', value: uxIssues.quickBack, threshold: 5 },
    { name: 'Script Errors', value: uxIssues.scriptErrors, threshold: 5 },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MousePointer className="h-5 w-5" />
          UX Issues (Clarity)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uxIssues.available ? (
          <div className="space-y-3">
            {uxIssues.hasIssues ? (
              <div className="flex items-center gap-2 text-yellow-600 text-sm mb-3">
                <AlertTriangle className="h-4 w-4" />
                <span>Some metrics above threshold</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 text-sm mb-3">
                <CheckCircle className="h-4 w-4" />
                <span>All metrics healthy</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {issues.map((issue) => (
                <div
                  key={issue.name}
                  className={`p-2 rounded-lg ${issue.value > issue.threshold ? 'bg-red-50' : 'bg-green-50'}`}
                >
                  <p className="text-xs text-muted-foreground">{issue.name}</p>
                  <p className={`text-lg font-bold ${issue.value > issue.threshold ? 'text-red-600' : 'text-green-600'}`}>
                    {issue.value.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Configure CLARITY_API_TOKEN to see UX metrics
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GSCCard({ gsc }: { gsc: DashboardData['gsc'] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          Google Search Console
        </CardTitle>
        <CardDescription>Organic search performance (28d)</CardDescription>
      </CardHeader>
      <CardContent>
        {gsc.available ? (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-bold text-blue-600">{gsc.summary.clicks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg text-center">
                <p className="text-lg font-bold text-purple-600">{gsc.summary.impressions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Impressions</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-center">
                <p className="text-lg font-bold text-green-600">{gsc.summary.ctr}%</p>
                <p className="text-xs text-muted-foreground">CTR</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg text-center">
                <p className="text-lg font-bold text-orange-600">{gsc.summary.position.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Avg Position</p>
              </div>
            </div>

            {/* Top Queries */}
            {gsc.topQueries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Top Queries</p>
                <div className="space-y-2">
                  {gsc.topQueries.slice(0, 5).map((q, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 mr-2" title={q.query}>{q.query}</span>
                      <span className="text-muted-foreground">{q.clicks} clicks</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Pages */}
            {gsc.topPages.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Top Pages</p>
                <div className="space-y-2">
                  {gsc.topPages.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 mr-2" title={p.page}>{p.page || '/'}</span>
                      <span className="text-muted-foreground">{p.clicks} clicks</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {gsc.error || 'Configure GOOGLE_INDEXING_CREDENTIALS and add service account to GSC'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsCard({ alerts }: { alerts: DashboardData['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">All systems healthy - no alerts</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const iconMap = {
    critical: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const bgMap = {
    critical: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    success: 'bg-green-50 border-green-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Alerts & Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border ${bgMap[alert.type]}`}
          >
            {iconMap[alert.type]}
            <div>
              <p className="font-medium text-sm">{alert.title}</p>
              <p className="text-xs text-muted-foreground">{alert.message}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function CEODashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin/ceo-dashboard');

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || 'Failed to load data');
      }
    } catch (err) {
      setError(String(err));
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

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
        <h1 className="text-3xl font-bold mb-4">CEO Dashboard</h1>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <p className="text-red-600">Failed to load dashboard: {error}</p>
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
          <h1 className="text-3xl font-bold">CEO Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Path to 10K MRR by {data.goal.targetDate}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label className="text-sm">Auto-refresh</Label>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Goal Progress */}
      <GoalProgressCard goal={data.goal} />

      {/* Conversion Funnel */}
      <FunnelVisualization funnel={data.funnel} />

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <StripeMetricsCard stripe={data.stripe} />
        <ChurnAnalysisCard churn={data.churn} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <EmailEffectivenessCard emails={data.emails} />
        <TrafficSourcesCard traffic={data.traffic} />
      </div>

      {/* SEO & UX */}
      <div className="grid gap-6 md:grid-cols-2">
        <GSCCard gsc={data.gsc} />
        <UXIssuesCard uxIssues={data.uxIssues} />
      </div>

      {/* Alerts */}
      <AlertsCard alerts={data.alerts} />

      {/* Timestamp */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
