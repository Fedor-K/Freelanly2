'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search,
  Trash2,
  Filter,
  X,
  Bookmark,
  FileText,
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
  savedJobs: number;
  applications: number;
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
  emailVerified: string | null;
  _count: {
    jobAlerts: number;
    savedJobs: number;
    applications: number;
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [alertsFilter, setAlertsFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '50');
      if (search) params.set('search', search);
      if (planFilter) params.set('plan', planFilter);
      if (alertsFilter) params.set('hasAlerts', alertsFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setOverallStats(data.overallStats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter, alertsFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setPlanFilter('');
    setAlertsFilter('');
    setPage(1);
  };

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

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;

    setDeleting(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        if (overallStats) {
          setOverallStats({ ...overallStats, totalUsers: overallStats.totalUsers - 1 });
        }
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    } finally {
      setDeleting(null);
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

  const hasActiveFilters = search || planFilter || alertsFilter;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            {pagination?.total || 0} users
            {hasActiveFilters && ` (filtered from ${overallStats?.totalUsers || 0})`}
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overall Stats Cards */}
      {overallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                  <Crown className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.proUsers}</p>
                  <p className="text-xs text-muted-foreground">PRO Users</p>
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

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>

            {/* Filter toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-primary' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">Active</Badge>
              )}
            </Button>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Filter options */}
          {showFilters && (
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium mb-1 block">Plan</label>
                <select
                  value={planFilter}
                  onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="">All plans</option>
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Alerts</label>
                <select
                  value={alertsFilter}
                  onChange={(e) => { setAlertsFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="">All users</option>
                  <option value="true">Has alerts</option>
                  <option value="false">No alerts</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading users...</p>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {hasActiveFilters ? 'No users match your filters' : 'No users yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
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
                          <Badge variant={user.plan === 'PRO' ? 'default' : user.plan === 'ENTERPRISE' ? 'default' : 'secondary'}>
                            {user.plan}
                          </Badge>
                          {!user.emailVerified && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              Unverified
                            </Badge>
                          )}
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
                              <span>Last: {formatDateTime(user.stats.lastLoginAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Quick stats */}
                      <div className="hidden sm:flex items-center gap-3 text-sm text-muted-foreground">
                        {user.stats.totalAlerts > 0 && (
                          <span title="Alerts (active/total)" className="flex items-center gap-1">
                            <Bell className="h-3 w-3" />
                            {user.stats.activeAlerts}/{user.stats.totalAlerts}
                          </span>
                        )}
                        {user.stats.savedJobs > 0 && (
                          <span title="Saved jobs" className="flex items-center gap-1">
                            <Bookmark className="h-3 w-3" />
                            {user.stats.savedJobs}
                          </span>
                        )}
                        {user.stats.applications > 0 && (
                          <span title="Applications" className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {user.stats.applications}
                          </span>
                        )}
                        {user.stats.totalNotificationsSent > 0 && (
                          <span title="Emails sent" className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.stats.totalNotificationsSent}
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
                        onClick={() => deleteUser(user.id, user.email)}
                        disabled={deleting === user.id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

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
                              <span className="text-muted-foreground">Saved Jobs</span>
                              <span>{user.stats.savedJobs}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Applications</span>
                              <span>{user.stats.applications}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Notifications Sent</span>
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
                            <div className="space-y-2 max-h-48 overflow-y-auto">
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
                                    <span>{alert._count.notifications} sent</span>
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

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
