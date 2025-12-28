'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface FilteredJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  reason: string;
}

interface AddedJob {
  id: string;
  title: string;
  slug: string;
  companyName: string;
  companySlug: string;
}

interface ImportRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  totalFetched: number;
  totalNew: number;
  totalSkipped: number;
  addedJobs: AddedJob[];
  filteredJobs: FilteredJob[];
}

interface SourceGroup {
  sourceType: string;
  companyName: string | null;
  companySlug: string | null;
  dataSourceId: string | null;
  totalRuns: number;
  lastRunAt: string | null;
  totalAdded: number;
  totalFiltered: number;
  runs: ImportRun[];
}

const FILTER_REASON_LABELS: Record<string, string> = {
  NON_TARGET_TITLE: 'non-target title',
  PHYSICAL_LOCATION: 'physical location',
  DUPLICATE: 'duplicate',
  SIMILAR_EXISTS: 'similar exists',
  NO_TITLE: 'no title extracted',
  NO_EMAIL: 'no corporate email',
  SPAM: 'spam/announcement',
  OTHER: 'other',
};

export default function ParsingDashboardPage() {
  const [data, setData] = useState<SourceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/parsing');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded(key: string) {
    const newSet = new Set(expandedSources);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedSources(newSet);
  }

  function formatTime(dateStr: string | null) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}м назад`;
    }
    if (diffHours < 24) {
      return `${diffHours}ч назад`;
    }
    if (diffDays < 7) {
      return `${diffDays}д назад`;
    }
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  }

  function getSourceKey(group: SourceGroup) {
    return group.dataSourceId || `${group.sourceType}_aggregator`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Error: {error}</p>
        <Button onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Parsing Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor job parsing: what was added vs filtered (last 20 days)
        </p>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No parsing data yet. Run an import to see stats here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((group) => {
            const key = getSourceKey(group);
            const isExpanded = expandedSources.has(key);

            return (
              <Card key={key} className="overflow-hidden">
                {/* Header row - clickable */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpanded(key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>

                    <Badge variant="outline" className="font-mono text-xs">
                      {group.sourceType}
                    </Badge>

                    <div className="font-medium">
                      {group.companyName || '(Aggregator)'}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">{group.totalRuns}</span> прогонов
                    </div>

                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatDate(group.lastRunAt)}
                    </div>

                    <div className="text-sm">
                      <span className="text-green-600 font-medium">+{group.totalAdded}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-muted-foreground">-{group.totalFiltered}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t bg-muted/30 px-4 py-4">
                    {group.runs.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No runs recorded yet</p>
                    ) : (
                      <div className="space-y-4">
                        {group.runs.map((run) => (
                          <div key={run.id} className="bg-background rounded-lg p-4 border">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={run.status === 'COMPLETED' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {run.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(run.startedAt).toLocaleDateString('ru-RU')} в{' '}
                                  {formatTime(run.startedAt)}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Fetched: {run.totalFetched} | New: {run.totalNew} | Skipped: {run.totalSkipped}
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              {/* Added jobs */}
                              <div>
                                <h4 className="text-sm font-medium text-green-700 mb-2">
                                  Added ({run.addedJobs.length})
                                </h4>
                                {run.addedJobs.length > 0 ? (
                                  <div className="space-y-1 max-h-64 overflow-y-auto">
                                    {run.addedJobs.map((job) => (
                                      <a
                                        key={job.id}
                                        href={`/company/${job.companySlug}/jobs/${job.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm py-1.5 px-2 hover:bg-green-50 rounded transition-colors group"
                                      >
                                        <span className="truncate flex-1">{job.title}</span>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">—</p>
                                )}
                              </div>

                              {/* Skipped jobs */}
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                  Skipped ({run.filteredJobs.length})
                                </h4>
                                {run.filteredJobs.length > 0 ? (
                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {run.filteredJobs.map((job) => (
                                      <div key={job.id} className="py-1.5 px-2">
                                        <div className="text-sm truncate">{job.title}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {FILTER_REASON_LABELS[job.reason] || job.reason}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">—</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
