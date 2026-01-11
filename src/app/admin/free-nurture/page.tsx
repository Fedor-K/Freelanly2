'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  UserPlus,
  TrendingUp,
  Clock,
  MousePointerClick,
  Bell,
  RefreshCw,
  Loader2,
  ArrowRight,
  Zap,
  AlertTriangle,
  UserCheck,
  UserX,
  Mail,
} from 'lucide-react';

interface FreeNurtureStats {
  summary: {
    totalFreeUsers: number;
    freeUsers7d: number;
    freeUsers30d: number;
    freeUsersWithAttempts: number;
    convertedToPro30d: number;
    conversionRate: number;
    avgDaysToConvert: number;
    totalApplyAttempts: number;
  };
  funnel: {
    registered7d: number;
    registered30d: number;
    triedToApply: number;
    convertedToPro: number;
  };
  emailFunnel: {
    sentWelcome: number;
    sentDay3: number;
    sentDay7: number;
  };
  statusCounts: {
    new: number;
    active: number;
    interested: number;
    highIntent: number;
    lapsed: number;
  };
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    emailVerified: string | null;
    lastActiveAt: string | null;
    applyAttempts: number;
    alertsSetup: number;
    emailsSent: number;
    daysSinceRegistration: number;
    daysSinceActive: number;
    status: 'new' | 'active' | 'interested' | 'high-intent' | 'lapsed';
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
  const config: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    new: { bg: 'bg-blue-100', text: 'text-blue-700', icon: UserPlus, label: 'New' },
    active: { bg: 'bg-green-100', text: 'text-green-700', icon: UserCheck, label: 'Active' },
    interested: { bg: 'bg-purple-100', text: 'text-purple-700', icon: MousePointerClick, label: 'Interested' },
    'high-intent': { bg: 'bg-orange-100', text: 'text-orange-700', icon: Zap, label: 'High Intent' },
    lapsed: { bg: 'bg-gray-100', text: 'text-gray-700', icon: UserX, label: 'Lapsed' },
  };

  const { bg, text, icon: Icon, label } = config[status] || config.active;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export default function FreeNurtureDashboard() {
  const [stats, setStats] = useState<FreeNurtureStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'active' | 'interested' | 'high-intent' | 'lapsed'>('all');

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/free-nurture-stats');
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
        <h1 className="text-3xl font-bold mb-8">FREE User Nurturing</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading nurture data...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">FREE User Nurturing</h1>
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">FREE User Nurturing</h1>
          <p className="text-muted-foreground">
            Convert FREE users to PRO subscribers
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
          title="FREE Users (30d)"
          value={stats.summary.freeUsers30d}
          description={`${stats.summary.freeUsers7d} this week`}
          icon={Users}
          color="text-blue-600"
        />
        <StatCard
          title="Tried to Apply"
          value={stats.summary.freeUsersWithAttempts}
          description={`${stats.summary.totalApplyAttempts} total attempts`}
          icon={MousePointerClick}
          color="text-purple-600"
        />
        <StatCard
          title="Converted to PRO"
          value={stats.summary.convertedToPro30d}
          description={`${stats.summary.conversionRate}% conversion rate`}
          icon={TrendingUp}
          color="text-green-600"
        />
        <StatCard
          title="Avg Days to Convert"
          value={stats.summary.avgDaysToConvert || 'N/A'}
          description="From registration to PRO"
          icon={Clock}
          color="text-orange-600"
        />
      </div>

      {/* Funnel Visualization */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Conversion Funnel (30 days)</CardTitle>
          <CardDescription>From registration to PRO subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto">
            <FunnelStep
              label="Registered"
              value={stats.funnel.registered30d}
            />
            <FunnelStep
              label="Tried to Apply"
              value={stats.funnel.triedToApply}
              subtext={stats.funnel.registered30d > 0 ? `${Math.round((stats.funnel.triedToApply / stats.funnel.registered30d) * 100)}%` : '0%'}
            />
            <FunnelStep
              label="Converted to PRO"
              value={stats.funnel.convertedToPro}
              subtext={`${stats.summary.conversionRate}% rate`}
              isLast
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Funnel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Email Sequence (30 days)</CardTitle>
          <CardDescription>Drip emails sent to FREE users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto">
            <FunnelStep
              label="Registered"
              value={stats.funnel.registered30d}
            />
            <FunnelStep
              label="Welcome (Day 1)"
              value={stats.emailFunnel.sentWelcome}
              subtext={stats.funnel.registered30d > 0 ? `${Math.round((stats.emailFunnel.sentWelcome / stats.funnel.registered30d) * 100)}%` : '0%'}
            />
            <FunnelStep
              label="Reminder (Day 3)"
              value={stats.emailFunnel.sentDay3}
              subtext={stats.emailFunnel.sentWelcome > 0 ? `${Math.round((stats.emailFunnel.sentDay3 / stats.emailFunnel.sentWelcome) * 100)}%` : '0%'}
            />
            <FunnelStep
              label="Trial Push (Day 7)"
              value={stats.emailFunnel.sentDay7}
              subtext={stats.emailFunnel.sentDay3 > 0 ? `${Math.round((stats.emailFunnel.sentDay7 / stats.emailFunnel.sentDay3) * 100)}%` : '0%'}
              isLast
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Segments */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'all' ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold">{stats.users.length}</p>
          <p className="text-sm text-muted-foreground">All Users</p>
        </button>
        <button
          onClick={() => setFilter('new')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'new' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold text-blue-600">{stats.statusCounts.new}</p>
          <p className="text-sm text-muted-foreground">New (&lt;3 days)</p>
        </button>
        <button
          onClick={() => setFilter('interested')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'interested' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold text-purple-600">{stats.statusCounts.interested}</p>
          <p className="text-sm text-muted-foreground">Interested (1-2 attempts)</p>
        </button>
        <button
          onClick={() => setFilter('high-intent')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'high-intent' ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold text-orange-600">{stats.statusCounts.highIntent}</p>
          <p className="text-sm text-muted-foreground">High Intent (3+ attempts)</p>
        </button>
        <button
          onClick={() => setFilter('lapsed')}
          className={`p-4 rounded-lg border text-left transition-colors ${filter === 'lapsed' ? 'border-gray-500 bg-gray-50' : 'hover:bg-gray-50'}`}
        >
          <p className="text-2xl font-bold text-gray-600">{stats.statusCounts.lapsed}</p>
          <p className="text-sm text-muted-foreground">Lapsed (14+ days)</p>
        </button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent FREE Users (30 days)</CardTitle>
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
                  <th className="text-left py-2 px-2">Registered</th>
                  <th className="text-left py-2 px-2">Days</th>
                  <th className="text-left py-2 px-2">Emails</th>
                  <th className="text-left py-2 px-2">Apply Attempts</th>
                  <th className="text-left py-2 px-2">Alerts</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
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
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-2">
                        <span className={user.daysSinceRegistration >= 14 && user.status !== 'interested' && user.status !== 'high-intent' ? 'text-gray-400' : ''}>
                          {user.daysSinceRegistration}d
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className={user.emailsSent >= 3 ? 'text-green-600' : user.emailsSent > 0 ? 'text-blue-600' : 'text-muted-foreground'}>
                            {user.emailsSent}/3
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`font-medium ${user.applyAttempts >= 3 ? 'text-orange-600' : user.applyAttempts > 0 ? 'text-purple-600' : 'text-muted-foreground'}`}>
                          {user.applyAttempts}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Bell className="h-3 w-3 text-muted-foreground" />
                          <span>{user.alertsSetup}</span>
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
