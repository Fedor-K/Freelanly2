'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  MousePointer,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Bot,
} from 'lucide-react';

interface ClarityStats {
  traffic: {
    sessions: number;
    botSessions: number;
    realSessions: number;
    uniqueUsers: number;
    pagesPerSession: number;
    botPercentage: number;
  };
  engagement: {
    totalTime: number;
    activeTime: number;
    scrollDepth: number;
  };
  uxIssues: {
    deadClicks: number;
    rageClicks: number;
    quickBack: number;
    scriptErrors: number;
  };
  devices: Array<{ name: string; sessions: number }>;
  countries: Array<{ name: string; sessions: number }>;
  browsers: Array<{ name: string; sessions: number }>;
  topPages: Array<{ url: string; visits: number }>;
  referrers: Array<{ url: string | null; sessions: number }>;
  pageTitles: Array<{ title: string | null; sessions: number }>;
}

function TrafficCard({ stats }: { stats: ClarityStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Трафик (3 дня)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-3xl font-bold">{stats.traffic.realSessions}</p>
            <p className="text-sm text-muted-foreground">реальных сессий</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{stats.traffic.uniqueUsers}</p>
            <p className="text-sm text-muted-foreground">уникальных</p>
          </div>
        </div>

        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 mb-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <Bot className="h-4 w-4" />
            <span className="font-medium">{stats.traffic.botPercentage}% ботов</span>
          </div>
          <p className="text-xs text-yellow-700 mt-1">
            {stats.traffic.botSessions} из {stats.traffic.sessions} сессий
          </p>
        </div>

        <div className="text-sm">
          <p>
            <span className="text-muted-foreground">Страниц/сессия:</span>{' '}
            <span className="font-medium">{stats.traffic.pagesPerSession.toFixed(2)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EngagementCard({ stats }: { stats: ClarityStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Вовлечённость
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold">{stats.engagement.totalTime}s</p>
            <p className="text-xs text-muted-foreground">общее время</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold">{stats.engagement.activeTime}s</p>
            <p className="text-xs text-muted-foreground">активное</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold">{stats.engagement.scrollDepth.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">скролл</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UXIssuesCard({ stats }: { stats: ClarityStats }) {
  const issues = [
    { name: 'Dead Clicks', value: stats.uxIssues.deadClicks, threshold: 5, desc: 'клики на некликабельное' },
    { name: 'Quick Back', value: stats.uxIssues.quickBack, threshold: 10, desc: 'быстро уходят назад' },
    { name: 'Rage Clicks', value: stats.uxIssues.rageClicks, threshold: 2, desc: 'яростные клики' },
    { name: 'Script Errors', value: stats.uxIssues.scriptErrors, threshold: 1, desc: 'JS ошибки' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          UX Проблемы
        </CardTitle>
        <CardDescription>% сессий с проблемой</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {issues.map((issue) => {
            const isHigh = issue.value > issue.threshold;
            return (
              <div key={issue.name} className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${isHigh ? 'text-red-600' : ''}`}>{issue.name}</p>
                  <p className="text-xs text-muted-foreground">{issue.desc}</p>
                </div>
                <div className={`text-lg font-bold ${isHigh ? 'text-red-600' : 'text-green-600'}`}>
                  {issue.value.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DevicesCard({ stats }: { stats: ClarityStats }) {
  const total = stats.devices.reduce((sum, d) => sum + d.sessions, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Устройства
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.devices.map((device) => {
            const pct = total > 0 ? Math.round((device.sessions / total) * 100) : 0;
            const Icon = device.name === 'Mobile' ? Smartphone : Monitor;
            return (
              <div key={device.name} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{device.name}</span>
                <span className="text-muted-foreground">{device.sessions}</span>
                <span className="font-medium w-12 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CountriesCard({ stats }: { stats: ClarityStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Страны
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.countries.slice(0, 8).map((country, i) => (
            <div key={country.name} className="flex items-center justify-between text-sm">
              <span>
                {i + 1}. {country.name}
              </span>
              <span className="font-medium">{country.sessions}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReferrersCard({ stats }: { stats: ClarityStats }) {
  const formatReferrer = (url: string | null) => {
    if (!url) return 'Direct';
    try {
      const u = new URL(url);
      return u.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Источники трафика
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.referrers.slice(0, 8).map((ref, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="truncate max-w-[200px]">{formatReferrer(ref.url)}</span>
              <span className="font-medium">{ref.sessions}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TopPagesCard({ stats }: { stats: ClarityStats }) {
  const formatUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname || '/';
    } catch {
      return url;
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MousePointer className="h-5 w-5" />
          Популярные страницы
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.topPages.map((page, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 truncate max-w-[400px]">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span>{formatUrl(page.url)}</span>
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <span className="font-medium">{page.visits}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PageTitlesCard({ stats }: { stats: ClarityStats }) {
  // Highlight problematic pages
  const problemPages = stats.pageTitles.filter(
    (p) => p.title?.includes('Not Found') || p.title?.includes('No Longer Available')
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Проблемные страницы</CardTitle>
        <CardDescription>404 и устаревшие вакансии</CardDescription>
      </CardHeader>
      <CardContent>
        {problemPages.length === 0 ? (
          <p className="text-sm text-green-600">Нет проблемных страниц</p>
        ) : (
          <div className="space-y-2">
            {problemPages.map((page, i) => (
              <div key={i} className="p-2 bg-red-50 rounded text-sm">
                <p className="font-medium text-red-800 truncate">{page.title}</p>
                <p className="text-red-600">{page.sessions} сессий</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClarityDashboard() {
  const [stats, setStats] = useState<ClarityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/clarity-stats');
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
  }, []);

  if (loading && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Clarity Analytics</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Загрузка данных из Clarity...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Clarity Analytics</h1>
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
        <div>
          <h1 className="text-3xl font-bold">Clarity Analytics</h1>
          <p className="text-muted-foreground">Данные за последние 3 дня</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://clarity.microsoft.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            Открыть Clarity
          </a>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Traffic & Engagement */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <TrafficCard stats={stats} />
        <EngagementCard stats={stats} />
        <UXIssuesCard stats={stats} />
      </div>

      {/* Devices, Countries, Referrers */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <DevicesCard stats={stats} />
        <CountriesCard stats={stats} />
        <ReferrersCard stats={stats} />
      </div>

      {/* Pages */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TopPagesCard stats={stats} />
        <PageTitlesCard stats={stats} />
      </div>
    </div>
  );
}
