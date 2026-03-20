'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity, Filter, ChevronDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  sessionId: string | null;
  pageUrl: string | null;
  createdAt: string;
}

interface UserInfo {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  createdAt: string;
  lastActiveAt: string | null;
}

interface ActivityResponse {
  user: UserInfo;
  activities: ActivityLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  summary: {
    totalActions: number;
    byAction: Record<string, number>;
  };
}

const ACTION_COLORS: Record<string, string> = {
  // Auth
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
  SIGNUP: 'bg-green-100 text-green-700',
  SIGNUP_START: 'bg-green-50 text-green-600',
  SIGNUP_COMPLETE: 'bg-green-200 text-green-800',
  EMAIL_VERIFIED: 'bg-emerald-100 text-emerald-700',
  // Navigation
  PAGE_VIEW: 'bg-slate-100 text-slate-600',
  // Jobs
  JOB_VIEW: 'bg-indigo-100 text-indigo-700',
  JOB_APPLY: 'bg-purple-200 text-purple-800',
  JOB_SOURCE_CLICK: 'bg-purple-100 text-purple-700',
  JOB_SAVE: 'bg-yellow-100 text-yellow-700',
  JOB_SHARE: 'bg-cyan-100 text-cyan-700',
  // Opportunities
  OPPORTUNITY_VIEW: 'bg-indigo-50 text-indigo-600',
  OPPORTUNITY_APPLY_CLICK: 'bg-purple-100 text-purple-700',
  // Paywall
  PAYWALL_HIT: 'bg-orange-200 text-orange-800',
  PAYWALL_CLOSE: 'bg-orange-100 text-orange-600',
  UPGRADE_CLICK: 'bg-amber-200 text-amber-800',
  UPGRADE_MODAL_OPEN: 'bg-amber-100 text-amber-700',
  // Pricing
  PRICING_VIEW: 'bg-violet-100 text-violet-700',
  PRICING_PLAN_CLICK: 'bg-violet-200 text-violet-800',
  CHECKOUT_START: 'bg-emerald-100 text-emerald-700',
  CHECKOUT_COMPLETE: 'bg-emerald-200 text-emerald-800',
  // Search
  SEARCH: 'bg-sky-100 text-sky-700',
  FILTER_CHANGE: 'bg-sky-50 text-sky-600',
  // Alerts
  ALERT_CREATED: 'bg-teal-100 text-teal-700',
  ALERT_DELETED: 'bg-red-100 text-red-700',
  ALERT_EMAIL_OPEN: 'bg-pink-100 text-pink-700',
  ALERT_EMAIL_CLICK: 'bg-pink-200 text-pink-800',
  // Subscription
  SUBSCRIPTION_STARTED: 'bg-green-200 text-green-800',
  SUBSCRIPTION_CANCELLED: 'bg-red-200 text-red-800',
  PAYMENT_SUCCESS: 'bg-green-100 text-green-700',
  PAYMENT_FAILED: 'bg-red-100 text-red-700',
  // Other
  UNSUBSCRIBE: 'bg-red-100 text-red-600',
  CONTACT_VIEW: 'bg-blue-100 text-blue-700',
  REGISTRATION_MODAL_OPEN: 'bg-green-50 text-green-600',
};

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '';
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' | ');
}

export default function UserActivityPage() {
  const params = useParams();
  const userId = params.id as string;

  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      if (actionFilter) params.set('action', actionFilter);

      const res = await fetch(`/api/admin/users/${userId}/activity?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, offset, actionFilter]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  if (loading && !data) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const { user, activities, pagination, summary } = data;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              User Activity
            </h1>
            <p className="text-muted-foreground">
              {user.email} ({user.name || 'No name'}) —{' '}
              <Badge variant={user.plan === 'PRO' ? 'default' : 'secondary'}>{user.plan}</Badge>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchActivity} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary.totalActions}</div>
            <div className="text-sm text-muted-foreground">Total Actions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary.byAction.JOB_VIEW || 0}</div>
            <div className="text-sm text-muted-foreground">Job Views</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary.byAction.JOB_APPLY || 0}</div>
            <div className="text-sm text-muted-foreground">Applications</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary.byAction.PAYWALL_HIT || 0}</div>
            <div className="text-sm text-muted-foreground">Paywall Hits</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Action Breakdown</span>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" />
              Filter
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {actionFilter && (
              <Badge
                variant="default"
                className="cursor-pointer"
                onClick={() => { setActionFilter(''); setOffset(0); }}
              >
                {actionFilter} x
              </Badge>
            )}
            {showFilters && Object.entries(summary.byAction)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count]) => (
                <Badge
                  key={action}
                  variant={actionFilter === action ? 'default' : 'outline'}
                  className={`cursor-pointer ${ACTION_COLORS[action] || 'bg-gray-100 text-gray-700'}`}
                  onClick={() => { setActionFilter(actionFilter === action ? '' : action); setOffset(0); }}
                >
                  {action} ({count})
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Timeline ({pagination.total} events)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 py-2 px-3 rounded hover:bg-muted/50 text-sm border-l-2 border-transparent hover:border-primary"
              >
                {/* Time */}
                <div className="text-xs text-muted-foreground whitespace-nowrap w-36 shrink-0 pt-0.5">
                  {formatDateTime(activity.createdAt)}
                </div>

                {/* Action Badge */}
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-xs ${ACTION_COLORS[activity.action] || 'bg-gray-100 text-gray-700'}`}
                >
                  {activity.action}
                </Badge>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  {activity.details && (
                    <span className="text-muted-foreground text-xs truncate block">
                      {formatDetails(activity.details)}
                    </span>
                  )}
                  {activity.pageUrl && (
                    <span className="text-xs text-blue-500 truncate block">
                      {activity.pageUrl}
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {activity.country && <span>{activity.country}</span>}
                  {activity.city && <span> {activity.city}</span>}
                </div>
              </div>
            ))}

            {activities.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No activity found</p>
            )}
          </div>

          {/* Pagination */}
          {pagination.total > limit && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1} - {Math.min(offset + limit, pagination.total)} of {pagination.total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasMore}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
