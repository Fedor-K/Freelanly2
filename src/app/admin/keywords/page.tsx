'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface Opportunity {
  id: string;
  title: string;
  clientName: string;
  category: { name: string };
  contentQuality: string;
  createdAt: string;
}

interface KeywordRun {
  id: string;
  keyword: string;
  keywordIndex: number;
  status: string;
  postsReceived: number;
  postsProcessed: number;
  opportunitiesCreated: number;
  startedAt: string;
  completedAt: string | null;
  conversionRate: string;
  validationRate: string;
  opportunities: Opportunity[];
  _count: { opportunities: number };
}

interface KeywordPerformance {
  keyword: string;
  runs: number;
  postsReceived: number;
  postsProcessed: number;
  opportunitiesCreated: number;
  conversionRate: string;
}

interface Summary {
  totalRuns: number;
  totalPostsReceived: number;
  totalPostsProcessed: number;
  totalOpportunitiesCreated: number;
  overallConversionRate: string;
}

export default function KeywordsPage() {
  const [runs, setRuns] = useState<KeywordRun[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [keywordPerformance, setKeywordPerformance] = useState<KeywordPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'runs' | 'performance'>('runs');
  const perPage = 30;

  useEffect(() => {
    fetchStats();
  }, [page, searchKeyword]);

  async function fetchStats() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
      });
      if (searchKeyword) {
        params.set('keyword', searchKeyword);
      }

      const res = await fetch(`/api/admin/keyword-stats?${params}`);
      const data = await res.json();

      if (data.success) {
        setRuns(data.runs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setSummary(data.summary);
        setKeywordPerformance(data.keywordPerformance);
      }
    } catch (error) {
      console.error('Failed to fetch keyword stats:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(runId: string) {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800 text-xs">Done</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800 text-xs">Failed</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Running</Badge>;
    }
  }

  function getConversionTrend(rate: string) {
    const r = parseFloat(rate);
    if (r >= 10) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (r >= 5) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Keyword Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Статистика поиска по ключевым словам LinkedIn
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.totalRuns}</div>
              <p className="text-xs text-muted-foreground">Всего запусков</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.totalPostsReceived}</div>
              <p className="text-xs text-muted-foreground">Постов получено</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.totalPostsProcessed}</div>
              <p className="text-xs text-muted-foreground">Прошли валидацию</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {summary.totalOpportunitiesCreated}
              </div>
              <p className="text-xs text-muted-foreground">Создано вакансий</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.overallConversionRate}%</div>
              <p className="text-xs text-muted-foreground">Общая конверсия</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'runs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('runs')}
        >
          История запусков
        </Button>
        <Button
          variant={activeTab === 'performance' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('performance')}
        >
          Эффективность ключевиков
        </Button>
      </div>

      {activeTab === 'performance' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Топ-20 ключевых слов по эффективности</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Ключевик</th>
                    <th className="text-right py-2 px-2">Запусков</th>
                    <th className="text-right py-2 px-2">Получено</th>
                    <th className="text-right py-2 px-2">Валидных</th>
                    <th className="text-right py-2 px-2">Вакансий</th>
                    <th className="text-right py-2 px-2">Конверсия</th>
                  </tr>
                </thead>
                <tbody>
                  {keywordPerformance.map((kw, idx) => (
                    <tr key={kw.keyword} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">
                        <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                        <code className="bg-muted px-1 rounded text-xs">{kw.keyword}</code>
                      </td>
                      <td className="text-right py-2 px-2">{kw.runs}</td>
                      <td className="text-right py-2 px-2">{kw.postsReceived}</td>
                      <td className="text-right py-2 px-2">{kw.postsProcessed}</td>
                      <td className="text-right py-2 px-2 font-medium text-green-600">
                        {kw.opportunitiesCreated}
                      </td>
                      <td className="text-right py-2 px-2">
                        <span className="flex items-center justify-end gap-1">
                          {getConversionTrend(kw.conversionRate)}
                          {kw.conversionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'runs' && (
        <>
          {/* Search */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по ключевику..."
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Нет данных о запусках</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Данные появятся после первого запуска поиска через n8n
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {runs.map((run) => (
                  <Card key={run.id} className="overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(run.id)}
                    >
                      {expandedRuns.has(run.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}

                      {getStatusIcon(run.status)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="bg-muted px-2 py-0.5 rounded text-xs font-medium truncate max-w-[300px]">
                            {run.keyword}
                          </code>
                          {getStatusBadge(run.status)}
                          <span className="text-xs text-muted-foreground">
                            #{run.keywordIndex >= 0 ? run.keywordIndex : '?'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{run.postsReceived}</div>
                          <div className="text-xs text-muted-foreground">получено</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{run.postsProcessed}</div>
                          <div className="text-xs text-muted-foreground">валидных</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-green-600">
                            {run.opportunitiesCreated}
                          </div>
                          <div className="text-xs text-muted-foreground">создано</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            {getConversionTrend(run.conversionRate)}
                            <span className="font-medium">{run.conversionRate}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">конверсия</div>
                        </div>
                        <div className="text-xs text-muted-foreground w-24 text-right">
                          {formatDate(run.startedAt)}
                        </div>
                      </div>
                    </div>

                    {expandedRuns.has(run.id) && run.opportunities.length > 0 && (
                      <div className="border-t bg-muted/30 p-3">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">
                          Созданные вакансии ({run._count.opportunities})
                        </h4>
                        <div className="space-y-1">
                          {run.opportunities.map((opp) => (
                            <div
                              key={opp.id}
                              className="flex items-center gap-2 text-sm bg-background p-2 rounded"
                            >
                              <Badge variant="outline" className="text-xs">
                                {opp.category.name}
                              </Badge>
                              <span className="font-medium truncate flex-1">{opp.title}</span>
                              <span className="text-muted-foreground text-xs">
                                от {opp.clientName}
                              </span>
                              <Badge
                                className={
                                  opp.contentQuality === 'RICH'
                                    ? 'bg-green-100 text-green-800'
                                    : opp.contentQuality === 'LIGHT'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                }
                              >
                                {opp.contentQuality}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Назад
                  </Button>
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Страница {page} из {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Далее
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
