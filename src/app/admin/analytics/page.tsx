'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  TrendingUp,
  Users,
  DollarSign,
  Bell,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface Stats {
  jobs: {
    total: number;
    active: number;
    today: number;
    thisWeek: number;
  };
  companies: {
    total: number;
    verified: number;
  };
  alerts: {
    total: number;
    active: number;
  };
  users: {
    total: number;
    pro: number;
    free: number;
    withStripe: number;
    newThisWeek: number;
    newThisMonth: number;
    conversionRate: number;
  };
  revenue: {
    activeSubscriptions: number;
    estimatedMRR: number;
    estimatedARR: number;
  };
}

function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center text-sm mt-2 ${
                trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : trend === 'down' ? <ArrowDownRight className="h-4 w-4" /> : null}
                <span>{change > 0 ? '+' : ''}{change}</span>
                {changeLabel && <span className="ml-1 text-muted-foreground">{changeLabel}</span>}
              </div>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-full">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = Math.min((value / max) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>€{value}</span>
        <span>€{max}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Analytics</h1>
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Analytics</h1>
        <p className="text-red-500">Failed to load analytics</p>
      </div>
    );
  }

  // Calculate funnel metrics
  const alertsPerUser = stats.users.total > 0 ? (stats.alerts.total / stats.users.total).toFixed(1) : '0';
  const activeAlertRate = stats.alerts.total > 0 ? ((stats.alerts.active / stats.alerts.total) * 100).toFixed(1) : '0';

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Key metrics and performance indicators
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Revenue Overview */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue Overview
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Monthly Recurring Revenue"
            value={`€${stats.revenue.estimatedMRR}`}
            icon={DollarSign}
          />
          <MetricCard
            title="Annual Recurring Revenue"
            value={`€${stats.revenue.estimatedARR}`}
            icon={TrendingUp}
          />
          <MetricCard
            title="Active Subscriptions"
            value={stats.revenue.activeSubscriptions}
            icon={Users}
          />
        </div>

        {/* MRR Goal Progress */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              MRR Goal: €10,000
            </CardTitle>
            <CardDescription>Progress towards monthly recurring revenue target</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressBar
              value={stats.revenue.estimatedMRR}
              max={10000}
              label="Progress"
            />
          </CardContent>
        </Card>
      </div>

      {/* User Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Metrics
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Total Users"
            value={stats.users.total}
            change={stats.users.newThisWeek}
            changeLabel="this week"
            trend={stats.users.newThisWeek > 0 ? 'up' : 'neutral'}
            icon={Users}
          />
          <MetricCard
            title="PRO Users"
            value={stats.users.pro}
            icon={TrendingUp}
          />
          <MetricCard
            title="FREE Users"
            value={stats.users.free}
            icon={Users}
          />
          <MetricCard
            title="Conversion Rate"
            value={`${stats.users.conversionRate}%`}
            icon={Target}
          />
        </div>

        {/* User Funnel */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">User Funnel</CardTitle>
            <CardDescription>Conversion through the funnel stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Registered Users</p>
                    <p className="text-sm text-muted-foreground">All signed up users</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.users.total}</p>
              </div>

              <div className="ml-4 border-l-2 border-dashed border-muted h-6" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">With Job Alerts</p>
                    <p className="text-sm text-muted-foreground">{alertsPerUser} alerts per user avg</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.alerts.total}</p>
              </div>

              <div className="ml-4 border-l-2 border-dashed border-muted h-6" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">PRO Subscribers</p>
                    <p className="text-sm text-muted-foreground">{stats.users.conversionRate}% conversion</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.users.pro}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Engagement
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Alerts</span>
                  <span className="font-bold">{stats.alerts.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Alerts</span>
                  <span className="font-bold text-green-600">{stats.alerts.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Rate</span>
                  <span className="font-bold">{activeAlertRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Users (7d)</span>
                  <span className="font-bold">{stats.users.newThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Users (30d)</span>
                  <span className="font-bold">{stats.users.newThisMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With Stripe</span>
                  <span className="font-bold">{stats.users.withStripe}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs Today</span>
                  <span className="font-bold">{stats.jobs.today}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs This Week</span>
                  <span className="font-bold">{stats.jobs.thisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Jobs</span>
                  <span className="font-bold text-green-600">{stats.jobs.active}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Content Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Content Statistics</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-4xl font-bold">{stats.jobs.total.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-4xl font-bold">{stats.jobs.active.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">Active Jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-4xl font-bold">{stats.companies.total.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">Companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-4xl font-bold">{stats.companies.verified}</p>
              <p className="text-sm text-muted-foreground mt-1">Verified Companies</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
