'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, XCircle, TrendingDown, MessageSquare, AlertTriangle } from 'lucide-react';

interface ReasonStat {
  reason: string;
  label: string;
  count: number;
  percent: string;
}

interface FeedbackItem {
  id: string;
  email: string;
  reason: string;
  otherText: string | null;
  feedback: string | null;
  plan: string | null;
  createdAt: string;
}

interface FeedbackData {
  stats: {
    total: number;
    byReason: ReasonStat[];
  };
  recentFeedback: FeedbackItem[];
}

function ReasonBar({ label, count, percent, total }: { label: string; count: number; percent: string; total: number }) {
  const width = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{count} ({percent}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-red-500 rounded-full transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function CancellationsPage() {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/cancellation-feedback');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Failed to fetch cancellation feedback:', err);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Cancellation Feedback</h1>
        <p className="text-muted-foreground">Loading feedback data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Cancellation Feedback</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!data || data.stats.total === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Cancellation Feedback</h1>
            <p className="text-muted-foreground mt-1">
              Track why users cancel their subscriptions
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No cancellations yet</p>
              <p className="text-muted-foreground">
                Great news! No users have cancelled their subscriptions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find top reason
  const topReason = data.stats.byReason[0];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Cancellation Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Track why users cancel their subscriptions
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cancellations</p>
                <p className="text-3xl font-bold mt-1">{data.stats.total}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Reason</p>
                <p className="text-xl font-bold mt-1">{topReason?.label || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{topReason?.percent}% of cancellations</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Feedback</p>
                <p className="text-3xl font-bold mt-1">
                  {data.recentFeedback.filter(f => f.feedback || f.otherText).length}
                </p>
                <p className="text-sm text-muted-foreground">detailed comments</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reasons Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Cancellation Reasons</CardTitle>
          <CardDescription>Why users are leaving</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.stats.byReason.map((reason) => (
              <ReasonBar
                key={reason.reason}
                label={reason.label}
                count={reason.count}
                percent={reason.percent}
                total={data.stats.total}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
          <CardDescription>Latest cancellations with user comments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Date</th>
                  <th className="text-left py-3 px-2 font-medium">User</th>
                  <th className="text-left py-3 px-2 font-medium">Plan</th>
                  <th className="text-left py-3 px-2 font-medium">Reason</th>
                  <th className="text-left py-3 px-2 font-medium">Comments</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFeedback.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2">
                      <span className="font-mono text-xs">{item.email}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        item.plan === 'annual' ? 'bg-purple-100 text-purple-700' :
                        item.plan === 'monthly' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.plan || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-2">{item.reason}</td>
                    <td className="py-3 px-2 max-w-xs">
                      {item.otherText && (
                        <p className="text-muted-foreground italic">&quot;{item.otherText}&quot;</p>
                      )}
                      {item.feedback && (
                        <p className="text-muted-foreground">{item.feedback}</p>
                      )}
                      {!item.otherText && !item.feedback && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
