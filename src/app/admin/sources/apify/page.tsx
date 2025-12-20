'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ApifySettings {
  maxPosts: number;
  maxReactions: number;
  postedLimit: '24h' | 'week' | 'month';
  scrapeComments: boolean;
  scrapePages: number;
  scrapeReactions: boolean;
  searchQueries: string[];
  sortBy: 'date' | 'relevance';
  startPage: number;
}

export default function AdminApifyPage() {
  const [settings, setSettings] = useState<ApifySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQueriesText, setSearchQueriesText] = useState('');

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings/apify');
      const data = await res.json();

      if (data.success) {
        setSettings(data.settings);
        setSearchQueriesText(data.settings.searchQueries.join('\n'));
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      // Parse search queries from textarea
      const searchQueries = searchQueriesText
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0);

      const res = await fetch('/api/admin/settings/apify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, searchQueries }),
      });

      const data = await res.json();

      if (data.success) {
        setSettings(data.settings);
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings/apify', { method: 'PUT' });
      const data = await res.json();

      if (data.success) {
        setSettings(data.settings);
        setSearchQueriesText(data.settings.searchQueries.join('\n'));
        setMessage({ type: 'success', text: 'Settings reset to defaults!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  }

  async function runScraper() {
    setSaving(true);
    setMessage({ type: 'success', text: 'Starting scraper... This may take 1-5 minutes.' });

    try {
      const res = await fetch('/api/admin/run-scraper', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Scraper completed! Total: ${data.stats.total}, Created: ${data.stats.created}, Skipped: ${data.stats.skipped}, Failed: ${data.stats.failed}`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to run scraper' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to run scraper' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container py-8">
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container py-8">
        <p className="text-red-500">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Apify LinkedIn Scraper Settings</h1>
      <p className="text-muted-foreground mb-8">
        Configure the LinkedIn Posts Search scraper (Actor: buIWk2uOUzTmcLsuB)
      </p>

      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Search Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Search Queries</CardTitle>
            <CardDescription>
              Enter search queries, one per line. These will be used to find LinkedIn hiring posts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full h-40 p-3 border rounded-lg font-mono text-sm"
              value={searchQueriesText}
              onChange={(e) => setSearchQueriesText(e.target.value)}
              placeholder="hiring remote&#10;we are hiring&#10;join our team"
            />
          </CardContent>
        </Card>

        {/* Scraping Options */}
        <Card>
          <CardHeader>
            <CardTitle>Scraping Options</CardTitle>
            <CardDescription>Control how many posts to scrape and how.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxPosts">Max Posts</Label>
                <Input
                  id="maxPosts"
                  type="number"
                  min="1"
                  max="1000"
                  value={settings.maxPosts}
                  onChange={(e) =>
                    setSettings({ ...settings, maxPosts: parseInt(e.target.value) || 20 })
                  }
                />
              </div>

              <div>
                <Label htmlFor="scrapePages">Scrape Pages</Label>
                <Input
                  id="scrapePages"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.scrapePages}
                  onChange={(e) =>
                    setSettings({ ...settings, scrapePages: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              <div>
                <Label htmlFor="startPage">Start Page</Label>
                <Input
                  id="startPage"
                  type="number"
                  min="1"
                  value={settings.startPage}
                  onChange={(e) =>
                    setSettings({ ...settings, startPage: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              <div>
                <Label htmlFor="maxReactions">Max Reactions</Label>
                <Input
                  id="maxReactions"
                  type="number"
                  min="0"
                  value={settings.maxReactions}
                  onChange={(e) =>
                    setSettings({ ...settings, maxReactions: parseInt(e.target.value) || 5 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postedLimit">Posted Within</Label>
                <select
                  id="postedLimit"
                  className="w-full p-2 border rounded-lg"
                  value={settings.postedLimit}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      postedLimit: e.target.value as '24h' | 'week' | 'month',
                    })
                  }
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="week">Last week</option>
                  <option value="month">Last month</option>
                </select>
              </div>

              <div>
                <Label htmlFor="sortBy">Sort By</Label>
                <select
                  id="sortBy"
                  className="w-full p-2 border rounded-lg"
                  value={settings.sortBy}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sortBy: e.target.value as 'date' | 'relevance',
                    })
                  }
                >
                  <option value="date">Date (newest first)</option>
                  <option value="relevance">Relevance</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.scrapeReactions}
                  onChange={(e) =>
                    setSettings({ ...settings, scrapeReactions: e.target.checked })
                  }
                />
                <span>Scrape Reactions</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.scrapeComments}
                  onChange={(e) =>
                    setSettings({ ...settings, scrapeComments: e.target.checked })
                  }
                />
                <span>Scrape Comments</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>

          <Button variant="outline" onClick={resetToDefaults} disabled={saving}>
            Reset to Defaults
          </Button>

          <Button variant="secondary" onClick={runScraper} disabled={saving}>
            {saving ? 'Running...' : 'Run Scraper Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
