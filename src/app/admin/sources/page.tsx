'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Linkedin,
  Plus,
  Play,
  Trash2,
  Building2,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Pause,
  PlayCircle,
  Tag,
  X,
  ArrowUpDown,
  Filter,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  sourceType: string;
  companySlug: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  totalImported: number;
  lastCreated: number;
  lastSkipped: number;
  lastFetched: number;
  lastError: string | null;
  errorCount: number;
  // New scoring fields
  tags: string[];
  score: number | null;
  conversionRate: number | null;
  qualityStatus: string | null;
  weeklyImported: number;
  lastScoreAt: string | null;
}

interface Overview {
  total: number;
  active: number;
  paused: number;
  withErrors: number;
  byQuality: {
    high: number;
    medium: number;
    low: number;
    unscored: number;
  };
  totalImported: number;
  weeklyImported: number;
}

interface BulkValidationResult {
  slug: string;
  valid: boolean;
  jobCount?: number;
  error?: string;
  added?: boolean;
}

interface SkippedJob {
  id: string;
  title: string;
  reason: string;
}

interface AddedJob {
  id: string;
  title: string;
  slug: string;
  companySlug: string;
}

interface ParsingDetails {
  addedJobs: AddedJob[];
  skippedJobs: SkippedJob[];
}

const FILTER_REASON_LABELS: Record<string, string> = {
  NON_TARGET_TITLE: 'non-target title',
  PHYSICAL_LOCATION: 'physical location',
  DUPLICATE: 'duplicate',
  SIMILAR_EXISTS: 'similar exists',
  NO_TITLE: 'no title extracted',
  NO_EMAIL: 'no corporate email',
  SPAM: 'spam/announcement',
  TOO_OLD: 'older than 7 days',
  OTHER: 'other',
};

const QUALITY_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
};

