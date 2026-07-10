'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTracker } from '@/hooks/useTracker';

interface JobCountPreview {
  count: number;
  countWithoutCountry: number;
  dailyAverage: number;
}

interface Category {
  name: string;
  slug: string;
}

interface LanguagePair {
  id?: string;
  translationType: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface JobAlert {
  id: string;
  category: string | null;
  keywords: string | null;
  country: string | null;
  level: string | null;
  frequency: string;
  isActive: boolean;
  languagePairs: LanguagePair[];
}

interface Country {
  slug: string;
  name: string;
  code: string | null;
}

interface Level {
  value: string;
  label: string;
}

interface AlertsListProps {
  initialAlerts: JobAlert[];
  categories: readonly Category[];
  countries: readonly Country[];
  levels: readonly Level[];
}

// Common languages for the dropdown (excluding English - it's implicit)
const LANGUAGES = [
  { code: 'ES', name: 'Spanish' },
  { code: 'DE', name: 'German' },
  { code: 'FR', name: 'French' },
  { code: 'RU', name: 'Russian' },
  { code: 'ZH', name: 'Chinese' },
  { code: 'JA', name: 'Japanese' },
  { code: 'KO', name: 'Korean' },
  { code: 'PT', name: 'Portuguese' },
  { code: 'IT', name: 'Italian' },
  { code: 'AR', name: 'Arabic' },
  { code: 'NL', name: 'Dutch' },
  { code: 'PL', name: 'Polish' },
  { code: 'TR', name: 'Turkish' },
  { code: 'UK', name: 'Ukrainian' },
  { code: 'SV', name: 'Swedish' },
  { code: 'CS', name: 'Czech' },
  { code: 'DA', name: 'Danish' },
  { code: 'FI', name: 'Finnish' },
  { code: 'EL', name: 'Greek' },
  { code: 'HE', name: 'Hebrew' },
  { code: 'HI', name: 'Hindi' },
  { code: 'HU', name: 'Hungarian' },
  { code: 'ID', name: 'Indonesian' },
  { code: 'NO', name: 'Norwegian' },
  { code: 'RO', name: 'Romanian' },
  { code: 'TH', name: 'Thai' },
  { code: 'VI', name: 'Vietnamese' },
];

export function AlertsList({ initialAlerts, categories, countries, levels }: AlertsListProps) {
  const { track: trackDb } = useTracker();
  const [alerts, setAlerts] = useState<JobAlert[]>(initialAlerts);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [country, setCountry] = useState('');
  const [level, setLevel] = useState('');

  // Translation-specific: array of language codes user can translate
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Job count preview
  const [jobCountPreview, setJobCountPreview] = useState<JobCountPreview | null>(null);
  const [isLoadingJobCount, setIsLoadingJobCount] = useState(false);

  const isTranslationCategory = category === 'translation';

  // Fetch job count preview when filters change
  const fetchJobCount = useCallback(async () => {
    if (!category) {
      setJobCountPreview(null);
      return;
    }

    setIsLoadingJobCount(true);
    try {
      const params = new URLSearchParams({ category, days: '7' });
      if (country) params.set('country', country);
      const res = await fetch(`/api/jobs/count?${params}`);
      const data = await res.json();

      setJobCountPreview({
        count: data.count || 0,
        countWithoutCountry: data.countWithoutCountry || 0,
        dailyAverage: data.dailyAverage || 0,
      });
    } catch (err) {
      console.error('Failed to fetch job count:', err);
      setJobCountPreview(null);
    } finally {
      setIsLoadingJobCount(false);
    }
  }, [category, country]);

  // Debounced fetch on filter changes
  useEffect(() => {
    if (!isCreating) return;
    const timer = setTimeout(() => {
      fetchJobCount();
    }, 300);
    return () => clearTimeout(timer);
  }, [category, country, isCreating, fetchJobCount]);

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const removeLanguage = (code: string) => {
    setSelectedLanguages((prev) => prev.filter((l) => l !== code));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        category,
        keywords,
        country,
        level,
      };

      // Add languages if translation category
      if (isTranslationCategory && selectedLanguages.length > 0) {
        body.languages = selectedLanguages;
      }

      const res = await fetch('/api/user/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const newAlert = await res.json();
        setAlerts([newAlert, ...alerts]);
        setIsCreating(false);
        trackDb('ALERT_CREATED', { category, keywords, country, level, languages: selectedLanguages });
        // Reset form
        setCategory('');
        setKeywords('');
        setCountry('');
        setLevel('');
        setSelectedLanguages([]);
        setShowLanguageDropdown(false);
      }
    } catch (error) {
      console.error('Error creating alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/user/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        setAlerts(
          alerts.map((a) => (a.id === id ? { ...a, isActive: !isActive } : a))
        );
      }
    } catch (error) {
      console.error('Error toggling alert:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      const res = await fetch(`/api/user/alerts/${id}`, { method: 'DELETE' });

      if (res.ok) {
        const deletedAlert = alerts.find((a) => a.id === id);
        trackDb('ALERT_DELETED', { alertId: id, category: deletedAlert?.category });
        setAlerts(alerts.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getCategoryName = (slug: string | null) => {
    if (!slug) return 'All categories';
    const cat = categories.find((c) => c.slug === slug);
    return cat?.name || slug;
  };

  const getCountryName = (code: string | null) => {
    if (!code) return null;
    const c = countries.find((ct) => ct.code === code);
    return c?.name || code;
  };

  const getLevelName = (value: string | null) => {
    if (!value) return null;
    const l = levels.find((lv) => lv.value === value);
    return l?.label || value;
  };

  const getLanguageName = (code: string) => {
    if (code === 'EN') return 'English';
    const lang = LANGUAGES.find((l) => l.code === code);
    return lang?.name || code;
  };

  // Group language pairs into bidirectional pairs (EN ↔ ES) for display
  const groupLanguagePairs = (pairs: LanguagePair[]) => {
    const bidirectional = new Map<string, { lang: string; directions: string[] }>();
    for (const pair of pairs) {
      const otherLang = pair.sourceLanguage === 'EN' ? pair.targetLanguage : pair.sourceLanguage;
      if (!bidirectional.has(otherLang)) {
        bidirectional.set(otherLang, { lang: otherLang, directions: [] });
      }
      bidirectional.get(otherLang)!.directions.push(
        `${getLanguageName(pair.sourceLanguage)} → ${getLanguageName(pair.targetLanguage)}`
      );
    }
    return Array.from(bidirectional.values());
  };

  return (
    <div>
      {/* Create button */}
      {!isCreating && (
        <button
          onClick={() => setIsCreating(true)}
          className="mb-6 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Create New Alert
        </button>
      )}

      {/* Create form */}
      {isCreating && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Job Alert</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value !== 'translation') {
                    setSelectedLanguages([]);
                    setShowLanguageDropdown(false);
                  }
                }}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keywords (optional)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. React, Python, Remote"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country (optional)
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Any country</option>
                  {countries.map((c) => (
                    <option key={c.slug} value={c.code || ''}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Level (optional)
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Any level</option>
                  {levels.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Job Count Preview */}
            {category && (
              <div className={`p-3 rounded-lg border ${
                jobCountPreview && jobCountPreview.count < 5
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                {isLoadingJobCount ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Checking job availability...</span>
                  </div>
                ) : jobCountPreview ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      {jobCountPreview.count < 5 ? (
                        <>
                          <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="font-medium text-amber-800">
                            Only {jobCountPreview.count} job{jobCountPreview.count !== 1 ? 's' : ''} in the last 7 days
                          </span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="font-medium text-green-800">
                            {jobCountPreview.count} jobs in the last 7 days (~{jobCountPreview.dailyAverage}/day)
                          </span>
                        </>
                      )}
                    </div>
                    {/* Suggestion to expand if count is low */}
                    {jobCountPreview.count < 5 && country && jobCountPreview.countWithoutCountry > jobCountPreview.count && (
                      <p className="text-xs text-amber-700">
                        Tip: {jobCountPreview.countWithoutCountry} jobs available worldwide.{' '}
                        <button
                          type="button"
                          onClick={() => setCountry('')}
                          className="underline hover:no-underline font-medium"
                        >
                          Remove country filter
                        </button>{' '}
                        to get more alerts.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Translation-specific fields */}
            {isTranslationCategory && (
              <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                <div>
                  <p className="text-sm font-medium text-purple-700 mb-1">
                    Your Languages
                  </p>
                  <p className="text-xs text-purple-600 mb-2">
                    Select languages you can translate (besides English)
                  </p>
                </div>

                {/* Language multi-select dropdown */}
                <div className="relative">
                  <div
                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                    className="min-h-[42px] px-3 py-2 bg-white border rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center"
                  >
                    {selectedLanguages.length === 0 ? (
                      <span className="text-gray-400">Select languages...</span>
                    ) : (
                      selectedLanguages.map((code) => (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm"
                        >
                          {getLanguageName(code)}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLanguage(code);
                            }}
                            className="hover:text-purple-900"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                    <span className="ml-auto text-gray-400">▼</span>
                  </div>

                  {showLanguageDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => toggleLanguage(lang.code)}
                          className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center justify-between"
                        >
                          <span>{lang.name}</span>
                          {selectedLanguages.includes(lang.code) && (
                            <span className="text-purple-600">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All alerts are now INSTANT - no frequency selector needed */}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || (isTranslationCategory && selectedLanguages.length === 0)}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setSelectedLanguages([]);
                  setShowLanguageDropdown(false);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No job alerts yet
          </h2>
          <p className="text-gray-600 mb-6">
            Save your criteria — they help shape your Discovery feed (email alerts are currently paused)
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Create Your First Alert
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const alertPairGroups = groupLanguagePairs(alert.languagePairs || []);

            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border p-6 ${
                  !alert.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {getCategoryName(alert.category)}
                    </h3>

                    {/* Filters display */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {alert.keywords && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          🔍 {alert.keywords}
                        </span>
                      )}
                      {alert.country && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          📍 {getCountryName(alert.country)}
                        </span>
                      )}
                      {alert.level && (
                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                          📊 {getLevelName(alert.level)}
                        </span>
                      )}
                    </div>

                    {/* Language pairs display */}
                    {alertPairGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {alertPairGroups.map((group) => (
                          <div key={group.lang} className="flex flex-wrap gap-1">
                            {group.directions.map((dir) => (
                              <span
                                key={dir}
                                className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded"
                              >
                                🌐 {dir}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-gray-500">
                        {alert.frequency.toLowerCase()} · emails paused
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          alert.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {alert.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(alert.id, alert.isActive)}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        alert.isActive
                          ? 'text-gray-600 hover:bg-gray-100'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {alert.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
