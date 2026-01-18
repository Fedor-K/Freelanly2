'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Mail,
  Send,
  CheckCircle,
  Eye,
  MousePointer,
  AlertTriangle,
  XCircle,
  Loader2,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface EmailStatsData {
  success: boolean;
  timestamp: string;
  resend: {
    totalEvents: number;
    hasData: boolean;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  alerts: {
    emailsSent: number;
    last7Days: number;
    last30Days: number;
    uniqueRecipients: number;
    avgJobsPerEmail: number;
    totalJobNotifications: number;
  };
  recentEvents: Array<{
    id: string;
    type: string;
    to: string;
    subject: string | null;
    timestamp: string;
    metadata: Record<string, unknown> | null;
  }>;
  chartData: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>;
}

const typeColors: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  OPENED: 'bg-purple-100 text-purple-700',
  CLICKED: 'bg-indigo-100 text-indigo-700',
  BOUNCED: 'bg-red-100 text-red-700',
  COMPLAINED: 'bg-orange-100 text-orange-700',
};

const typeIcons: Record<string, React.ReactNode> = {
  SENT: <Send className="h-4 w-4" />,
  DELIVERED: <CheckCircle className="h-4 w-4" />,
  OPENED: <Eye className="h-4 w-4" />,
  CLICKED: <MousePointer className="h-4 w-4" />,
  BOUNCED: <XCircle className="h-4 w-4" />,
  COMPLAINED: <AlertTriangle className="h-4 w-4" />,
};

export default function EmailStatsPage() {
  const [data, setData] = useState<EmailStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin/email-stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || 'Failed to load data');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-4">Email Statistics</h1>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <p className="text-red-600">Failed to load: {error}</p>
            <Button onClick={fetchData} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Email Statistics</h1>
          <p className="text-muted-foreground mt-1">
            Resend webhook events & job alert delivery
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Job Alert Emails */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Job Alert Emails
          </CardTitle>
          <CardDescription>Actual emails sent to users (one email = many jobs)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-blue-600">
                {data.alerts.emailsSent.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Emails Sent</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-600">
                {data.alerts.last7Days.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-purple-600">
                {data.alerts.uniqueRecipients.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Unique Recipients</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-orange-600">
                ~{data.alerts.avgJobsPerEmail}
              </p>
              <p className="text-sm text-muted-foreground">Jobs per Email</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Total job notifications: {data.alerts.totalJobNotifications.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* Resend Webhook Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resend Webhook Events (30 days)
          </CardTitle>
          <CardDescription>
            {data.resend.hasData
              ? `${data.resend.totalEvents.toLocaleString()} total events tracked`
              : 'No webhook events yet. Configure webhook in Resend Dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.resend.hasData ? (
            <div className="space-y-6">
              {/* Event counts */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <Send className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-600">{data.resend.sent.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-600">{data.resend.delivered.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <Eye className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-600">{data.resend.opened.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Opened</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg text-center">
                  <MousePointer className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-indigo-600">{data.resend.clicked.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Clicked</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-600">{data.resend.bounced}</p>
                  <p className="text-xs text-muted-foreground">Bounced</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-orange-600">{data.resend.complained}</p>
                  <p className="text-xs text-muted-foreground">Complaints</p>
                </div>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${data.resend.deliveryRate >= 95 ? 'text-green-600' : data.resend.deliveryRate >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend.deliveryRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Delivery Rate</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${data.resend.openRate >= 20 ? 'text-green-600' : data.resend.openRate >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend.openRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${data.resend.clickRate >= 5 ? 'text-green-600' : data.resend.clickRate >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend.clickRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Click Rate</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${data.resend.bounceRate <= 2 ? 'text-green-600' : data.resend.bounceRate <= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.resend.bounceRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Bounce Rate</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No Resend webhook data yet</p>
              <p className="text-sm mt-2">
                Configure webhook in Resend Dashboard pointing to:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                https://freelanly.com/api/webhooks/resend
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Events
          </CardTitle>
          <CardDescription>Last 20 email events from Resend</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${typeColors[event.type] || 'bg-gray-100'}`}>
                    {typeIcons[event.type]}
                    {event.type}
                  </span>
                  <span className="text-sm truncate flex-1" title={event.to}>
                    {event.to}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No events recorded yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timestamp */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
