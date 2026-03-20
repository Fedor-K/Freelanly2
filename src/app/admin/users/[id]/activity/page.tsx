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

const ACTION_LABELS: Record<string, string> = {
  // Auth
  LOGIN: 'Вошёл в аккаунт',
  LOGOUT: 'Вышел из аккаунта',
  SIGNUP: 'Зарегистрировался',
  SIGNUP_START: 'Начал регистрацию',
  SIGNUP_COMPLETE: 'Завершил регистрацию',
  EMAIL_VERIFIED: 'Подтвердил email',
  // Navigation
  PAGE_VIEW: 'Открыл страницу',
  // Jobs
  JOB_VIEW: 'Посмотрел вакансию',
  JOB_APPLY: 'Нажал "Откликнуться"',
  JOB_SOURCE_CLICK: 'Перешёл на источник вакансии',
  JOB_SAVE: 'Сохранил вакансию',
  JOB_SHARE: 'Поделился вакансией',
  // Opportunities
  OPPORTUNITY_VIEW: 'Посмотрел проект',
  OPPORTUNITY_APPLY_CLICK: 'Нажал "Откликнуться" на проект',
  // Paywall
  PAYWALL_HIT: 'Увидел paywall',
  PAYWALL_CLOSE: 'Закрыл paywall',
  UPGRADE_CLICK: 'Нажал "Upgrade"',
  UPGRADE_MODAL_OPEN: 'Открыл окно апгрейда',
  // Pricing
  PRICING_VIEW: 'Зашёл на /pricing',
  PRICING_PLAN_CLICK: 'Выбрал тариф',
  CHECKOUT_START: 'Начал оплату',
  CHECKOUT_COMPLETE: 'Оплатил подписку',
  // Search
  SEARCH: 'Поиск',
  FILTER_CHANGE: 'Изменил фильтр',
  // Alerts
  ALERT_CREATED: 'Создал алерт',
  ALERT_DELETED: 'Удалил алерт',
  ALERT_EMAIL_OPEN: 'Открыл email алерта',
  ALERT_EMAIL_CLICK: 'Кликнул ссылку в алерте',
  EMAIL_SENT: 'Получил письмо',
  // Subscription
  SUBSCRIPTION_STARTED: 'Оформил подписку',
  SUBSCRIPTION_CANCELLED: 'Отменил подписку',
  PAYMENT_SUCCESS: 'Платёж прошёл',
  PAYMENT_FAILED: 'Платёж не прошёл',
  // Other
  UNSUBSCRIBE: 'Отписался от рассылки',
  CONTACT_VIEW: 'Посмотрел контакты',
  REGISTRATION_MODAL_OPEN: 'Открыл форму регистрации',
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
  SIGNUP: 'bg-green-100 text-green-700',
  SIGNUP_START: 'bg-green-50 text-green-600',
  SIGNUP_COMPLETE: 'bg-green-200 text-green-800',
  EMAIL_VERIFIED: 'bg-emerald-100 text-emerald-700',
  PAGE_VIEW: 'bg-slate-100 text-slate-600',
  JOB_VIEW: 'bg-indigo-100 text-indigo-700',
  JOB_APPLY: 'bg-purple-200 text-purple-800',
  JOB_SOURCE_CLICK: 'bg-purple-100 text-purple-700',
  JOB_SAVE: 'bg-yellow-100 text-yellow-700',
  JOB_SHARE: 'bg-cyan-100 text-cyan-700',
  OPPORTUNITY_VIEW: 'bg-indigo-50 text-indigo-600',
  OPPORTUNITY_APPLY_CLICK: 'bg-purple-100 text-purple-700',
  PAYWALL_HIT: 'bg-orange-200 text-orange-800',
  PAYWALL_CLOSE: 'bg-orange-100 text-orange-600',
  UPGRADE_CLICK: 'bg-amber-200 text-amber-800',
  UPGRADE_MODAL_OPEN: 'bg-amber-100 text-amber-700',
  PRICING_VIEW: 'bg-violet-100 text-violet-700',
  PRICING_PLAN_CLICK: 'bg-violet-200 text-violet-800',
  CHECKOUT_START: 'bg-emerald-100 text-emerald-700',
  CHECKOUT_COMPLETE: 'bg-emerald-200 text-emerald-800',
  SEARCH: 'bg-sky-100 text-sky-700',
  FILTER_CHANGE: 'bg-sky-50 text-sky-600',
  ALERT_CREATED: 'bg-teal-100 text-teal-700',
  ALERT_DELETED: 'bg-red-100 text-red-700',
  ALERT_EMAIL_OPEN: 'bg-pink-100 text-pink-700',
  ALERT_EMAIL_CLICK: 'bg-pink-200 text-pink-800',
  EMAIL_SENT: 'bg-blue-50 text-blue-600',
  SUBSCRIPTION_STARTED: 'bg-green-200 text-green-800',
  SUBSCRIPTION_CANCELLED: 'bg-red-200 text-red-800',
  PAYMENT_SUCCESS: 'bg-green-100 text-green-700',
  PAYMENT_FAILED: 'bg-red-100 text-red-700',
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

function formatTime(date: string): string {
  return new Date(date).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDayLabel(dateKey: string): string {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'short',
  });
}

