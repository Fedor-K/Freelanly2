'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Building2, Users, TrendingUp, Clock, CheckCircle, XCircle, DollarSign, Bell, Crown, UserPlus } from 'lucide-react';
import Link from 'next/link';

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
  href,
  className,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  href?: string;
  className?: string;
}) {
  const content = (
    <Card className={href ? 'hover:border-primary/50 transition-colors cursor-pointer' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${className || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && trend.value > 0 && (
          <div className="flex items-center text-xs text-green-600 mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            +{trend.value} {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
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

      {/* Revenue Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Est. MRR"
            value={`€${stats.revenue.estimatedMRR}`}
            description="Monthly recurring revenue"
            icon={DollarSign}
            className="text-green-600"
          />
          <StatCard
            title="Est. ARR"
            value={`€${stats.revenue.estimatedARR}`}
            description="Annual recurring revenue"
            icon={TrendingUp}
            className="text-green-600"
          />
          <StatCard
            title="Active Subscriptions"
            value={stats.revenue.activeSubscriptions}
            description="Paying customers"
            icon={Crown}
            className="text-yellow-500"
          />
          <StatCard
            title="Conversion Rate"
            value={`${stats.users.conversionRate}%`}
            description="FREE → PRO"
            icon={TrendingUp}
            className="text-blue-600"
          />
        </div>
      </div>

      {/* Users Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Users
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.users.total.toLocaleString()}
            description={`${stats.users.pro} PRO · ${stats.users.free} FREE`}
            icon={Users}
            href="/admin/users"
            trend={stats.users.newThisWeek > 0 ? { value: stats.users.newThisWeek, label: 'this week' } : undefined}
          />
          <StatCard
            title="PRO Users"
            value={stats.users.pro}
            description="Paying users"
            icon={Crown}
            href="/admin/users?plan=PRO"
            className="text-yellow-500"
          />
          <StatCard
            title="New This Week"
            value={stats.users.newThisWeek}
            description={`${stats.users.newThisMonth} this month`}
            icon={UserPlus}
          />
          <StatCard
            title="Job Alerts"
            value={stats.alerts.active.toLocaleString()}
            description={`${stats.alerts.total} total`}
            icon={Bell}
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Content
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
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
            title="This Week"
            value={stats.jobs.thisWeek.toLocaleString()}
            description="new jobs added"
            icon={TrendingUp}
          />
          <StatCard
            title="Today"
            value={stats.jobs.today}
            description="jobs imported"
            icon={Clock}
          />
        </div>
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
        <CardContent className="flex flex-wrap gap-4">
          <Link
            href="/admin/users"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Manage Users
          </Link>
          <Link
            href="/admin/analytics"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90"
          >
            View Analytics
          </Link>
          <Link
            href="/admin/sources"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90"
          >
            Manage Sources
          </Link>
          <Link
            href="/admin/logs"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90"
          >
            View Logs
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
