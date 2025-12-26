'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  RefreshCw,
  Users,
  Crown,
  ChevronDown,
  ChevronUp,
  Bell,
  Mail,
  ExternalLink,
  TrendingUp,
  UserPlus,
  Activity,
} from 'lucide-react';

interface JobAlert {
  id: string;
  category: string | null;
  keywords: string | null;
  frequency: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    notifications: number;
  };
}

interface UserStats {
  lastLoginAt: string | null;
  activeSessions: number;
  activeAlerts: number;
  totalAlerts: number;
  totalNotificationsSent: number;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  stripeId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  _count: {
    jobAlerts: number;
  };
  jobAlerts: JobAlert[];
  stats: UserStats;
}

interface OverallStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  conversionRate: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setOverallStats(data.overallStats);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function togglePlan(userId: string, currentPlan: string) {
    const newPlan = currentPlan === 'PRO' ? 'FREE' : 'PRO';
    setUpdating(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });

      if (res.ok) {
        setUsers(users.map(u =>
          u.id === userId ? { ...u, plan: newPlan as 'FREE' | 'PRO' } : u
        ));
      }
    } catch (error) {
      console.error('Failed to update plan:', error);
    } finally {
      setUpdating(null);
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStripeUrl = (stripeId: string) => {
    return `https://dashboard.stripe.com/customers/${stripeId}`;
  };

  const toggleExpand = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            {overallStats?.totalUsers || 0} total users · {overallStats?.proUsers || 0} PRO · {overallStats?.freeUsers || 0} FREE
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overall Stats Cards */}
      {overallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.conversionRate}%</p>
                  <p className="text-xs text-muted-foreground">Conversion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.activeUsersLast7Days}</p>
                  <p className="text-xs text-muted-foreground">Active (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.activeUsersLast30Days}</p>
                  <p className="text-xs text-muted-foreground">Active (30d)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <UserPlus className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.newUsersLast7Days}</p>
                  <p className="text-xs text-muted-foreground">New (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading users...</p>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No users yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="overflow-hidden">
              <CardContent className="py-4">
                {/* Main row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {user.plan === 'PRO' || user.plan === 'ENTERPRISE' ? (
                        <Crown className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Users className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{user.email}</span>
                        <Badge variant={user.plan === 'PRO' ? 'default' : 'secondary'}>
                          {user.plan}
                        </Badge>
                        {user.stripeId && (
                          <a
                            href={getStripeUrl(user.stripeId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center"
                          >
                            <Badge variant="outline" className="text-xs hover:bg-gray-100 cursor-pointer">
                              Stripe <ExternalLink className="h-3 w-3 ml-1" />
                            </Badge>
                          </a>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                        <span>{user.name || 'No name'}</span>
                        <span>·</span>
                        <span>Joined {formatDate(user.createdAt)}</span>
                        {user.stats.lastLoginAt && (
                          <>
                            <span>·</span>
                            <span>Last login: {formatDateTime(user.stats.lastLoginAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quick stats */}
                    <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                      {user.stats.totalAlerts > 0 && (
                        <span title="Alerts (active/total)">
                          🔔 {user.stats.activeAlerts}/{user.stats.totalAlerts}
                        </span>
                      )}
                      {user.stats.totalNotificationsSent > 0 && (
                        <span title="Notifications sent">
                          ✉️ {user.stats.totalNotificationsSent}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">PRO</span>
                      <Switch
                        checked={user.plan === 'PRO' || user.plan === 'ENTERPRISE'}
                        onCheckedChange={() => togglePlan(user.id, user.plan)}
                        disabled={updating === user.id}
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(user.id)}
                      className="px-2"
                    >
                      {expandedUser === user.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedUser === user.id && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Stats summary */}
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Activity Stats
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Active Sessions</span>
                            <span>{user.stats.activeSessions}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Notifications Sent</span>
                            <span>{user.stats.totalNotificationsSent}</span>
                          </div>
                          {user.subscriptionEndsAt && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subscription Ends</span>
                              <span>{formatDate(user.subscriptionEndsAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Job Alerts */}
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          Job Alerts ({user.jobAlerts.length})
                        </h4>
                        {user.jobAlerts.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No alerts configured</p>
                        ) : (
                          <div className="space-y-2">
                            {user.jobAlerts.map((alert) => (
                              <div
                                key={alert.id}
                                className="text-sm p-2 bg-muted/50 rounded-lg"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={alert.isActive ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {alert.isActive ? 'Active' : 'Paused'}
                                    </Badge>
                                    <span className="font-medium">
                                      {alert.category || 'All Categories'}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {alert.frequency}
                                  </Badge>
                                </div>
                                {alert.keywords && (
                                  <p className="text-muted-foreground mt-1">
                                    Keywords: {alert.keywords}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span>{alert._count.notifications} notifications sent</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
