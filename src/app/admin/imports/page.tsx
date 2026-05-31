'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, XCircle, Search, ChevronDown, ChevronRight } from 'lucide-react';

// Per-post webhook activity feed. Shows EVERY LinkedIn post that hit the webhook
// with the AI's decision (created OR skipped) and the AI's specific reason.
// Goal: when admin asks "why did this NOT get imported?" — answer in one click.

type Row = {
  id: string;
  createdAt: string;
  status: 'created' | 'skipped';
  title: string | null;
  applyEmail: string | null;
  reason: string | null;
  aiReason: string | null;
  contentQuality: string | null;
  qualityScore: number | null;
  slug: string | null;
  excerpt: string | null;
  postUrl: string | null;
  author: string | null;
};

type Summary = {
  created: number;
  skipped: number;
  total: number;
  skipByReason: Record<string, number>;
  aiReasonsTop: Array<{ aiReason: string; n: number }>;
};

const PERIODS: Array<{ value: string; label: string }> = [
  { value: '1h', label: 'Последний час' },
  { value: '6h', label: '6 часов' },
  { value: '24h', label: '24 часа' },
  { value: '7d', label: '7 дней' },
];

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Все причины' },
  { value: 'not_job_posting', label: 'AI: не вакансия' },
  { value: 'no_title', label: 'AI: нет title' },
  { value: 'non-target profession', label: 'Не наша профессия' },
  { value: 'duplicate', label: 'Дубль' },
  { value: 'duplicate_title', label: 'Дубль по title' },
  { value: 'empty_data', label: 'Пустые данные' },
  { value: 'self_promo', label: 'Самореклама' },
  { value: 'own_platform', label: 'Наш собственный' },
];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}с назад`;
  if (s < 3600) return `${Math.floor(s / 60)}м назад`;
  if (s < 86400) return `${Math.floor(s / 3600)}ч назад`;
  return `${Math.floor(s / 86400)}д назад`;
}

export default function AdminImportsPage() {
  const [period, setPeriod] = useState('6h');
  const [status, setStatus] = useState<'all' | 'created' | 'skipped'>('all');
  const [reason, setReason] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period, status, reason, search,
        page: String(page),
        limit: '250',
      });
      const r = await fetch(`/api/admin/imports?${params.toString()}`);
      const d = await r.json();
      setRows(d.rows || []);
      setSummary(d.summary || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, status, reason, page]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => fetchData(), 15000);
    return () => clearInterval(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [autoRefresh, period, status, reason, page]);

  const skipReasonList = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.skipByReason).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Feed</h1>
          <p className="text-sm text-muted-foreground">
            Каждый пост из webhook'а с AI-решением — created/skipped и почему именно.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh((a) => !a)}
            className={`text-xs rounded px-3 py-1.5 border ${autoRefresh ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white border-gray-300'}`}
          >
            Auto-refresh {autoRefresh ? 'ON (15s)' : 'OFF'}
          </button>
          <button
            onClick={() => { setPage(1); fetchData(); }}
            className="text-xs rounded px-3 py-1.5 border bg-white border-gray-300 flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Всего за период</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{summary.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-green-700">✅ Создано</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{summary.created}</div>
              <div className="text-xs text-muted-foreground">{summary.total ? Math.round((100 * summary.created) / summary.total) : 0}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-red-700">❌ Отброшено</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{summary.skipped}</div>
              <div className="text-xs text-muted-foreground">{summary.total ? Math.round((100 * summary.skipped) / summary.total) : 0}%</div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Топ причины отказа</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              {skipReasonList.slice(0, 5).map(([rsn, n]) => (
                <div key={rsn} className="flex items-center justify-between">
                  <button
                    onClick={() => { setReason(rsn); setStatus('skipped'); setPage(1); }}
                    className="text-left hover:underline truncate"
                  >
                    {rsn}
                  </button>
                  <span className="font-mono ml-2">{n}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI rejection histogram (only meaningful when looking at "not_job_posting" or "all skipped") */}
      {summary && summary.aiReasonsTop.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🤖 За что AI режет «not_job_posting» (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              {summary.aiReasonsTop.slice(0, 10).map((r) => (
                <div key={r.aiReason} className="flex items-center gap-2">
                  <span className="font-mono w-12 text-right">{r.n}</span>
                  <div className="flex-1 bg-blue-50 rounded px-2 py-1 truncate" title={r.aiReason}>
                    {r.aiReason}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-2 items-center">
          <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} className="text-xs border rounded px-2 py-1.5">
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as 'all' | 'created' | 'skipped'); setPage(1); }} className="text-xs border rounded px-2 py-1.5">
            <option value="all">Все статусы</option>
            <option value="created">✅ Только созданные</option>
            <option value="skipped">❌ Только отброшенные</option>
          </select>
          <select value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }} className="text-xs border rounded px-2 py-1.5">
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div className="flex items-center gap-1 border rounded px-2 py-1">
            <Search className="h-3 w-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchData(); } }}
              placeholder="title или email"
              className="text-xs outline-none w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 px-2 w-20"></th>
                  <th className="py-2 px-2 w-24">Время</th>
                  <th className="py-2 px-2 w-24">Статус</th>
                  <th className="py-2 px-2">Title</th>
                  <th className="py-2 px-2 w-48">Email</th>
                  <th className="py-2 px-2 w-32">Причина</th>
                  <th className="py-2 px-2">AI пишет</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-1.5 px-2">
                        <button onClick={() => toggleExpand(row.id)} className="text-gray-400 hover:text-gray-700">
                          {expanded.has(row.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{timeAgo(row.createdAt)}</td>
                      <td className="py-1.5 px-2">
                        {row.status === 'created' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />created
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            <XCircle className="h-3 w-3 mr-1" />skipped
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {row.slug ? (
                          <Link href={`/freelance/${row.slug}`} target="_blank" className="text-blue-600 hover:underline">
                            {row.title || '(no title)'}
                          </Link>
                        ) : (
                          <span>{row.title || <span className="text-gray-400">(no title)</span>}</span>
                        )}
                        {row.status === 'created' && row.contentQuality && (
                          <Badge variant="outline" className="ml-2 text-[10px]">{row.contentQuality}</Badge>
                        )}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[11px] text-muted-foreground truncate max-w-[12rem]">
                        {row.applyEmail || '—'}
                      </td>
                      <td className="py-1.5 px-2">{row.reason}</td>
                      <td className="py-1.5 px-2 text-muted-foreground truncate max-w-md" title={row.aiReason || ''}>
                        {row.aiReason || '—'}
                      </td>
                    </tr>
                    {expanded.has(row.id) && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="py-2 px-4 text-[11px] text-muted-foreground">
                          <div className="space-y-1">
                            <div><span className="font-mono">id:</span> {row.id}</div>
                            <div><span className="font-mono">createdAt:</span> {row.createdAt}</div>
                            <div><span className="font-mono">status:</span> {row.status}</div>
                            {row.reason && <div><span className="font-mono">reason bucket:</span> {row.reason}</div>}
                            {row.aiReason && <div><span className="font-mono">AI:</span> {row.aiReason}</div>}
                            {row.author && <div><span className="font-mono">author:</span> {row.author}</div>}
                            {row.postUrl && (
                              <div>
                                <span className="font-mono">post:</span>{' '}
                                <a href={row.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{row.postUrl}</a>
                              </div>
                            )}
                            {row.excerpt && (
                              <div className="mt-1 p-2 bg-white border rounded text-gray-700 whitespace-pre-wrap max-w-2xl">
                                <span className="font-mono text-gray-400">excerpt:</span> {row.excerpt}
                              </div>
                            )}
                            {row.qualityScore !== null && <div><span className="font-mono">qualityScore:</span> {row.qualityScore}</div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Нет событий за выбранный период</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Загрузка...</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-xs">
            <div className="text-muted-foreground">
              Страница {page} • {rows.length} событий на этой странице
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 border rounded disabled:opacity-50"
              >
                ←
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={rows.length < 50 || loading}
                className="px-3 py-1.5 border rounded disabled:opacity-50"
              >
                →
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