function getDayKey(date: string): string {
  return new Date(date).toISOString().split('T')[0];
}

function groupByDay(activities: ActivityLog[]): Map<string, ActivityLog[]> {
  const groups = new Map<string, ActivityLog[]>();
  // Reverse to get chronological order (oldest first)
  const sorted = [...activities].reverse();
  for (const activity of sorted) {
    const day = getDayKey(activity.createdAt);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(activity);
  }
  // Return with newest days first
  return new Map([...groups.entries()].reverse());
}

function formatDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return '';
  const d = details;

  switch (action) {
    case 'PAGE_VIEW':
      return [d.url, d.referrer ? `← ${d.referrer}` : ''].filter(Boolean).join(' ');
    case 'JOB_VIEW':
      return `«${d.title}» в ${d.company}`;
    case 'JOB_APPLY':
      return `«${d.jobTitle}» в ${d.company} (кнопка: ${d.method === 'url' ? 'Apply Now (ссылка)' : d.method === 'email' ? 'Quick Apply (email)' : 'Apply Now (LinkedIn)'})`;
    case 'JOB_SOURCE_CLICK':
      return `«${d.jobTitle}» в ${d.company} → ${d.url}`;
    case 'JOB_SHARE':
      return `Платформа: ${d.platform}`;
    case 'OPPORTUNITY_VIEW':
      return `«${d.title}» от ${d.client} (${d.category})`;
    case 'OPPORTUNITY_APPLY_CLICK':
      return `«${d.title}» (${d.method === 'linkedin' ? 'кнопка LinkedIn' : d.method === 'email' ? 'кнопка Email' : 'кнопка Apply'})`;
    case 'PAYWALL_HIT':
      return `${d.jobTitle || d.title || ''} — тип: ${d.type === 'apply' ? 'кнопка Apply' : d.type === 'contact' ? 'кнопка Контакт' : d.type}`;
    case 'PAYWALL_CLOSE':
      return `Закрыл без оплаты${d.jobTitle ? ` — «${d.jobTitle}» в ${d.company}` : ''}`;
    case 'UPGRADE_CLICK':
      return `${d.jobTitle ? `«${d.jobTitle}»` : ''}${d.company ? ` в ${d.company}` : ''} → перешёл на оплату (${d.source === 'paywall' ? 'paywall' : d.source === 'upgrade_modal' ? 'окно апгрейда' : d.source})`;
    case 'UPGRADE_MODAL_OPEN':
      return `«${d.jobTitle}» в ${d.company}`;
    case 'PRICING_VIEW':
      return d.source ? `Источник: ${d.source}` : '';
    case 'PRICING_PLAN_CLICK':
      return `Тариф: ${d.plan}`;
    case 'CHECKOUT_START':
      return `Тариф: ${d.plan}, источник: ${d.source}`;
    case 'CHECKOUT_COMPLETE':
      return `${d.amount}${d.currency ? ' ' + String(d.currency).toUpperCase() : ''}`;
    case 'SEARCH':
      return `Запрос: «${d.query}»`;
    case 'FILTER_CHANGE':
      return `${d.filter}: ${d.value || 'сброшен'}`;
    case 'SIGNUP_START':
      return d.source ? `Источник: ${d.source}` : '';
    case 'SIGNUP_COMPLETE':
      return d.categories ? `Категории: ${Array.isArray(d.categories) ? (d.categories as string[]).join(', ') : d.categories}` : '';
    case 'REGISTRATION_MODAL_OPEN':
      return d.jobTitle ? `На вакансии «${d.jobTitle}»` : d.source ? `Источник: ${d.source}` : '';
    case 'LOGIN':
      return `${d.email} (${d.provider})`;
    case 'ALERT_CREATED':
      return [d.category, d.keywords ? `запрос: ${d.keywords}` : ''].filter(Boolean).join(', ');
    case 'ALERT_DELETED':
      return d.category ? `Категория: ${d.category}` : '';
    case 'ALERT_EMAIL_OPEN':
      return '';
    case 'ALERT_EMAIL_CLICK':
      return d.url ? `→ ${d.url}` : '';
    case 'EMAIL_SENT': {
      const typeLabels: Record<string, string> = {
        alert: 'Алерт о вакансиях',
        magic_link: 'Magic Link',
        activation: 'Онбординг',
        trial: 'Триал',
        winback: 'Win-back',
        abandoned_checkout: 'Брошенная корзина',
        application: 'Отклик на вакансию',
        other: 'Другое',
      };
      return `${typeLabels[d.type as string] || d.type}: «${d.subject}»`;
    }
    case 'CONTACT_VIEW':
      return d.clientName ? `Контакт: ${d.clientName}` : '';
    case 'UNSUBSCRIBE':
      return `${d.email} (${d.source})`;
    case 'SUBSCRIPTION_STARTED':
      return `${(d.amount as number) / 100} ${String(d.currency || '').toUpperCase()}`;
    case 'SUBSCRIPTION_CANCELLED':
      return d.reason ? `Причина: ${d.reason}` : '';
    case 'PAYMENT_FAILED':
      return '';
    default:
      // Fallback: show raw key-value pairs
      return Object.entries(details)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ');
  }
}

