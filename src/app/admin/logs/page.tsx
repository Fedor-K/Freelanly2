'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface ImportLog {
  id: string;
  source: string;
  status: string;
  totalFetched: number;
  totalNew: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  errors: string[] | null;
  startedAt: string;
  completedAt: string | null;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?page=${page}&limit=${perPage}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / perPage);

  function getStatusIcon(status: string) {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'RUNNING':
        return <Clock className="h-5 w-5 text-yellow-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-yellow-100 text-yellow-800">Running</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Import Logs</h1>
          <p className="text-muted-foreground mt-1">
            {total.toLocaleString()} total import runs
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading logs...</p>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No import logs yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(log.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{log.source}</span>
                        {getStatusBadge(log.status)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                        <div>
                          <span className="text-muted-foreground">Fetched:</span>{' '}
                          <span className="font-medium">{log.totalFetched ?? '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">New:</span>{' '}
                          <span className="font-medium text-green-600">{log.totalNew ?? '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Skipped:</span>{' '}
                          <span className="font-medium text-yellow-600">{log.totalSkipped ?? '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed:</span>{' '}
                          <span className="font-medium text-red-600">{log.totalFailed ?? '-'}</span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Started: {new Date(log.startedAt).toLocaleString()}
                        {log.completedAt && (
                          <span> | Completed: {new Date(log.completedAt).toLocaleString()}</span>
                        )}
                      </div>

                      {log.errors && log.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-red-600 cursor-pointer">
                            {log.errors.length} error(s)
                          </summary>
                          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 max-h-40 overflow-y-auto">
                            {log.errors.slice(0, 10).map((error, i) => (
                              <div key={i} className="mb-1">
                                {error}
                              </div>
                            ))}
                            {log.errors.length > 10 && (
                              <div className="text-red-500">
                                ... and {log.errors.length - 10} more
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
