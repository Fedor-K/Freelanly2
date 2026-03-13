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

interface DashboardData {
  hotLeads: HotLead[];
  channels: Channel[];
  buyerProfile: BuyerProfile;
  quick: QuickMetrics;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString();
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/management-dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(err => console.error('Failed to fetch dashboard:', err))
      .finally(() => setLoading(false));
  }, []);

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
                      <th className="pb-2 pr-4 text-right">Registered</th>
                      <th className="pb-2 pr-4 text-right">Hit Paywall</th>
                      <th className="pb-2 pr-4 text-right">Bought PRO</th>
                      <th className="pb-2 text-right">Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map(ch => (
                      <tr key={ch.source} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{ch.source}</td>
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
