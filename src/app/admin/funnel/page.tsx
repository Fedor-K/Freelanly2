'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ArrowLeft, TrendingDown } from 'lucide-react';
import Link from 'next/link';

interface FunnelStep {
  step: number;
  action: string;
  label: string;
  count: number;
  percent: number;
}

interface FunnelData {
  days: number;
  since: string;
  funnel: FunnelStep[];
}

const PERIOD_OPTIONS = [
  { value: 1, label: 'Сегодня' },
  { value: 7, label: '7 дней' },
  { value: 14, label: '14 дней' },
  { value: 30, label: '30 дней' },
];

export default function FunnelPage() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/funnel?days=${days}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch funnel:', error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  const maxCount = data?.funnel[0]?.count || 1;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Админка
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingDown className="h-6 w-6" />
              Воронка конверсии
            </h1>
            <p className="text-muted-foreground text-sm">
              Полный путь пользователя — от визита до оплаты
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFunnel} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={days === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Funnel chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            10 шагов от визита до оплаты
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          ) : data ? (
            <div className="space-y-3">
              {data.funnel.map((step, index) => {
                const barWidth = Math.max((step.count / maxCount) * 100, 2);
                const prevCount = index > 0 ? data.funnel[index - 1].count : step.count;
                const dropoff = prevCount > 0 && step.count < prevCount && step.count > 0
                  ? Math.round((1 - step.count / prevCount) * 100)
                  : 0;

                return (
                  <div key={step.step} className="group">
                    {/* Step label row */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-5">
                          {step.step}
                        </span>
                        <span className="text-sm font-medium">{step.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {dropoff > 0 && (
                          <span className="text-xs text-red-500">
                            -{dropoff}%
                          </span>
                        )}
                        <Badge variant="secondary" className="font-mono text-xs">
                          {step.percent}%
                        </Badge>
                        <span className="text-sm font-bold w-16 text-right">
                          {step.count.toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="h-8 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full bg-black rounded-md transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${barWidth}%` }}
                      >
                        {barWidth > 15 && (
                          <span className="text-white text-xs font-bold">
                            {step.count.toLocaleString('ru-RU')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Нет данных</p>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <p className="text-xs text-muted-foreground text-center">
        Данные собираются с {data?.since ? new Date(data.since).toLocaleDateString('ru-RU') : '...'}.
        Трекинг начал работать 20.03.2026 — исторические данные недоступны.
      </p>
    </div>
  );
}
