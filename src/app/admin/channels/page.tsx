'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChannelRow {
  channel: string;
  registrations: number;
  pro: number;
  convRate: number;
  alerts: number;
  revenue: number;
}

interface TrendPoint {
  date: string;
  channel: string;
  count: number;
}

interface ChannelStats {
  channels: ChannelRow[];
  trend: TrendPoint[];
  days: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  linkedin: '#0A66C2',
  telegram: '#26A5E4',
  twitter: '#1DA1F2',
  job_alert: '#F59E0B',
  google: '#34A853',
  direct: '#6B7280',
};

function getColor(channel: string) {
  return CHANNEL_COLORS[channel] || '#8B5CF6';
}

export default function ChannelsPage() {
  const [data, setData] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/channel-stats?days=${days}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch channel stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Pivot trend data for recharts: { date, linkedin: 5, telegram: 3, ... }
  const chartData = (() => {
    if (!data?.trend) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const t of data.trend) {
      if (!dateMap.has(t.date)) dateMap.set(t.date, {});
      dateMap.get(t.date)![t.channel] = t.count;
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, channels]) => ({ date, ...channels }));
  })();

  const allChannels = data?.channels.map(c => c.channel) || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-muted-foreground">Registration source tracking & channel performance</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {data.channels.reduce((s, c) => s + c.registrations, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Total Registrations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {data.channels.reduce((s, c) => s + c.pro, 0)}
              </div>
              <p className="text-xs text-muted-foreground">PRO Conversions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {data.channels.length}
              </div>
              <p className="text-xs text-muted-foreground">Channels</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                ${data.channels.reduce((s, c) => s + c.revenue, 0).toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Channel Table */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Channel</th>
                    <th className="pb-3 font-medium text-right">Registrations</th>
                    <th className="pb-3 font-medium text-right">PRO</th>
                    <th className="pb-3 font-medium text-right">Conv %</th>
                    <th className="pb-3 font-medium text-right">Alerts</th>
                    <th className="pb-3 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.map(ch => (
                    <tr key={ch.channel} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getColor(ch.channel) }}
                          />
                          <span className="font-medium">{ch.channel}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">{ch.registrations}</td>
                      <td className="py-3 text-right">{ch.pro}</td>
                      <td className="py-3 text-right">{ch.convRate}%</td>
                      <td className="py-3 text-right">{ch.alerts}</td>
                      <td className="py-3 text-right">${ch.revenue.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registration Trend by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                {allChannels.map(ch => (
                  <Line
                    key={ch}
                    type="monotone"
                    dataKey={ch}
                    stroke={getColor(ch)}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
