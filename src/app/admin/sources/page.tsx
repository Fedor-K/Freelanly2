'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Database, Linkedin, Globe, Plus, Play, Trash2, Building2, Loader2, CheckCircle, XCircle } from 'lucide-react';

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
  lastError: string | null;
  errorCount: number;
}

interface BulkValidationResult {
  slug: string;
  valid: boolean;
  jobCount?: number;
  error?: string;
  added?: boolean;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [companySlugsInput, setCompanySlugsInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkValidationResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    try {
      const res = await fetch('/api/admin/sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  }

  // Parse input into array of slugs
  function parseSlugs(input: string): string[] {
    return input
      .split(/[,\n\r]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i); // unique
  }

  async function validateBulk() {
    const slugs = parseSlugs(companySlugsInput);
    if (slugs.length === 0) return;

    setValidating(true);
    setBulkResults([]);

    const results: BulkValidationResult[] = [];

    for (const slug of slugs) {
      // Check if already exists
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

  async function runSource(sourceId: string) {
    setRunningSourceId(sourceId);
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(`Import completed: ${data.stats.created} created, ${data.stats.skipped} skipped, ${data.stats.failed} failed`);
        fetchSources();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setRunningSourceId(null);
    }
  }

  async function deleteSource(sourceId: string, name: string) {
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

  async function toggleSource(sourceId: string, isActive: boolean) {
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

  // Group sources by type
  const leverSources = sources.filter(s => s.sourceType === 'LEVER');
  const otherSources = sources.filter(s => s.sourceType !== 'LEVER');

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Data Sources</h1>
        <p className="text-muted-foreground mt-1">
          Configure and manage job data sources
        </p>
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
          <h2 className="text-xl font-semibold">Lever ATS Companies</h2>
          <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Add Lever Companies</CardTitle>
              <CardDescription>
                Enter company slugs from their Lever careers page URLs (one per line or comma-separated).
                <br />
                Example: For https://jobs.lever.co/<strong>appen</strong>, enter "appen"
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

        {/* Lever Sources List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : leverSources.length > 0 ? (
          <div className="grid gap-3">
            {leverSources.map((source) => (
              <Card key={source.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium">{source.name}</div>
                        <div className="text-sm text-muted-foreground">
                          jobs.lever.co/{source.companySlug}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm text-right">
                        <div className="text-muted-foreground">Last run: {formatDate(source.lastRunAt)}</div>
                        <div className="font-medium">
                          {source.lastCreated > 0 ? (
                            <span className="text-green-600">+{source.lastCreated} new</span>
                          ) : source.lastRunAt ? (
                            <span className="text-muted-foreground">no new jobs</span>
                          ) : (
                            <span className="text-muted-foreground">not run yet</span>
                          )}
                          <span className="text-muted-foreground font-normal ml-2">({source.totalImported} total)</span>
                        </div>
                      </div>

                      <Badge
                        variant={source.isActive ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleSource(source.id, source.isActive)}
                      >
                        {source.isActive ? 'active' : 'paused'}
                      </Badge>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => runSource(source.id)}
                          disabled={runningSourceId === source.id}
                        >
                          {runningSourceId === source.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSource(source.id, source.name)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {source.lastError && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      Error: {source.lastError}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No Lever companies added yet. Click "Add Company" to get started.
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
            { name: 'RemoteOK', desc: 'Remote job board' },
            { name: 'WeWorkRemotely', desc: 'Remote jobs' },
            { name: 'HackerNews', desc: 'Who is Hiring' },
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
