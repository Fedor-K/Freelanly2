'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Building2, Calendar, Filter } from 'lucide-react';
import Link from 'next/link';

interface Job {
  id: string;
  title: string;
  slug: string;
  source: string | null;
  createdAt: string;
  company: {
    name: string;
    slug: string;
  };
  category: {
    name: string;
    slug: string;
  } | null;
}

type TimeFilter = '24h' | '7d' | '30d' | 'all';
type SourceFilter = 'all' | 'LEVER' | 'LINKEDIN';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchJobs();
  }, [timeFilter, sourceFilter]);

  async function fetchJobs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('time', timeFilter);
      if (sourceFilter !== 'all') {
        params.set('source', sourceFilter);
      }

      const res = await fetch(`/api/admin/jobs?${params}`);
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  const timeFilterLabels: Record<TimeFilter, string> = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    'all': 'All time',
  };

  const sourceColors: Record<string, string> = {
    LEVER: 'bg-blue-100 text-blue-800',
    LINKEDIN: 'bg-sky-100 text-sky-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Jobs</h1>
        <div className="text-sm text-muted-foreground">
          {total.toLocaleString()} jobs found
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {/* Time Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Period:</span>
            <div className="flex gap-1">
              {(Object.keys(timeFilterLabels) as TimeFilter[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setTimeFilter(key)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeFilter === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {key === '24h' ? '24h' : key === '7d' ? '7d' : key === '30d' ? '30d' : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Source:</span>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'LEVER', 'LINKEDIN'] as SourceFilter[]).map((source) => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    sourceFilter === source
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {source === 'all' ? 'All' : source}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No jobs found for selected filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Job Title</th>
                    <th className="text-left p-3 text-sm font-medium">Company</th>
                    <th className="text-left p-3 text-sm font-medium">Category</th>
                    <th className="text-left p-3 text-sm font-medium">Source</th>
                    <th className="text-left p-3 text-sm font-medium">Added</th>
                    <th className="text-left p-3 text-sm font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <span className="font-medium">{job.title}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{job.company.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">
                          {job.category?.name || '—'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${sourceColors[job.source || ''] || 'bg-gray-100 text-gray-800'}`}>
                          {job.source || 'unknown'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(job.createdAt)}
                        </div>
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/company/${job.company.slug}/jobs/${job.slug}`}
                          target="_blank"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
