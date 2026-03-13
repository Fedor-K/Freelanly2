'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Crown, DollarSign, Users, TrendingUp, Target,
  BarChart3, UserCheck, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface HotLead {
  userId: string;
  email: string;
  paywallHits: number;
  lastHitDaysAgo: number;
  registeredDaysAgo: number;
  category: string | null;
  source: string | null;
}

interface Channel {
  source: string;
  visitors: number;
  registered: number;
  hitPaywall: number;
  converted: number;
  conversionRate: number;
}

interface BuyerProfile {
  avgPaywallHitsBeforeBuy: number;
  topCategories: Array<{ category: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
  avgDaysToConvert: number;
  medianDaysToConvert: number;
}

interface QuickMetrics {
  totalPro: number;
  newProLast30d: number;
  mrrEstimate: number;
  freeUsersWithPaywallHit: number;
  avgPaywallHitsPerFreeUser: number;
}

interface GoalRoadmapItem {
  month: string;
  action: string;
  targetPro: number;
  targetMRR: number;
}

interface GoalData {
  targetMRR: number;
  currentMRR: number;
  progressPercent: number;
  targetDate: string;
  daysRemaining: number;
  monthsRemaining: number;
  funnel: {
    periodLabel: string;
    visitors: number;
    registrations: number;
    newPro: number;
    regToProRate: number;
    visitorToRegRate: number | null;
    targetRegToProRate: number;
  };
  required: {
    newProPerMonth: number;
    currentNewProPerMonth: number;
    growthNeeded: number;
  };
  totalPro: number;
  roadmap: GoalRoadmapItem[];
}

interface TrafficRow {
  date: string;
  visits: number;
  visitors: number;
  registrations: number;
  newPro: number;
}

interface DashboardData {
  hotLeads: HotLead[];
  channels: Channel[];
  buyerProfile: BuyerProfile;
  quick: QuickMetrics;
  goal: GoalData;
  trafficChart: TrafficRow[];
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString();
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trafficPeriod, setTrafficPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [trafficData, setTrafficData] = useState<TrafficRow[]>([]);
  const [trafficLoading, setTrafficLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/management-dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json);
          setTrafficData(json.trafficChart || []);
        }
      })
      .catch(err => console.error('Failed to fetch dashboard:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data) return; // skip initial load
    setTrafficLoading(true);
    fetch(`/api/admin/management-dashboard?period=${trafficPeriod}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          // Update both chart AND funnel (goal.funnel is period-dependent)
          setTrafficData(json.trafficChart || []);
          setData(prev => prev ? {
            ...prev,
            channels: json.channels || prev.channels,
            goal: { ...prev.goal, funnel: json.goal?.funnel || prev.goal.funnel },
          } : prev);
        }
      })
      .catch(err => console.error('Failed to fetch traffic:', err))
      .finally(() => setTrafficLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trafficPeriod]);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Management Dashboard</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Management Dashboard</h1>
        <p className="text-red-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Management Dashboard</h1>

      {/* GOAL: €10k MRR */}
      {data.goal && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Goal: &euro;10k MRR by December 2026
          </h2>

          {/* Progress bar */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">&euro;{fmt(data.goal.currentMRR)}</span>
                <span className="text-sm text-muted-foreground">
                  {data.goal.monthsRemaining} months left &middot; need +{fmt(data.goal.required.newProPerMonth)} PRO/mo
                </span>
                <span className="text-2xl font-bold text-muted-foreground">&euro;{fmt(data.goal.targetMRR)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all"
                  style={{ width: `${Math.min(data.goal.progressPercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {data.goal.progressPercent}% &middot; {fmt(data.goal.totalPro)} PRO of 667 needed
              </p>
            </CardContent>
          </Card>

          {/* Funnel — horizontal flow with drop-off + period switcher */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Воронка конверсии</CardTitle>
                <div className="flex gap-1">
                  {(['day', 'week', 'month'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setTrafficPeriod(p)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${trafficPeriod === p ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-muted-foreground hover:border-purple-400'}`}
                    >
                      {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                {/* Step 1: Visitors */}
                <div className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Посетители</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {data.goal.funnel.visitors > 0 ? fmt(data.goal.funnel.visitors) : '—'}
                  </div>
                </div>

                {/* Arrow 1 */}
                <div className="text-center flex flex-col items-center px-1">
                  <div className={`font-bold text-sm ${data.goal.funnel.visitorToRegRate && data.goal.funnel.visitorToRegRate > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {data.goal.funnel.visitorToRegRate !== null ? `${data.goal.funnel.visitorToRegRate}%` : '—'}
                  </div>
                  <div className="text-xl text-muted-foreground">→</div>
                  <div className="text-red-500 text-xs">
                    {data.goal.funnel.visitors > 0 ? `-${fmt(data.goal.funnel.visitors - data.goal.funnel.registrations)}` : ''}
                  </div>
                </div>

                {/* Step 2: Registrations */}
                <div className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Регистраций</div>
                  <div className="text-2xl font-bold text-green-600">{fmt(data.goal.funnel.registrations)}</div>
                </div>

                {/* Arrow 2 */}
                <div className="text-center flex flex-col items-center px-1">
                  <div className={`font-bold text-sm ${data.goal.funnel.regToProRate < data.goal.funnel.targetRegToProRate ? 'text-red-500' : 'text-green-600'}`}>
                    {data.goal.funnel.regToProRate}%
                  </div>
                  <div className="text-xl text-muted-foreground">→</div>
                  <div className="text-red-500 text-xs">
                    -{fmt(data.goal.funnel.registrations - data.goal.funnel.newPro)}
                  </div>
                </div>

                {/* Step 3: New PRO */}
                <div className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Новых PRO</div>
                  <div className="text-2xl font-bold text-yellow-600">{fmt(data.goal.funnel.newPro)}</div>
                  <div className={`text-xs mt-1 ${data.goal.funnel.regToProRate < data.goal.funnel.targetRegToProRate ? 'text-red-500' : 'text-green-600'}`}>
                    цель: {data.goal.funnel.targetRegToProRate}%
                  </div>
                </div>
              </div>

              {/* Source breakdown inside funnel */}
              {data.channels && data.channels.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <div className="text-xs text-muted-foreground mb-2 font-medium">По источникам</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="pb-1 text-left font-normal">Источник</th>
                        <th className="pb-1 text-right font-normal">Посетители</th>
                        <th className="pb-1 text-right font-normal">→</th>
                        <th className="pb-1 text-right font-normal">Регистрации</th>
                        <th className="pb-1 text-right font-normal">→</th>
                        <th className="pb-1 text-right font-normal">PRO</th>
                        <th className="pb-1 text-right font-normal">Конверсия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.channels
                        .filter(ch => ch.registered > 0 || ch.visitors > 0)
                        .sort((a, b) => (b.visitors || 0) - (a.visitors || 0))
                        .map(ch => {
                          const v2r = ch.visitors > 0 ? ((ch.registered / ch.visitors) * 100).toFixed(1) : null;
                          const r2p = ch.registered > 0 ? ((ch.converted / ch.registered) * 100).toFixed(1) : null;
                          return (
                            <tr key={ch.source} className="border-b last:border-0">
                              <td className="py-1 font-medium capitalize">{ch.source || 'unknown'}</td>
                              <td className="py-1 text-right text-blue-600">{ch.visitors > 0 ? fmt(ch.visitors) : '—'}</td>
                              <td className="py-1 text-right text-muted-foreground text-xs">{v2r ? `${v2r}%` : ''}</td>
                              <td className="py-1 text-right text-green-600">{fmt(ch.registered)}</td>
                              <td className="py-1 text-right text-muted-foreground text-xs">{r2p ? `${r2p}%` : ''}</td>
                              <td className="py-1 text-right text-yellow-600 font-bold">{ch.converted > 0 ? ch.converted : '—'}</td>
                              <td className="py-1 text-right">
                                <span className={ch.conversionRate >= 5 ? 'text-green-600 font-bold' : 'text-muted-foreground'}>
                                  {ch.conversionRate > 0 ? `${ch.conversionRate}%` : '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roadmap table */}
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Month</th>
                      <th className="pb-2 pr-4">Focus</th>
                      <th className="pb-2 pr-4 text-right">Target PRO</th>
                      <th className="pb-2 pr-4 text-right">Target MRR</th>
                      <th className="pb-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.goal.roadmap.map(item => (
                      <tr key={item.month} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{item.month}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{item.action}</td>
                        <td className="py-2 pr-4 text-right">{fmt(item.targetPro)}</td>
                        <td className="py-2 pr-4 text-right">&euro;{fmt(item.targetMRR)}</td>
                        <td className="py-2 text-center">
                          {data.goal.totalPro >= item.targetPro ? (
                            <span className="text-green-600 font-bold">DONE</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BLOCK: Traffic Dynamics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          Dynamics
        </h2>

        <div className="flex gap-1 mb-3">
          {(['day', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setTrafficPeriod(p)}
              className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
                trafficPeriod === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {p === 'day' ? 'Day' : p === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {trafficLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : trafficData.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data available</p>
            ) : (() => {
              const displayRows = trafficPeriod === 'day'
                ? trafficData.slice(-14)
                : trafficPeriod === 'week'
                  ? trafficData.slice(-8)
                  : trafficData.slice(-6);
              const maxVisits = Math.max(...displayRows.map(r => r.visits));

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Period</th>
                        <th className="pb-2 pr-4 text-right">Visits</th>
                        <th className="pb-2 pr-4 text-right">Visitors</th>
                        <th className="pb-2 pr-4 text-right">Registrations</th>
                        <th className="pb-2 text-right">New PRO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map(row => (
                        <tr
                          key={row.date}
                          className={`border-b last:border-0 ${
                            row.visits === maxVisits && maxVisits > 0 ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''
                          }`}
                        >
                          <td className="py-2 pr-4 font-medium">{row.date}</td>
                          <td className="py-2 pr-4 text-right">{fmt(row.visits)}</td>
                          <td className="py-2 pr-4 text-right">{fmt(row.visitors)}</td>
                          <td className="py-2 pr-4 text-right">
                            {row.registrations > 0 ? (
                              <span className="text-green-600 font-medium">{fmt(row.registrations)}</span>
                            ) : '-'}
                          </td>
                          <td className="py-2 text-right">
                            {row.newPro > 0 ? (
                              <span className="text-yellow-600 font-bold">{fmt(row.newPro)}</span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* BLOCK 4: Quick Metrics */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total PRO</CardTitle>
            <Crown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(data.quick.totalPro)}</div>
            <p className="text-xs text-muted-foreground mt-1">+{fmt(data.quick.newProLast30d)} last 30d</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR (est.)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">&euro;{fmt(data.quick.mrrEstimate)}</div>
            <p className="text-xs text-muted-foreground mt-1">{fmt(data.quick.totalPro)} &times; &euro;18/mo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New PRO (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(data.quick.newProLast30d)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">FREE at Paywall</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(data.quick.freeUsersWithPaywallHit)}</div>
            <p className="text-xs text-muted-foreground mt-1">avg {data.quick.avgPaywallHitsPerFreeUser} clicks each</p>
          </CardContent>
        </Card>
      </div>

      {/* BLOCK 1: Hot Leads */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-orange-500" />
          Hot Leads
          {data.hotLeads.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              &mdash; {data.hotLeads.length} users stuck at paywall
            </span>
          )}
        </h2>
        <Card>
          <CardContent className="pt-6">
            {data.hotLeads.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hot leads yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4 text-center">Paywall Clicks</th>
                      <th className="pb-2 pr-4 text-center">Last Click</th>
                      <th className="pb-2 pr-4">Category</th>
                      <th className="pb-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hotLeads.map(lead => (
                      <tr key={lead.userId} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{lead.email}</td>
                        <td className="py-2 pr-4 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            {lead.paywallHits}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-center text-muted-foreground">
                          {lead.lastHitDaysAgo === 0 ? 'today' : `${lead.lastHitDaysAgo}d ago`}
                        </td>
                        <td className="py-2 pr-4">{lead.category || '-'}</td>
                        <td className="py-2">{lead.source || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BLOCK 2: Channel Effectiveness */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          Channel Effectiveness
        </h2>
        <Card>
          <CardContent className="pt-6">
            {data.channels.length === 0 ? (
              <p className="text-muted-foreground text-sm">No channel data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Channel</th>
                      <th className="pb-2 pr-4 text-right">Visitors</th>
                      <th className="pb-2 pr-4 text-right">Registered</th>
                      <th className="pb-2 pr-4 text-right">Hit Paywall</th>
                      <th className="pb-2 pr-4 text-right">Bought PRO</th>
                      <th className="pb-2 text-right">Conv reg→PRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map(ch => (
                      <tr key={ch.source} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{ch.source}</td>
                        <td className="py-2 pr-4 text-right">{ch.visitors > 0 ? fmt(ch.visitors) : '-'}</td>
                        <td className="py-2 pr-4 text-right">{fmt(ch.registered)}</td>
                        <td className="py-2 pr-4 text-right">{fmt(ch.hitPaywall)}</td>
                        <td className="py-2 pr-4 text-right">{fmt(ch.converted)}</td>
                        <td className="py-2 text-right">
                          <span className={`font-bold ${ch.conversionRate >= 10 ? 'text-green-600' : ch.conversionRate >= 5 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                            {ch.conversionRate > 0 ? `${ch.conversionRate}%` : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BLOCK 3: Buyer Profile */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-green-600" />
          Buyer Profile
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Clicks Before Buy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.buyerProfile.avgPaywallHitsBeforeBuy || '-'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">paywall hits before PRO</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Convert</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.buyerProfile.avgDaysToConvert || '-'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                median: {data.buyerProfile.medianDaysToConvert || '-'} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Categories (PRO)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.buyerProfile.topCategories.length === 0 ? (
                <p className="text-muted-foreground text-sm">-</p>
              ) : (
                <ul className="space-y-1">
                  {data.buyerProfile.topCategories.map(c => (
                    <li key={c.category} className="flex justify-between text-sm">
                      <span>{c.category}</span>
                      <span className="font-medium">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Sources (PRO)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.buyerProfile.topSources.length === 0 ? (
                <p className="text-muted-foreground text-sm">-</p>
              ) : (
                <ul className="space-y-1">
                  {data.buyerProfile.topSources.map(s => (
                    <li key={s.source} className="flex justify-between text-sm">
                      <span>{s.source}</span>
                      <span className="font-medium">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Pages</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {[
            { href: '/admin/users', label: 'Users', color: 'bg-primary text-primary-foreground hover:bg-primary/90' },
            { href: '/admin/conversions', label: 'Conversions', color: 'bg-green-600 text-white hover:bg-green-700' },
            { href: '/admin/email-stats', label: 'Email Stats', color: 'bg-blue-600 text-white hover:bg-blue-700' },
            { href: '/admin/analytics', label: 'Analytics', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/cancellations', label: 'Cancellations', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/sources', label: 'Sources', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/jobs', label: 'Jobs', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/logs', label: 'Logs', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/activation', label: 'Activation', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/free-nurture', label: 'Free Nurture', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/clarity', label: 'UX (Clarity)', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/keywords', label: 'Keywords', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/parsing', label: 'Parsing', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/google-ads', label: 'Google Ads', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${link.color}`}
            >
              {link.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
