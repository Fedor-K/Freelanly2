'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Building2, Users, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';

interface DashboardStats {
  jobs: {
    total: number;
    today: number;
    thisWeek: number;
    active: number;
  };
  companies: {
    total: number;
    verified: number;
  };
  subscribers: {
    total: number;
    active: number;
  };
  imports: {
    total: number;
    lastRun: string | null;
    lastStatus: string | null;
    lastCreated: number;
    lastSkipped: number;
    lastFailed: number;
  };
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center text-xs text-green-600 mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            +{trend.value} {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
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
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <p className="text-muted-foreground">Loading statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <p className="text-red-500">Failed to load statistics</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Jobs"
          value={stats.jobs.total.toLocaleString()}
          description={`${stats.jobs.active.toLocaleString()} active`}
          icon={Briefcase}
          trend={stats.jobs.today > 0 ? { value: stats.jobs.today, label: 'today' } : undefined}
        />
        <StatCard
          title="Companies"
          value={stats.companies.total.toLocaleString()}
          description={`${stats.companies.verified} verified`}
          icon={Building2}
        />
        <StatCard
          title="Subscribers"
          value={stats.subscribers.total.toLocaleString()}
          description={`${stats.subscribers.active} active`}
          icon={Users}
        />
        <StatCard
          title="This Week"
          value={stats.jobs.thisWeek.toLocaleString()}
          description="new jobs added"
          icon={TrendingUp}
        />
      </div>

      {/* Import Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Last Import</CardTitle>
          <CardDescription>Status of the most recent data import</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.imports.lastRun ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {stats.imports.lastStatus === 'COMPLETED' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : stats.imports.lastStatus === 'FAILED' ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium">{stats.imports.lastStatus}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(stats.imports.lastRun).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.imports.lastCreated}</p>
                  <p className="text-xs text-green-600">Created</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{stats.imports.lastSkipped}</p>
                  <p className="text-xs text-yellow-600">Skipped</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.imports.lastFailed}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No imports yet</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <a
            href="/admin/sources/apify"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Configure Apify
          </a>
          <a
            href="/admin/logs"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90"
          >
            View Logs
          </a>
          <a
            href="/admin/subscribers"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90"
          >
            Manage Subscribers
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