export default function UserActivityPage() {
  const params = useParams();
  const userId = params.id as string;

  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const limit = 200;

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

  // Auto-expand today on first load
  useEffect(() => {
    if (data && expandedDays.size === 0) {
      const today = new Date().toISOString().split('T')[0];
      setExpandedDays(new Set([today]));
    }
  }, [data, expandedDays.size]);

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
                {ACTION_LABELS[actionFilter] || actionFilter} x
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
                  title={action}
                >
                  {ACTION_LABELS[action] || action} ({count})
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline grouped by day */}
      <div className="space-y-2">
        {activities.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Нет активности</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {[...groupByDay(activities)].map(([dayKey, dayActivities]) => {
              const isExpanded = expandedDays.has(dayKey);
              const toggleDay = () => {
                const next = new Set(expandedDays);
                if (next.has(dayKey)) next.delete(dayKey);
                else next.add(dayKey);
                setExpandedDays(next);
              };

              return (
                <Card key={dayKey}>
                  <button
                    onClick={toggleDay}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <span className="font-medium">{formatDayLabel(dayKey)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {dayActivities.length} {dayActivities.length === 1 ? 'событие' : dayActivities.length < 5 ? 'события' : 'событий'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{dayKey}</span>
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-3">
                      <div className="space-y-0.5 border-l-2 border-muted ml-2">
                        {dayActivities.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-start gap-3 py-1.5 px-3 rounded hover:bg-muted/50 text-sm ml-2"
                          >
                            {/* Time */}
                            <div className="text-xs text-muted-foreground whitespace-nowrap w-16 shrink-0 pt-0.5">
                              {formatTime(activity.createdAt)}
                            </div>

                            {/* Action Badge */}
                            <Badge
                              variant="secondary"
                              className={`shrink-0 text-xs ${ACTION_COLORS[activity.action] || 'bg-gray-100 text-gray-700'}`}
                              title={activity.action}
                            >
                              {ACTION_LABELS[activity.action] || activity.action}
                            </Badge>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              {activity.details && formatDetails(activity.action, activity.details) && (
                                <span className="text-muted-foreground text-xs break-words block">
                                  {formatDetails(activity.action, activity.details)}
                                </span>
                              )}
                              {activity.pageUrl && activity.action === 'PAGE_VIEW' && (
                                <span className="text-xs text-blue-500 break-words block">
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
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {/* Pagination */}
            {pagination.total > limit && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Назад
                </Button>
                <span className="text-sm text-muted-foreground">
                  {offset + 1} — {Math.min(offset + limit, pagination.total)} из {pagination.total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasMore}
                  onClick={() => setOffset(offset + limit)}
                >
                  Далее
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
