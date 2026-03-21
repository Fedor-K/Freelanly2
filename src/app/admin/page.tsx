'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign, Users, TrendingUp, TrendingDown, UserPlus,
  Crown, RefreshCw, ArrowUpRight, ArrowDownRight, Mail,
  MessageCircle, Eye,
} from 'lucide-react';

interface CohortData {
  cohorts: Array<{
    month: string;
    total: number;
    retention: Record<number, number>;
  }>;
  activationFunnel: Array<{
    step: string;
    label: string;
    count: number;
    percent: number;
  }>;
}

interface DashboardData {
  mrr: number;
  proCount: number;
  proCountChange: number;
  signupsToday: number;
  signupsYesterday: number;
  signupsWeek: number;
  newProToday: number;
  newProYesterday: number;
  newProWeek: number;
  totalUsers: number;
  verifiedUsers: number;
  conversionRate: number;
  churnRate: number;
  churned30d: number;
  signupsBySource: Array<{ source: string; count: number }>;
  dailySignups: Array<{ day: string; count: number }>;
  funnelToday: Record<string, number>;
  emailsToday: number;
  emailOpensToday: number;
  chatToday: number;
  recentEvents: Array<{
    action: string;
    details: Record<string, unknown> | null;
    createdAt: string;
    country: string | null;
  }>;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  CHECKOUT_COMPLETE: { label: 'Оплатил', color: 'text-green-600' },
  SUBSCRIPTION_CANCELLED: { label: 'Отменил', color: 'text-red-600' },
  SIGNUP: { label: 'Зарегался', color: 'text-blue-600' },
  LOGIN: { label: 'Вошёл', color: 'text-gray-500' },
};

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
  if (current < previous) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  return null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cohortData, setCohortData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, cohortRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/cohorts'),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (cohortRes.ok) setCohortData(await cohortRes.json());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading && !data) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6">Failed to load dashboard</div>;

  const maxSignup = Math.max(...data.dailySignups.map(d => d.count), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* TIER 1: Big Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* MRR */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <DollarSign className="h-5 w-5 text-green-600" />
              <Badge variant="outline" className="text-green-600 text-[10px]">MRR</Badge>
            </div>
            <div className="text-3xl font-bold mt-2 text-green-900">€{data.mrr}</div>
            <div className="text-xs text-green-600 mt-1">
              {data.proCount} subscribers
            </div>
          </CardContent>
        </Card>

        {/* PRO Count */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Crown className="h-5 w-5 text-amber-500" />
              <div className="flex items-center gap-1">
                {data.proCountChange !== 0 && (
                  <span className={`text-xs font-medium ${data.proCountChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.proCountChange > 0 ? '+' : ''}{data.proCountChange}
                  </span>
                )}
              </div>
            </div>
            <div className="text-3xl font-bold mt-2">{data.proCount}</div>
            <div className="text-xs text-muted-foreground mt-1">PRO subscribers</div>
          </CardContent>
        </Card>

        {/* Signups Today */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <UserPlus className="h-5 w-5 text-blue-500" />
              <TrendArrow current={data.signupsToday} previous={data.signupsYesterday} />
            </div>
            <div className="text-3xl font-bold mt-2">{data.signupsToday}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Signups today <span className="text-muted-foreground/60">(yesterday: {data.signupsYesterday})</span>
            </div>
          </CardContent>
        </Card>

        {/* New PRO Today */}
        <Card className={data.newProToday > 0 ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <TrendArrow current={data.newProToday} previous={data.newProYesterday} />
            </div>
            <div className="text-3xl font-bold mt-2">{data.newProToday}</div>
            <div className="text-xs text-muted-foreground mt-1">
              New PRO today <span className="text-muted-foreground/60">(week: {data.newProWeek})</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TIER 2: Health Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Conversion FREE→PRO</div>
            <div className={`text-2xl font-bold mt-1 ${data.conversionRate < 2 ? 'text-red-600' : data.conversionRate < 5 ? 'text-amber-600' : 'text-green-600'}`}>
              {data.conversionRate}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Benchmark: 2.6-5%</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Churn Rate (30d)</div>
            <div className={`text-2xl font-bold mt-1 ${data.churnRate > 8 ? 'text-red-600' : data.churnRate > 5 ? 'text-amber-600' : 'text-green-600'}`}>
              {data.churnRate}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{data.churned30d} cancelled</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Users</div>
            <div className="text-2xl font-bold mt-1">{data.totalUsers.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{data.verifiedUsers.toLocaleString()} verified</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Week Signups</div>
            <div className="text-2xl font-bold mt-1">{data.signupsWeek}</div>
            <div className="text-[10px] text-muted-foreground mt-1">~{Math.round(data.signupsWeek / 7)}/day avg</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Signups Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signups (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {data.dailySignups.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full bg-blue-500 rounded-t min-h-[2px]"
                    style={{ height: `${(d.count / maxSignup) * 100}%` }}
                    title={`${new Date(d.day).toLocaleDateString('ru-RU')}: ${d.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
              <span>{data.dailySignups[0] ? new Date(data.dailySignups[0].day).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''}</span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>

        {/* Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Sources (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.signupsBySource.map((s) => {
                const maxCount = data.signupsBySource[0]?.count || 1;
                return (
                  <div key={s.source} className="flex items-center gap-2">
                    <span className="text-xs w-20 truncate text-muted-foreground">{s.source}</span>
                    <div className="flex-1 bg-muted rounded h-5 overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded flex items-center justify-end pr-1"
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      >
                        <span className="text-[10px] text-white font-medium">{s.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Today's Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Eye className="h-4 w-4" /> Funnel Today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {[
              { key: 'PAGE_VIEW', label: 'Visitors' },
              { key: 'JOB_VIEW', label: 'Job Views' },
              { key: 'PAYWALL_HIT', label: 'Paywall' },
              { key: 'PRICING_VIEW', label: 'Pricing' },
              { key: 'CHECKOUT_START', label: 'Checkout' },
              { key: 'CHECKOUT_COMPLETE', label: 'Paid' },
            ].map(step => {
              const count = (data.funnelToday[step.key] || 0) + (step.key === 'JOB_VIEW' ? (data.funnelToday['OPPORTUNITY_VIEW'] || 0) : 0);
              return (
                <div key={step.key} className="flex justify-between">
                  <span className="text-muted-foreground">{step.label}</span>
                  <span className="font-medium">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Mail className="h-4 w-4" /> Activity Today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emails sent</span>
              <span className="font-medium">{data.emailsToday.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email opens</span>
              <span className="font-medium">{data.emailOpensToday.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open rate</span>
              <span className="font-medium">{data.emailsToday > 0 ? Math.round(data.emailOpensToday / data.emailsToday * 100) : 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chat messages</span>
              <span className="font-medium">{data.chatToday}</span>
            </div>
          </CardContent>
        </Card>

        {/* Live Feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <MessageCircle className="h-4 w-4" /> Live Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data.recentEvents.filter(e => e.action !== 'LOGIN').slice(0, 10).map((event, i) => {
                const info = EVENT_LABELS[event.action] || { label: event.action, color: 'text-gray-500' };
                const email = (event.details as Record<string, string>)?.email || '';
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-10 shrink-0">
                      {new Date(event.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`font-medium shrink-0 ${info.color}`}>{info.label}</span>
                    <span className="truncate text-muted-foreground">{email}</span>
                    {event.country && <span className="text-[10px] shrink-0">{event.country}</span>}
                  </div>
                );
              })}
              {data.recentEvents.filter(e => e.action !== 'LOGIN').length === 0 && (
                <p className="text-xs text-muted-foreground">No events yet today</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* ACTIVATION FUNNEL */}
      {cohortData?.activationFunnel && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activation Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2" style={{ height: 200 }}>
              {cohortData.activationFunnel.map((step) => {
                const maxCount = cohortData.activationFunnel[0]?.count || 1;
                const barHeight = Math.max((step.count / maxCount) * 100, 3);
                return (
                  <div key={step.step} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div className="text-center mb-1">
                      <div className="text-xs font-bold">{step.percent}%</div>
                      <div className="text-[10px] text-muted-foreground">{step.count.toLocaleString()}</div>
                    </div>
                    <div
                      className="w-full bg-black rounded-t min-h-[3px]"
                      style={{ height: `${barHeight}%` }}
                    />
                    <div className="text-[9px] text-muted-foreground mt-1 text-center leading-tight h-8">
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* COHORT RETENTION TABLE */}
      {cohortData?.cohorts && cohortData.cohorts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cohort Retention (Monthly)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 px-2 font-medium">Cohort</th>
                  <th className="text-right py-1 px-2 font-medium">Users</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="text-center py-1 px-1 font-medium">M{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortData.cohorts.map((cohort) => (
                  <tr key={cohort.month} className="border-t">
                    <td className="py-1 px-2 font-medium whitespace-nowrap">
                      {new Date(cohort.month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-1 px-2 text-right text-muted-foreground">
                      {cohort.total.toLocaleString()}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const pct = cohort.retention[i];
                      if (pct === undefined) return <td key={i} className="py-1 px-1 text-center text-muted-foreground/30">—</td>;
                      const bg = pct >= 50 ? 'bg-green-200 text-green-900 font-bold'
                        : pct >= 40 ? 'bg-green-100 text-green-800'
                        : pct >= 30 ? 'bg-gray-200 text-gray-800'
                        : 'bg-gray-100 text-gray-600';
                      return (
                        <td key={i} className={`py-1 px-1 text-center rounded ${bg}`}>
                          {pct}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
