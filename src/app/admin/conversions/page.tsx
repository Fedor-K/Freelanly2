'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  CreditCard,
  RefreshCw,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface ConversionStats {
  week: {
    total: number;
    completed: number;
    expired: number;
    open: number;
    conversionRate: number;
    byPrice: Record<string, { total: number; completed: number }>;
  };
  month: {
    total: number;
    completed: number;
    expired: number;
    open: number;
    conversionRate: number;
    byPrice: Record<string, { total: number; completed: number }>;
  };
  recentSessions: Array<{
    id: string;
    date: string;
    email: string;
    status: string;
    amount: string;
    priceKey: string;
  }>;
  users: {
    pro: number;
    free: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  revenue: {
    started: number;
    churned: number;
    net: number;
  };
  funnel: {
    visitorsToCheckout: string;
    checkoutToComplete: string;
    registeredThisMonth: number;
    registeredThisWeek: number;
  };
  revenueEvents: Array<{
    date: string;
    type: string;
    amount: number;
    currency: string;
  }>;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color = 'text-muted-foreground',
  trend,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  color?: string;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <div className={`flex items-center text-xs mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  label,
  value,
  subtext,
  isLast,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center">
      <div className="flex-1 text-center p-4 bg-gray-50 rounded-lg">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </div>
      {!isLast && <ArrowRight className="h-5 w-5 mx-2 text-muted-foreground" />}
    </div>
  );
}

export default function ConversionsDashboard() {
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/conversion-stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Conversion Analytics</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading Stripe data...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Conversion Analytics</h1>
        <div className="p-4 bg-red-50 text-red-800 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
          <button onClick={fetchStats} className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Conversion Analytics</h1>
          <p className="text-muted-foreground">Trial enabled for Monthly plan</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard
          title="Checkout Sessions (7d)"
          value={stats.week.total}
          description={`${stats.week.completed} completed`}
          icon={ShoppingCart}
          color="text-blue-600"
        />
        <StatCard
          title="Conversion Rate (7d)"
          value={`${stats.week.conversionRate}%`}
          description="Checkout → Payment"
          icon={stats.week.conversionRate >= 20 ? TrendingUp : TrendingDown}
          color={stats.week.conversionRate >= 20 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard
          title="New Subscribers (30d)"
          value={stats.revenue.started}
          description={`${stats.revenue.churned} churned`}
          icon={CreditCard}
          color="text-green-600"
        />
        <StatCard
          title="Net Subscribers"
          value={stats.revenue.net >= 0 ? `+${stats.revenue.net}` : stats.revenue.net}
          description="Started - Churned"
          icon={stats.revenue.net >= 0 ? TrendingUp : TrendingDown}
          color={stats.revenue.net >= 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Funnel Visualization */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Conversion Funnel (30 days)</CardTitle>
          <CardDescription>From registration to payment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <FunnelStep
              label="Registrations"
              value={stats.users.newThisMonth}
              subtext={`${stats.users.newThisWeek} this week`}
            />
            <FunnelStep
              label="Started Checkout"
              value={stats.month.total}
              subtext="Reached Stripe"
            />
            <FunnelStep
              label="Completed"
              value={stats.month.completed}
              subtext={`${stats.month.conversionRate}% rate`}
            />
            <FunnelStep
              label="Active PRO"
              value={stats.users.pro}
              subtext="Currently paying"
              isLast
            />
          </div>
        </CardContent>
      </Card>

      {/* Checkout by Plan */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>By Plan (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.month.byPrice).map(([plan, data]) => {
                const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return (
                  <div key={plan} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{plan}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.completed}/{data.total} completed
                      </p>
                    </div>
                    <div className={`text-lg font-bold ${rate >= 20 ? 'text-green-600' : rate > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {rate}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Revenue Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.revenueEvents.length === 0 ? (
                <p className="text-muted-foreground">No events yet</p>
              ) : (
                stats.revenueEvents.map((event, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {event.type === 'SUBSCRIPTION_STARTED' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{event.type.replace('SUBSCRIPTION_', '')}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Checkout Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Checkout Sessions</CardTitle>
          <CardDescription>Last 20 sessions from Stripe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">Plan</th>
                  <th className="text-left py-2 px-2">Amount</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSessions.map((session) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="py-2 px-2 text-muted-foreground">
                      {new Date(session.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2 truncate max-w-[200px]">{session.email}</td>
                    <td className="py-2 px-2 capitalize">{session.priceKey}</td>
                    <td className="py-2 px-2">{session.amount}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          session.status === 'complete'
                            ? 'bg-green-100 text-green-700'
                            : session.status === 'open'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {session.status === 'complete' && <CheckCircle className="h-3 w-3" />}
                        {session.status === 'open' && <Clock className="h-3 w-3" />}
                        {session.status === 'expired' && <XCircle className="h-3 w-3" />}
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
