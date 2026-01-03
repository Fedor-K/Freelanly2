'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Database,
  Cpu,
  Globe,
  Search,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface ParsingStats {
  queue: {
    pending: number;
    processing: number;
    completedToday: number;
    failedToday: number;
    estimatedMinutesRemaining: number | null;
    totalProgress: number;
  };
  current: {
    source: string;
    startedAt: string;
    progress: string;
  } | null;
  today: {
    sources: number;
    found: number;
    created: number;
    skipped: number;
    changePercent: number | null;
    conversionRate: number;
  };
  weekly: Array<{
    date: string;
    created: number;
    skipped: number;
  }>;
  health: {
    healthy: number;
    empty: number;
    errors: number;
    problems: Array<{
      name: string;
      error: string | null;
      lastRun: string | null;
      fetched: number;
      errorCount: number;
    }>;
  };
  topSources: Array<{
    name: string;
    created: number;
    total: number;
    conversion: number;
  }>;
  worstSources: Array<{
    name: string;
    created: number;
    total: number;
    conversion: number;
  }>;
  indexing: {
    google: {
      today: { urlsCount: number; success: number; failed: number };
      week: { urlsCount: number; success: number; failed: number };
      lastSubmission: {
        createdAt: string;
        success: number;
        failed: number;
        error: string | null;
      } | null;
    };
    indexNow: {
      today: { urlsCount: number; success: number; failed: number };
      week: { urlsCount: number; success: number; failed: number };
      lastSubmission: {
        createdAt: string;
        success: number;
        failed: number;
        error: string | null;
      } | null;
    };
    lastSubmission: {
      provider: string;
      createdAt: string;
      success: number;
      failed: number;
      error: string | null;
    } | null;
  };
  ai: {
    callsToday: number;
    callsWeek: number;
    costToday: number;
    costWeek: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'success';
    message: string;
  }>;
}

