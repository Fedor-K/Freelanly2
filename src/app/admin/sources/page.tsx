'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  lastError: string | null;
  errorCount: number;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompanySlug, setNewCompanySlug] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; jobCount?: number; error?: string } | null>(null);
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

  async function validateLever() {
    if (!newCompanySlug.trim()) return;

    setValidating(true);
    setValidationResult(null);

    try {
      const res = await fetch('/api/admin/sources/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'LEVER',
          companySlug: newCompanySlug.trim().toLowerCase(),
        }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (error) {
      setValidationResult({ valid: false, error: String(error) });
    } finally {
      setValidating(false);
    }
  }

  async function addLeverSource() {
    if (!validationResult?.valid) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'LEVER',
          companySlug: newCompanySlug.trim().toLowerCase(),
          name: newCompanySlug.trim(),
        }),
      });

      if (res.ok) {
        setShowAddForm(false);
        setNewCompanySlug('');
        setValidationResult(null);
        fetchSources();
      }
    } catch (error) {
      console.error('Failed to add source:', error);
    } finally {
      setSaving(false);
    }
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
              <CardTitle className="text-lg">Add Lever Company</CardTitle>
              <CardDescription>
                Enter the company slug from their Lever careers page URL.
                <br />
                Example: For https://jobs.lever.co/<strong>appen</strong>, enter "appen"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="companySlug">Company Slug</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="companySlug"
                      placeholder="e.g., appen, netflix, stripe"
                      value={newCompanySlug}
                      onChange={(e) => {
                        setNewCompanySlug(e.target.value);
                        setValidationResult(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && validateLever()}
                    />
                    <Button onClick={validateLever} disabled={validating || !newCompanySlug.trim()}>
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
                    </Button>
                  </div>
                </div>
              </div>

              {validationResult && (
                <div className={`mt-4 p-3 rounded-lg ${validationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  {validationResult.valid ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      <span>Valid! Found {validationResult.jobCount} active jobs</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700">
                      <XCircle className="h-5 w-5" />
                      <span>{validationResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              {validationResult?.valid && (
                <div className="mt-4">
                  <Button onClick={addLeverSource} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add Source
                  </Button>
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
                        <div className="font-medium">{source.totalImported} jobs imported</div>
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
