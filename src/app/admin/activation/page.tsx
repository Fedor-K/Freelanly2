'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Mail,
  Zap,
  RefreshCw,
  Loader2,
  ArrowRight,
  XCircle,
} from 'lucide-react';

interface ActivationStats {
  summary: {
    pendingActivation: number;
    activated: number;
    atRisk: number;
    avgDaysToActivate: number;
    activationTarget: number;
    activationWindowDays: number;
  };
  funnel: {
    subscribed7d: number;
    subscribed30d: number;
    sentWelcome: number;
    sentDay1: number;
    sentDay2: number;
    sentDay3: number;
    activated30d: number;
  };
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    proStartedAt: string | null;
    activatedAt: string | null;
    applications: number;
    emailsSent: number;
    daysSinceStart: number;
    status: 'activated' | 'pending' | 'at-risk' | 'churned';
  }>;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color = 'text-muted-foreground',
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  color?: string;
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
      {!isLast && <ArrowRight className="h-5 w-5 mx-2 text-muted-foreground flex-shrink-0" />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    activated: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Activated' },
    pending: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Pending' },
    'at-risk': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle, label: 'At Risk' },
    churned: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Churned' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: status };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default function ActivationDashboard() {
  const [stats, setStats] = useState<ActivationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'activated' | 'pending' | 'at-risk' | 'churned'>('all');

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/activation-stats');
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
        <h1 className="text-3xl font-bold mb-8">User Activation</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading activation data...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">User Activation</h1>
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

  const filteredUsers = filter === 'all'
    ? stats.users
    : stats.users.filter((u) => u.status === filter);

  const activationRate = stats.funnel.subscribed30d > 0
    ? Math.round((stats.funnel.activated30d / stats.funnel.subscribed30d) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Activation</h1>
          <p className="text-muted-foreground">
            Target: {stats.summary.activationTarget} applications in {stats.summary.activationWindowDays} days
          </p>
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
          title="New PRO (7 days)"
          value={stats.funnel.subscribed7d}
          description="Started this week"
          icon={Users}
          color="text-blue-600"
        />
        <StatCard
          title="Activation Rate (30d)"
          value={`${activationRate}%`}
          description={`${stats.funnel.activated30d} of ${stats.funnel.subscribed30d} activated`}
          icon={activationRate >= 50 ? TrendingUp : TrendingDown}
          color={activationRate >= 50 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard
          title="Avg Days to Activate"
          value={stats.summary.avgDaysToActivate || 'N/A'}
          description="Time to first apply"
          icon={Clock}
          color="text-purple-600"
        />
        <StatCard
          title="At Risk"
          value={stats.summary.atRisk}
          description="Need attention now"
          icon={AlertTriangle}
          color="text-yellow-600"
        />
      </div>

      {/* Funnel Visualization */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Activation Funnel (30 days)</CardTitle>
          <CardDescription>From subscription to first application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto">
            <FunnelStep
              label="Subscribed"
              value={stats.funnel.subscribed30d}
            />
            <FunnelStep
              label="Welcome Email"
              value={stats.funnel.sentWelcome}
              subtext={stats.funnel.subscribed30d > 0 ? `${Math.round((stats.funnel.sentWelcome / stats.funnel.subscribed30d) * 100)}%` : '0%'}
            />
            <FunnelStep
              label="Day 1 Email"
              value={stats.funnel.sentDay1}
            />
            <FunnelStep
              label="Day 2 Email"
              value={stats.funnel.sentDay2}
            />
            <FunnelStep
              label="Day 3 Email"
              value={stats.funnel.sentDay3}
            />
            <FunnelStep
              label="Activated"
              value={stats.funnel.activated30d}
              subtext={`${activationRate}% rate`}
              isLast
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'all' ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold">{stats.users.length}</p>
          <p className="text-sm text-muted-foreground">All Users</p>
        </button>
        <button
          onClick={() => setFilter('activated')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'activated' ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold text-green-600">
            {stats.users.filter((u) => u.status === 'activated').length}
          </p>
          <p className="text-sm text-muted-foreground">Activated</p>
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'pending' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold text-blue-600">
            {stats.users.filter((u) => u.status === 'pending').length}
          </p>
          <p className="text-sm text-muted-foreground">Pending</p>
        </button>
        <button
          onClick={() => setFilter('at-risk')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'at-risk' ? 'border-yellow-500 bg-yellow-50' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold text-yellow-600">
            {stats.users.filter((u) => u.status === 'at-risk').length}
          </p>
          <p className="text-sm text-muted-foreground">At Risk</p>
        </button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent PRO Users (30 days)</CardTitle>
          <CardDescription>
            {filter === 'all' ? 'All users' : `Filtered: ${filter}`} - {filteredUsers.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">User</th>
                  <th className="text-left py-2 px-2">Subscribed</th>
                  <th className="text-left py-2 px-2">Days</th>
                  <th className="text-left py-2 px-2">Applications</th>
                  <th className="text-left py-2 px-2">Emails Sent</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-2 px-2">
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{user.email}</p>
                          {user.name && (
                            <p className="text-xs text-muted-foreground">{user.name}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {user.proStartedAt
                          ? new Date(user.proStartedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-2 px-2">
                        <span className={user.daysSinceStart >= 5 && user.status !== 'activated' ? 'text-yellow-600 font-medium' : ''}>
                          {user.daysSinceStart}d
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`font-medium ${user.applications >= stats.summary.activationTarget ? 'text-green-600' : user.applications > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                          {user.applications} / {stats.summary.activationTarget}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span>{user.emailsSent}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge status={user.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