function QueueCard({ stats }: { stats: ParsingStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Очередь задач
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{stats.queue.pending}</p>
            <p className="text-xs text-yellow-600">В ожидании</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{stats.queue.processing}</p>
            <p className="text-xs text-blue-600">Обработка</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats.queue.completedToday}</p>
            <p className="text-xs text-green-600">Сегодня ОК</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{stats.queue.failedToday}</p>
            <p className="text-xs text-red-600">Ошибки</p>
          </div>
        </div>

        {/* Progress bar */}
        {(stats.queue.pending > 0 || stats.queue.processing > 0) && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Прогресс</span>
              <span>{stats.queue.totalProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${stats.queue.totalProgress}%` }}
              />
            </div>
            {stats.queue.estimatedMinutesRemaining && (
              <p className="text-xs text-muted-foreground mt-1">
                ~{stats.queue.estimatedMinutesRemaining} мин осталось
              </p>
            )}
          </div>
        )}

        {/* Current task */}
        {stats.current && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="font-medium text-blue-800">Обрабатывается</span>
            </div>
            <p className="text-sm text-blue-700">{stats.current.source}</p>
            <p className="text-xs text-blue-600">
              {stats.current.progress} · с {new Date(stats.current.startedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TodayStatsCard({ stats }: { stats: ParsingStats }) {
  const changeIcon = stats.today.changePercent !== null && stats.today.changePercent > 0
    ? <TrendingUp className="h-4 w-4 text-green-600" />
    : stats.today.changePercent !== null && stats.today.changePercent < 0
    ? <TrendingDown className="h-4 w-4 text-red-600" />
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Сегодня
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-3xl font-bold text-green-600">{stats.today.created}</p>
            <p className="text-sm text-muted-foreground">новых вакансий</p>
            {stats.today.changePercent !== null && (
              <div className="flex items-center gap-1 mt-1">
                {changeIcon}
                <span className={`text-xs ${stats.today.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.today.changePercent > 0 ? '+' : ''}{stats.today.changePercent}% vs вчера
                </span>
              </div>
            )}
          </div>
          <div>
            <p className="text-3xl font-bold">{stats.today.sources}</p>
            <p className="text-sm text-muted-foreground">источников</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="p-2 bg-gray-50 rounded">
            <p className="font-semibold">{stats.today.found}</p>
            <p className="text-xs text-muted-foreground">найдено</p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="font-semibold">{stats.today.skipped}</p>
            <p className="text-xs text-muted-foreground">дубли</p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="font-semibold">{stats.today.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">конверсия</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceHealthCard({ stats }: { stats: ParsingStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Здоровье источников
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-600">{stats.health.healthy}</p>
            <p className="text-xs text-green-600">Здоровые</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-yellow-600">{stats.health.empty}</p>
            <p className="text-xs text-yellow-600">Пустые</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-600">{stats.health.errors}</p>
            <p className="text-xs text-red-600">С ошибками</p>
          </div>
        </div>

        {stats.health.problems.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">Проблемные источники:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {stats.health.problems.slice(0, 5).map((p, i) => (
                <div key={i} className="p-2 bg-red-50 rounded text-sm">
                  <p className="font-medium text-red-800">{p.name}</p>
                  <p className="text-xs text-red-600 truncate">{p.error || 'Нет данных'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IndexingCard({ stats }: { stats: ParsingStats }) {
  const googleError = stats.indexing.google.lastSubmission?.error;
  const googleHasError = googleError || (stats.indexing.google.lastSubmission?.failed ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Индексация
        </CardTitle>
        <CardDescription>Google Indexing API & IndexNow</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Google */}
          <div className={`p-3 border rounded-lg ${googleHasError ? 'border-red-300 bg-red-50' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <Globe className={`h-4 w-4 ${googleHasError ? 'text-red-600' : 'text-blue-600'}`} />
              <span className="font-medium text-sm">Google</span>
              {googleHasError && <XCircle className="h-3 w-3 text-red-500" />}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Сегодня</p>
                <p className={`font-semibold ${(stats.indexing.google.today.success || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {stats.indexing.google.today.success || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Неделя</p>
                <p className="font-semibold">{stats.indexing.google.week.success || 0}</p>
              </div>
            </div>
            {googleError && (
              <p className="text-xs text-red-600 mt-2 truncate" title={googleError}>
                ⚠️ {googleError.includes('Quota exceeded') ? 'Квота исчерпана (200/день)' : googleError.slice(0, 50)}
              </p>
            )}
          </div>

          {/* IndexNow */}
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">IndexNow</span>
              {(stats.indexing.indexNow.today.success || 0) > 0 && <CheckCircle className="h-3 w-3 text-green-500" />}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Сегодня</p>
                <p className="font-semibold text-green-600">{stats.indexing.indexNow.today.success || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Неделя</p>
                <p className="font-semibold">{stats.indexing.indexNow.week.success || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {stats.indexing.lastSubmission && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            Последняя: {stats.indexing.lastSubmission.provider} · {' '}
            {new Date(stats.indexing.lastSubmission.createdAt).toLocaleString()} · {' '}
            <span className="text-green-600">{stats.indexing.lastSubmission.success} OK</span>
            {stats.indexing.lastSubmission.failed > 0 && (
              <span className="text-red-600"> · {stats.indexing.lastSubmission.failed} fail</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AIUsageCard({ stats }: { stats: ParsingStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" />
          AI Usage (Z.ai)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Сегодня</p>
            <p className="text-xl font-bold">{stats.ai.callsToday.toLocaleString()}</p>
            <p className="text-xs text-green-600">${stats.ai.costToday}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">За неделю</p>
            <p className="text-xl font-bold">{stats.ai.callsWeek.toLocaleString()}</p>
            <p className="text-xs text-green-600">${stats.ai.costWeek}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopSourcesCard({ sources, title }: { sources: ParsingStats['topSources']; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет данных</p>
        ) : (
          <div className="space-y-2">
            {sources.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[150px]">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-medium">{s.created}</span>
                  <span className="text-xs text-muted-foreground">({s.conversion}%)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsSection({ alerts }: { alerts: ParsingStats['alerts'] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`p-3 rounded-lg flex items-center gap-2 ${
            alert.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : alert.type === 'warning'
              ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}
        >
          {alert.type === 'error' ? (
            <XCircle className="h-5 w-5" />
          ) : alert.type === 'warning' ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <CheckCircle className="h-5 w-5" />
          )}
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}

function WeeklyChart({ data }: { data: ParsingStats['weekly'] }) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.created + d.skipped));
  const sortedData = [...data].reverse(); // oldest first

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">За неделю</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-32">
          {sortedData.map((d, i) => {
            const height = maxValue > 0 ? ((d.created + d.skipped) / maxValue) * 100 : 0;
            const createdHeight = maxValue > 0 ? (d.created / maxValue) * 100 : 0;
            const date = new Date(d.date);
            const dayName = date.toLocaleDateString('ru', { weekday: 'short' });

            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gray-200 rounded-t relative"
                  style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-green-500 rounded-t"
                    style={{ height: `${(createdHeight / height) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground mt-1">{dayName}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span>Создано</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-200 rounded" />
            <span>Пропущено</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParsingDashboard() {
  const [stats, setStats] = useState<ParsingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/parsing-stats');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Парсинг</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Загрузка статистики...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Парсинг</h1>
        <div className="p-4 bg-red-50 text-red-800 rounded-lg">
          <p className="font-medium">Ошибка загрузки</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Парсинг</h1>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Alerts */}
      <AlertsSection alerts={stats.alerts} />

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <QueueCard stats={stats} />
        <TodayStatsCard stats={stats} />
      </div>

      {/* Health and Indexing */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <SourceHealthCard stats={stats} />
        <IndexingCard stats={stats} />
      </div>

      {/* Chart and AI */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <WeeklyChart data={stats.weekly} />
        <AIUsageCard stats={stats} />
      </div>

      {/* Top/Worst Sources */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopSourcesCard sources={stats.topSources} title="Топ источники (7 дней)" />
        <TopSourcesCard sources={stats.worstSources} title="Худшая конверсия" />
      </div>
    </div>
  );
}