export default function SourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [companySlugsInput, setCompanySlugsInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkValidationResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [parsingDetails, setParsingDetails] = useState<Record<string, ParsingDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  // Filter & Sort state
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterQuality, setFilterQuality] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<string>('asc');

  // Bulk operations state
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  // Tag input state
  const [newTagInput, setNewTagInput] = useState<Record<string, string>>({});

  // Bulk run progress state
  const [bulkRunProgress, setBulkRunProgress] = useState<{
    isRunning: boolean;
    currentIndex: number;
    totalCount: number;
    currentSourceName: string;
    stats: {
      created: number;
      skipped: number;
      failed: number;
      errors: string[];
    };
    startTime: number;
    cancelRequested: boolean;
  } | null>(null);

  const cancelRequestedRef = useRef(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Discovery state
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState('site:jobs.lever.co');
  const [discoveryMaxPages, setDiscoveryMaxPages] = useState(10);
  const [discoveryProgress, setDiscoveryProgress] = useState<{
    status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
    currentPage: number;
    totalPages: number;
    foundSlugs: string[];
    newSlugs: string[];
    existingSlugs: string[];
    errors: string[];
    startTime: number;
  } | null>(null);
  const [addingDiscovered, setAddingDiscovered] = useState(false);
  const [selectedDiscoveredSlugs, setSelectedDiscoveredSlugs] = useState<Set<string>>(new Set());

  // Timer for elapsed time
  useEffect(() => {
    if (!bulkRunProgress?.isRunning) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - bulkRunProgress.startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [bulkRunProgress?.isRunning, bulkRunProgress?.startTime]);

  useEffect(() => {
    fetchSources();
  }, [filterStatus, filterQuality, filterTag, sortBy, sortOrder]);

  async function fetchSources() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterQuality !== 'all') params.set('quality', filterQuality);
      if (filterTag !== 'all') params.set('tag', filterTag);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/admin/sources?${params}`);
      const data = await res.json();
      setSources(data.sources || []);
      setOverview(data.overview || null);
      setAvailableTags(data.availableTags || []);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchParsingDetails(sourceId: string) {
    if (parsingDetails[sourceId]) return;

    setLoadingDetails(sourceId);
    try {
      const res = await fetch(`/api/admin/parsing?dataSourceId=${sourceId}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        const group = data.data[0];
        const lastRun = group.runs[0];
        if (lastRun) {
          setParsingDetails(prev => ({
            ...prev,
            [sourceId]: {
              addedJobs: lastRun.addedJobs || [],
              skippedJobs: lastRun.filteredJobs || [],
            },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch parsing details:', error);
    } finally {
      setLoadingDetails(null);
    }
  }

  function toggleExpanded(sourceId: string) {
    if (expandedSourceId === sourceId) {
      setExpandedSourceId(null);
    } else {
      setExpandedSourceId(sourceId);
      fetchParsingDetails(sourceId);
    }
  }

  function parseSlugs(input: string): string[] {
    return input
      .split(/[,\n\r]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  async function validateBulk() {
    const slugs = parseSlugs(companySlugsInput);
    if (slugs.length === 0) return;

    setValidating(true);
    setBulkResults([]);

    const results: BulkValidationResult[] = [];

    for (const slug of slugs) {
      const existingSource = sources.find(s => s.companySlug === slug);
      if (existingSource) {
        results.push({ slug, valid: false, error: 'Already added' });
        setBulkResults([...results]);
        continue;
      }

      try {
        const res = await fetch('/api/admin/sources/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceType: 'LEVER', companySlug: slug }),
        });
        const data = await res.json();
        results.push({ slug, valid: data.valid, jobCount: data.jobCount, error: data.error });
      } catch (error) {
        results.push({ slug, valid: false, error: String(error) });
      }
      setBulkResults([...results]);
    }

    setValidating(false);
  }

  async function addValidSources() {
    const validSlugs = bulkResults.filter(r => r.valid && !r.added);
    if (validSlugs.length === 0) return;

    setSaving(true);

    for (const result of validSlugs) {
      try {
        const res = await fetch('/api/admin/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: 'LEVER',
            companySlug: result.slug,
            name: result.slug,
          }),
        });

        if (res.ok) {
          result.added = true;
          setBulkResults([...bulkResults]);
        }
      } catch (error) {
        console.error('Failed to add source:', result.slug, error);
      }
    }

    setSaving(false);
    fetchSources();
  }

  async function runSource(sourceId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setRunningSourceId(sourceId);
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setParsingDetails(prev => {
          const newDetails = { ...prev };
          delete newDetails[sourceId];
          return newDetails;
        });
        alert(`Import completed: ${data.stats.created} created, ${data.stats.skipped} skipped, ${data.stats.failed} failed`);
        fetchSources();
        if (expandedSourceId === sourceId) {
          fetchParsingDetails(sourceId);
        }
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setRunningSourceId(null);
    }
  }

  async function deleteSource(sourceId: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete source "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/sources/${sourceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  }

  async function toggleSource(sourceId: string, isActive: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/admin/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchSources();
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
  }

  async function addTag(sourceId: string, tag: string) {
    if (!tag.trim()) return;
    try {
      await fetch(`/api/admin/sources/${sourceId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tag.trim() }),
      });
      setNewTagInput(prev => ({ ...prev, [sourceId]: '' }));
      fetchSources();
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  }

  async function removeTag(sourceId: string, tag: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/admin/sources/${sourceId}/tags?tag=${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      });
      fetchSources();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  }

  // Bulk operations
  async function bulkOperation(action: string, filter?: Record<string, unknown>) {
    setBulkLoading(action);
    try {
      const res = await fetch('/api/admin/sources/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, filter }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchSources();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setBulkLoading(null);
    }
  }

  // Run all active sources sequentially with progress
  async function runAllSourcesWithProgress() {
    // Get active sources
    const activeSources = sources.filter(s => s.isActive);
    if (activeSources.length === 0) {
      alert('No active sources to run');
      return;
    }

    // Reset cancel flag
    cancelRequestedRef.current = false;
    setElapsedTime(0);

    // Initialize progress state
    setBulkRunProgress({
      isRunning: true,
      currentIndex: 0,
      totalCount: activeSources.length,
      currentSourceName: activeSources[0].name,
      stats: { created: 0, skipped: 0, failed: 0, errors: [] },
      startTime: Date.now(),
      cancelRequested: false,
    });

    const stats = { created: 0, skipped: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < activeSources.length; i++) {
      // Check if cancel was requested
      if (cancelRequestedRef.current) {
        break;
      }

      const source = activeSources[i];

      // Update current source
      setBulkRunProgress(prev => prev ? {
        ...prev,
        currentIndex: i,
        currentSourceName: source.name,
      } : null);

      try {
        const res = await fetch(`/api/admin/sources/${source.id}/run`, {
          method: 'POST',
        });
        const data = await res.json();

        if (data.success) {
          stats.created += data.stats?.created || 0;
          stats.skipped += data.stats?.skipped || 0;
        } else {
          stats.failed++;
          stats.errors.push(`${source.name}: ${data.error}`);
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push(`${source.name}: ${String(error)}`);
      }

      // Update stats
      setBulkRunProgress(prev => prev ? {
        ...prev,
        stats: { ...stats },
      } : null);
    }

    // Complete
    setBulkRunProgress(prev => prev ? {
      ...prev,
      isRunning: false,
      currentIndex: cancelRequestedRef.current ? prev.currentIndex : activeSources.length,
      cancelRequested: cancelRequestedRef.current,
    } : null);

    // Refresh sources list
    fetchSources();
  }

  function cancelBulkRun() {
    cancelRequestedRef.current = true;
    setBulkRunProgress(prev => prev ? {
      ...prev,
      cancelRequested: true,
    } : null);
  }

  function closeBulkRunProgress() {
    setBulkRunProgress(null);
    cancelRequestedRef.current = false;
  }

  // Discovery functions
  async function startDiscovery() {
    try {
      const res = await fetch('/api/admin/sources/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          searchQuery: discoveryQuery,
          maxPages: discoveryMaxPages,
        }),
      });

      if (res.ok) {
        setDiscoveryProgress({
          status: 'running',
          currentPage: 0,
          totalPages: discoveryMaxPages,
          foundSlugs: [],
          newSlugs: [],
          existingSlugs: [],
          errors: [],
          startTime: Date.now(),
        });
        // Start polling for progress
        pollDiscoveryProgress();
      }
    } catch (error) {
      console.error('Failed to start discovery:', error);
    }
  }

  async function pollDiscoveryProgress() {
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/sources/discover');
        const data = await res.json();

        if (data.progress) {
          setDiscoveryProgress(data.progress);

          if (data.progress.status === 'running') {
            setTimeout(poll, 1000);
          } else {
            // Discovery completed, update selected slugs to include all new ones
            setSelectedDiscoveredSlugs(new Set(data.progress.newSlugs));
          }
        }
      } catch (error) {
        console.error('Failed to poll discovery progress:', error);
      }
    };

    poll();
  }

  async function cancelDiscovery() {
    try {
      await fetch('/api/admin/sources/discover', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to cancel discovery:', error);
    }
  }

  async function addDiscoveredSources() {
    const slugsToAdd = Array.from(selectedDiscoveredSlugs);
    if (slugsToAdd.length === 0) return;

    setAddingDiscovered(true);
    try {
      const res = await fetch('/api/admin/sources/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          slugs: slugsToAdd,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchSources();
        setDiscoveryProgress(null);
        setSelectedDiscoveredSlugs(new Set());
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setAddingDiscovered(false);
    }
  }

  function toggleDiscoveredSlug(slug: string) {
    setSelectedDiscoveredSlugs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  }

  function selectAllNewSlugs() {
    if (discoveryProgress?.newSlugs) {
      setSelectedDiscoveredSlugs(new Set(discoveryProgress.newSlugs));
    }
  }

  function deselectAllSlugs() {
    setSelectedDiscoveredSlugs(new Set());
  }

  const leverSources = sources.filter(s => s.sourceType === 'LEVER');

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatElapsedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Data Sources</h1>
        <p className="text-muted-foreground mt-1">
          Configure and manage job data sources
        </p>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{overview.total}</div>
              <div className="text-xs text-muted-foreground">Total Sources</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-green-600">{overview.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-gray-500">{overview.paused}</div>
              <div className="text-xs text-muted-foreground">Paused</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-red-600">{overview.withErrors}</div>
              <div className="text-xs text-muted-foreground">With Errors</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-green-600">{overview.byQuality.high}</div>
              <div className="text-xs text-muted-foreground">High Quality</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{overview.totalImported.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Imported</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-blue-600">+{overview.weeklyImported}</div>
              <div className="text-xs text-muted-foreground">This Week</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkOperation('recalculate-scores')}
          disabled={bulkLoading !== null}
        >
          {bulkLoading === 'recalculate-scores' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Recalculate Scores
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkOperation('enable', { isActive: false })}
          disabled={bulkLoading !== null}
        >
          {bulkLoading === 'enable' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <PlayCircle className="h-4 w-4 mr-2" />
          )}
          Enable All Paused
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkOperation('disable', { qualityStatus: 'low' })}
          disabled={bulkLoading !== null}
        >
          {bulkLoading === 'disable' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Pause className="h-4 w-4 mr-2" />
          )}
          Pause Low Quality
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm('Run ALL active sources? This may take a while.')) {
              runAllSourcesWithProgress();
            }
          }}
          disabled={bulkLoading !== null || bulkRunProgress?.isRunning}
        >
          <Play className="h-4 w-4 mr-2" />
          Run All Active
        </Button>
      </div>

      {/* Bulk Run Progress Modal */}
      {bulkRunProgress && (
        <Card className="mb-4 border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {bulkRunProgress.isRunning ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : bulkRunProgress.cancelRequested ? (
                    <XCircle className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span className="font-semibold">
                    {bulkRunProgress.isRunning
                      ? 'Running sources...'
                      : bulkRunProgress.cancelRequested
                      ? 'Cancelled'
                      : 'Completed'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {formatElapsedTime(elapsedTime)}
                  </span>
                  {bulkRunProgress.isRunning ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelBulkRun}
                      disabled={bulkRunProgress.cancelRequested}
                    >
                      {bulkRunProgress.cancelRequested ? 'Stopping...' : 'Cancel'}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={closeBulkRunProgress}>
                      Close
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground truncate max-w-[300px]">
                    {bulkRunProgress.isRunning ? bulkRunProgress.currentSourceName : 'Done'}
                  </span>
                  <span className="font-medium">
                    {bulkRunProgress.currentIndex + (bulkRunProgress.isRunning ? 1 : 0)} / {bulkRunProgress.totalCount}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${((bulkRunProgress.currentIndex + (bulkRunProgress.isRunning ? 0.5 : 0)) / bulkRunProgress.totalCount) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-semibold">+{bulkRunProgress.stats.created}</span>
                  <span className="text-muted-foreground">created</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-semibold">{bulkRunProgress.stats.skipped}</span>
                  <span className="text-muted-foreground">skipped</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-semibold">{bulkRunProgress.stats.failed}</span>
                  <span className="text-muted-foreground">failed</span>
                </div>
              </div>

              {/* Errors */}
              {bulkRunProgress.stats.errors.length > 0 && (
                <div className="text-sm">
                  <div className="text-red-600 font-medium mb-1">Errors:</div>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-muted-foreground">
                    {bulkRunProgress.stats.errors.slice(-5).map((err, i) => (
                      <div key={i} className="truncate">{err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Sorting */}
      <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterQuality}
            onChange={(e) => setFilterQuality(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All Quality</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {availableTags.length > 0 && (
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All Tags</option>
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="name">Name</option>
            <option value="score">Score</option>
            <option value="totalImported">Total Imported</option>
            <option value="lastRunAt">Last Run</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="text-sm px-2 py-1 border rounded hover:bg-muted"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Apify LinkedIn - hardcoded for now */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Sources</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/sources/apify">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Linkedin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Apify LinkedIn</CardTitle>
                      <CardDescription>LinkedIn Posts Search scraper</CardDescription>
                    </div>
                  </div>
                  <Badge>active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Last run: Today</span>
                  <span>Total imported: 1,234</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Lever Sources */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Lever ATS Companies ({leverSources.length})</h2>
          <div className="flex gap-2">
            <Button onClick={() => setShowDiscovery(!showDiscovery)} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Discover New
            </Button>
            <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Manual
            </Button>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Add Lever Companies</CardTitle>
              <CardDescription>
                Enter company slugs from their Lever careers page URLs (one per line or comma-separated).
                <br />
                Example: For https://jobs.lever.co/<strong>appen</strong>, enter &quot;appen&quot;
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companySlugs">Company Slugs</Label>
                  <Textarea
                    id="companySlugs"
                    placeholder="appen,
netflix,
stripe,
figma"
                    value={companySlugsInput}
                    onChange={(e) => {
                      setCompanySlugsInput(e.target.value);
                      setBulkResults([]);
                    }}
                    rows={5}
                    className="mt-1 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {parseSlugs(companySlugsInput).length} companies to check
                  </p>
                </div>

                <Button onClick={validateBulk} disabled={validating || parseSlugs(companySlugsInput).length === 0}>
                  {validating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Checking {bulkResults.length}/{parseSlugs(companySlugsInput).length}...
                    </>
                  ) : (
                    'Check All'
                  )}
                </Button>
              </div>

              {/* Bulk Results */}
              {bulkResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium">
                    Results: {bulkResults.filter(r => r.valid).length} valid, {bulkResults.filter(r => !r.valid).length} invalid
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
                    {bulkResults.map((result) => (
                      <div
                        key={result.slug}
                        className={`flex items-center justify-between text-sm p-1.5 rounded ${
                          result.added
                            ? 'bg-blue-50'
                            : result.valid
                            ? 'bg-green-50'
                            : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {result.added ? (
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          ) : result.valid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-mono">{result.slug}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {result.added
                            ? 'Added!'
                            : result.valid
                            ? `${result.jobCount} jobs`
                            : result.error}
                        </span>
                      </div>
                    ))}
                  </div>

                  {bulkResults.some(r => r.valid && !r.added) && (
                    <Button onClick={addValidSources} disabled={saving} className="mt-2">
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add {bulkResults.filter(r => r.valid && !r.added).length} Valid Sources
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Discovery Section */}
        {showDiscovery && (
          <Card className="mb-4 border-2 border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Discover Lever Companies
              </CardTitle>
              <CardDescription>
                Find new companies using Lever ATS by searching Google. Run the script locally and paste results below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Instructions */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">How to discover new companies:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Run the discovery script on your local machine or VPS:</li>
                    <code className="block bg-background rounded p-2 mt-1 mb-2 text-xs overflow-x-auto">
                      npx tsx scripts/discover-lever-companies.ts &quot;site:jobs.lever.co&quot; 20
                    </code>
                    <li>The script will output a list of company slugs</li>
                    <li>Copy the slugs and paste them in the <strong>Add Manual</strong> form above</li>
                  </ol>
                </div>

                {/* Search query examples */}
                <div className="text-sm">
                  <p className="font-medium mb-2">Example search queries:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-xs">site:jobs.lever.co</code>
                    <span className="text-muted-foreground text-xs">All companies</span>
                    <code className="bg-muted px-2 py-1 rounded text-xs">site:jobs.lever.co remote</code>
                    <span className="text-muted-foreground text-xs">Remote-friendly</span>
                    <code className="bg-muted px-2 py-1 rounded text-xs">site:jobs.lever.co software engineer</code>
                    <span className="text-muted-foreground text-xs">Tech companies</span>
                    <code className="bg-muted px-2 py-1 rounded text-xs">site:jobs.lever.co fintech</code>
                    <span className="text-muted-foreground text-xs">Fintech</span>
                    <code className="bg-muted px-2 py-1 rounded text-xs">site:jobs.lever.co healthcare</code>
                    <span className="text-muted-foreground text-xs">Healthcare</span>
                  </div>
                </div>

                {/* Quick tip */}
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Tip:</strong> Run multiple searches with different keywords to find more companies.
                    Each search returns ~100 results. Duplicates are automatically filtered when adding.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lever Sources List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : leverSources.length > 0 ? (
          <div className="space-y-2">
            {leverSources.map((source) => {
              const isExpanded = expandedSourceId === source.id;
              const details = parsingDetails[source.id];
              const isLoadingDetails = loadingDetails === source.id;

              return (
                <Card key={source.id} className="overflow-hidden">
                  {/* Header row - clickable */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpanded(source.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {source.name}
                          {source.qualityStatus && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${QUALITY_COLORS[source.qualityStatus] || ''}`}
                            >
                              {source.qualityStatus}
                            </Badge>
                          )}
                          {source.errorCount > 0 && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>jobs.lever.co/{source.companySlug}</span>
                          {source.tags.length > 0 && (
                            <div className="flex gap-1">
                              {source.tags.map(tag => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={(e) => removeTag(source.id, tag, e)}
                                >
                                  {tag}
                                  <X className="h-3 w-3 ml-1" />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Score */}
                      <div className="text-right min-w-[60px]">
                        <div className={`text-lg font-bold ${getScoreColor(source.score)}`}>
                          {source.score !== null ? source.score : '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">score</div>
                      </div>

                      {/* Stats */}
                      <div className="text-sm text-right min-w-[120px]">
                        <div className="text-muted-foreground">Last: {formatDate(source.lastRunAt)}</div>
                        <div>
                          {source.lastCreated > 0 ? (
                            <span className="text-green-600 font-medium">+{source.lastCreated}</span>
                          ) : source.lastRunAt ? (
                            <span className="text-muted-foreground">+0</span>
                          ) : null}
                          {source.lastRunAt && (
                            <>
                              <span className="text-muted-foreground mx-1">/</span>
                              <span className="text-muted-foreground">-{source.lastSkipped || 0}</span>
                            </>
                          )}
                          <span className="text-muted-foreground ml-2">({source.totalImported} total)</span>
                        </div>
                      </div>

                      <Badge
                        variant={source.isActive ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={(e) => toggleSource(source.id, source.isActive, e)}
                      >
                        {source.isActive ? 'active' : 'paused'}
                      </Badge>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => runSource(source.id, e)}
                          disabled={runningSourceId === source.id || !source.isActive}
                          title={!source.isActive ? 'Enable source first' : 'Run import'}
                        >
                          {runningSourceId === source.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className={`h-4 w-4 ${!source.isActive ? 'opacity-30' : ''}`} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => deleteSource(source.id, source.name, e)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-4">
                      {/* Tags management */}
                      <div className="mb-4 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Add tag..."
                          value={newTagInput[source.id] || ''}
                          onChange={(e) => setNewTagInput(prev => ({ ...prev, [source.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addTag(source.id, newTagInput[source.id] || '');
                            }
                          }}
                          className="w-32 h-8 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addTag(source.id, newTagInput[source.id] || '')}
                        >
                          Add
                        </Button>
                      </div>

                      {isLoadingDetails ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : details ? (
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Added jobs */}
                          <div>
                            <h4 className="text-sm font-medium text-green-700 mb-2">
                              Added ({details.addedJobs.length})
                            </h4>
                            {details.addedJobs.length > 0 ? (
                              <div className="space-y-1 max-h-64 overflow-y-auto">
                                {details.addedJobs.map((job) => (
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
                              Skipped ({details.skippedJobs.length})
                            </h4>
                            {details.skippedJobs.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {details.skippedJobs.map((job) => (
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
                      ) : (
                        <p className="text-sm text-muted-foreground">No parsing data available</p>
                      )}
                    </div>
                  )}

                  {source.lastError && (
                    <div className="border-t px-4 py-2 text-sm text-red-600 bg-red-50">
                      Error: {source.lastError}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No Lever companies added yet. Click &quot;Add Company&quot; to get started.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upcoming Sources - placeholder */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'Greenhouse', desc: 'ATS integration' },
            { name: 'Ashby', desc: 'ATS integration' },
            { name: 'Workable', desc: 'ATS integration' },
          ].map((item) => (
            <Card key={item.name} className="opacity-50">
              <CardHeader className="py-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <CardTitle className="text-sm">{item.name}</CardTitle>
                </div>
                <CardDescription className="text-xs">{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
