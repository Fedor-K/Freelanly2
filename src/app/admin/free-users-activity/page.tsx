'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Loader2,
  Users,
  MousePointer,
  Mail,
  Crown,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface SegmentAverage {
  segment: string;
  users: number;
  totalEmails: number;
  totalClicks: number;
  avgEmails: number;
  avgClicks: number;
}

interface HotFreeUser {
  email: string;
  registered: string;
  emails: number;
  clicks: number;
  lastClick: string | null;
  daysOnPlatform: number;
  freelanceClicks: number;
  jobClicks: number;
}

interface DecayPoint {
  emailNum: number;
  recipients: number;
  clickers: number;
  clickerPct: number;
}

interface ContentSegment {
  segment: string;
  freelance: number;
  jobs: number;
  other: number;
  total: number;
  freelancePct: number;
  jobsPct: number;
  otherPct: number;
}

interface ProOtherLink {
  link: string;
  clicks: number;
  users: number;
}

interface Data {
  segmentAverages: SegmentAverage[];
  hotFreeUsers: HotFreeUser[];
  decayCurve: DecayPoint[];
  contentBreakdown: ContentSegment[];
  proOtherLinks: ProOtherLink[];
}

export default function FreeUsersActivityPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/free-users-activity');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const free = data?.segmentAverages?.find((s) => s.segment === 'FREE');
  const pro = data?.segmentAverages?.find((s) => s.segment === 'PRO');
  const freeContent = data?.contentBreakdown?.find((c) => c.segment === 'FREE');
  const proContent = data?.contentBreakdown?.find((c) => c.segment === 'PRO');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FREE Users Activity</h1>
          <p className="text-muted-foreground">
            Почему FREE юзеры не покупают PRO — анализ email-активности
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Block 1: Segment Averages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  FREE юзеры
                </CardTitle>
                <CardDescription>{free?.users ?? 0} юзеров получали письма</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-3xl font-bold">{free?.avgEmails ?? 0}</p>
                    <p className="text-sm text-muted-foreground">писем на юзера (ср.)</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{free?.avgClicks ?? 0}</p>
                    <p className="text-sm text-muted-foreground">кликов на юзера (ср.)</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Всего: {free?.totalEmails?.toLocaleString() ?? 0} писем, {free?.totalClicks?.toLocaleString() ?? 0} кликов
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  PRO юзеры (до покупки)
                </CardTitle>
                <CardDescription>{pro?.users ?? 0} юзеров — события до proStartedAt</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-3xl font-bold">{pro?.avgEmails ?? 0}</p>
                    <p className="text-sm text-muted-foreground">писем на юзера (ср.)</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{pro?.avgClicks ?? 0}</p>
                    <p className="text-sm text-muted-foreground">кликов на юзера (ср.)</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Всего: {pro?.totalEmails?.toLocaleString() ?? 0} писем, {pro?.totalClicks?.toLocaleString() ?? 0} кликов
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Block 2: Hot FREE Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MousePointer className="h-5 w-5" />
                Топ-50 горячих FREE юзеров
              </CardTitle>
              <CardDescription>
                Кликали по ссылкам из писем, но не купили PRO
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4 text-right">Писем</th>
                      <th className="pb-2 pr-4 text-right">Кликов</th>
                      <th className="pb-2 pr-4 text-right">Фриланс</th>
                      <th className="pb-2 pr-4 text-right">Вакансии</th>
                      <th className="pb-2 pr-4">Последний клик</th>
                      <th className="pb-2 text-right">Дней на платформе</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.hotFreeUsers?.map((u, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{u.email}</td>
                        <td className="py-2 pr-4 text-right">{u.emails}</td>
                        <td className="py-2 pr-4 text-right font-medium">{u.clicks}</td>
                        <td className="py-2 pr-4 text-right">{u.freelanceClicks}</td>
                        <td className="py-2 pr-4 text-right">{u.jobClicks}</td>
                        <td className="py-2 pr-4 text-xs">
                          {u.lastClick
                            ? new Date(u.lastClick).toLocaleDateString('ru-RU')
                            : '—'}
                        </td>
                        <td className="py-2 text-right">{u.daysOnPlatform}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!data?.hotFreeUsers || data.hotFreeUsers.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">Нет данных</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Block 3: Decay Curve */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Кривая затухания
              </CardTitle>
              <CardDescription>
                Сколько FREE юзеров получили N-е письмо, и какой % из них когда-либо кликал
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.decayCurve && data.decayCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={data.decayCurve}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="emailNum"
                      label={{ value: 'Номер письма', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis yAxisId="left" label={{ value: 'Юзеров', angle: -90, position: 'insideLeft' }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: '% кликеров', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="recipients"
                      stroke="#8884d8"
                      name="Получили"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="clickers"
                      stroke="#82ca9d"
                      name="Кликеры"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="clickerPct"
                      stroke="#ff7300"
                      name="% кликеров"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Нет данных</p>
              )}
            </CardContent>
          </Card>

          {/* Block 4: Content Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Контент кликов: FREE vs PRO
              </CardTitle>
              <CardDescription>
                На что кликают FREE и PRO (до покупки): фриланс, вакансии, другое
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.contentBreakdown && data.contentBreakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={data.contentBreakdown}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" unit="%" />
                      <YAxis type="category" dataKey="segment" width={50} />
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Legend />
                      <Bar dataKey="freelancePct" name="Фриланс" fill="#8884d8" stackId="a" />
                      <Bar dataKey="jobsPct" name="Вакансии" fill="#82ca9d" stackId="a" />
                      <Bar dataKey="otherPct" name="Другое" fill="#ffc658" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    {[freeContent, proContent].map(
                      (c) =>
                        c && (
                          <div key={c.segment} className="space-y-1">
                            <p className="font-medium">
                              {c.segment} ({c.total} кликов)
                            </p>
                            <p>Фриланс: {c.freelance} ({c.freelancePct}%)</p>
                            <p>Вакансии: {c.jobs} ({c.jobsPct}%)</p>
                            <p>Другое: {c.other} ({c.otherPct}%)</p>
                          </div>
                        )
                    )}
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">Нет данных</p>
              )}
            </CardContent>
          </Card>

          {/* Block 5: PRO "Other" Links Detail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                PRO: на что кликали до покупки (все ссылки)
              </CardTitle>
              <CardDescription>
                Конкретные URL, по которым кликали будущие PRO-юзеры перед оплатой
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Ссылка</th>
                      <th className="pb-2 pr-4 text-right">Кликов</th>
                      <th className="pb-2 text-right">Юзеров</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.proOtherLinks?.map((l, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-4 font-mono text-xs max-w-md truncate">
                          {l.link}
                        </td>
                        <td className="py-2 pr-4 text-right font-medium">{l.clicks}</td>
                        <td className="py-2 text-right">{l.users}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!data?.proOtherLinks || data.proOtherLinks.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">Нет данных</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
