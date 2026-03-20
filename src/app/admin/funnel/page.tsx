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

      {/* Funnel chart — horizontal bars side by side */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            10 шагов от визита до оплаты
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="animate-pulse h-80 bg-muted rounded" />
          ) : data ? (
            <div className="overflow-x-auto pb-2">
              {/* Chart area with gray background */}
              <div className="bg-gray-50 rounded-lg p-4 min-w-[700px]">
                {/* Bars */}
                <div className="flex items-end gap-2" style={{ height: 280 }}>
                  {data.funnel.map((step) => {
                    const barHeight = maxCount > 0 ? Math.max((step.count / maxCount) * 100, 2) : 2;

                    return (
                      <div key={step.step} className="flex-1 flex flex-col items-center h-full justify-end">
                        {/* Percent + count label above bar */}
                        <div className="text-center mb-1 shrink-0">
                          <div className="text-xs sm:text-sm font-bold whitespace-nowrap">
                            {step.percent}%
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">
                            {step.count.toLocaleString('ru-RU')}
                          </div>
                        </div>
                        {/* Bar */}
                        <div
                          className="w-full bg-black rounded-t transition-all duration-500 min-h-[4px]"
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* Labels below bars */}
                <div className="flex gap-2 mt-2 border-t pt-2">
                  {data.funnel.map((step) => (
                    <div key={step.step} className="flex-1 text-center">
                      <div className="text-[9px] sm:text-[10px] leading-tight text-muted-foreground">
                        {step.step} {step.label.toLowerCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
