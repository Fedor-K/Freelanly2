'use client';

import { useState } from 'react';

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

// Translation types for the dropdown
const TRANSLATION_TYPES = [
  { value: 'WRITTEN', label: 'Written Translation' },
  { value: 'INTERPRETATION', label: 'Interpretation (Oral)' },
  { value: 'LOCALIZATION', label: 'Localization' },
  { value: 'EDITING', label: 'Editing / Proofreading' },
  { value: 'TRANSCRIPTION', label: 'Transcription' },
  { value: 'SUBTITLING', label: 'Subtitling / Captioning' },
  { value: 'MT_POST_EDITING', label: 'MT Post-Editing' },
  { value: 'COPYWRITING', label: 'Multilingual Copywriting' },
];

// Common languages for the dropdown
const LANGUAGES = [
  { code: 'EN', name: 'English' },
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
  const [alerts, setAlerts] = useState<JobAlert[]>(initialAlerts);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [country, setCountry] = useState('');
  const [level, setLevel] = useState('');
  const [frequency, setFrequency] = useState('DAILY');

  // Translation-specific: array of language pairs
  const [languagePairs, setLanguagePairs] = useState<LanguagePair[]>([]);

  // Current pair being added
  const [currentType, setCurrentType] = useState('');
  const [currentSource, setCurrentSource] = useState('');
  const [currentTarget, setCurrentTarget] = useState('');

  const isTranslationCategory = category === 'translation';

  const addLanguagePair = () => {
    if (!currentType || !currentSource || !currentTarget) return;

    // Check for duplicate
    const exists = languagePairs.some(
      (p) =>
        p.translationType === currentType &&
        p.sourceLanguage === currentSource &&
        p.targetLanguage === currentTarget
    );
    if (exists) return;

    setLanguagePairs([
      ...languagePairs,
      {
        translationType: currentType,
        sourceLanguage: currentSource,
        targetLanguage: currentTarget,
      },
    ]);

    // Reset current pair selects
    setCurrentSource('');
    setCurrentTarget('');
  };

  const removeLanguagePair = (index: number) => {
    setLanguagePairs(languagePairs.filter((_, i) => i !== index));
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
        frequency
      };

      // Add language pairs if translation category
      if (isTranslationCategory && languagePairs.length > 0) {
        body.languagePairs = languagePairs;
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
        // Reset form
        setCategory('');
        setKeywords('');
        setCountry('');
        setLevel('');
        setFrequency('DAILY');
        setLanguagePairs([]);
        setCurrentType('');
        setCurrentSource('');
        setCurrentTarget('');
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
    const lang = LANGUAGES.find((l) => l.code === code);
    return lang?.name || code;
  };

  const getTranslationTypeName = (type: string) => {
    const t = TRANSLATION_TYPES.find((tt) => tt.value === type);
    return t?.label || type;
  };

  // Group language pairs by translation type for display
  const groupPairsByType = (pairs: LanguagePair[]) => {
    const grouped: Record<string, LanguagePair[]> = {};
    for (const pair of pairs) {
      if (!grouped[pair.translationType]) {
        grouped[pair.translationType] = [];
      }
      grouped[pair.translationType].push(pair);
    }
    return grouped;
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
                    setLanguagePairs([]);
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

            {/* Translation-specific fields */}
            {isTranslationCategory && (
              <div className="p-4 bg-purple-50 rounded-lg space-y-4">
                <p className="text-sm font-medium text-purple-700">
                  Language Pairs
                </p>

                {/* Added pairs list */}
                {languagePairs.length > 0 && (
                  <div className="space-y-2">
                    {languagePairs.map((pair, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white p-2 rounded border"
                      >
                        <span className="text-sm">
                          <span className="font-medium">
                            {getTranslationTypeName(pair.translationType)}
                          </span>
                          {': '}
                          {getLanguageName(pair.sourceLanguage)} →{' '}
                          {getLanguageName(pair.targetLanguage)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLanguagePair(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new pair */}
                <div className="space-y-3 pt-2 border-t border-purple-200">
                  <p className="text-xs text-purple-600">Add language pair:</p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type of Work
                    </label>
                    <select
                      value={currentType}
                      onChange={(e) => setCurrentType(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select type...</option>
                      {TRANSLATION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Source
                      </label>
                      <select
                        value={currentSource}
                        onChange={(e) => setCurrentSource(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select...</option>
                        {LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target
                      </label>
                      <select
                        value={currentTarget}
                        onChange={(e) => setCurrentTarget(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select...</option>
                        {LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addLanguagePair}
                    disabled={!currentType || !currentSource || !currentTarget}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    + Add Pair
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="INSTANT">Instant</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || (isTranslationCategory && languagePairs.length === 0)}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setLanguagePairs([]);
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
            Create an alert to get notified about new jobs matching your criteria
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
            const groupedPairs = groupPairsByType(alert.languagePairs || []);

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

                    {/* Language pairs grouped by type */}
                    {Object.keys(groupedPairs).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {Object.entries(groupedPairs).map(([type, pairs]) => (
                          <div key={type} className="text-sm">
                            <span className="font-medium text-purple-700">
                              {getTranslationTypeName(type)}:
                            </span>{' '}
                            <span className="text-gray-600">
                              {pairs
                                .map(
                                  (p) =>
                                    `${getLanguageName(p.sourceLanguage)}→${getLanguageName(p.targetLanguage)}`
                                )
                                .join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-gray-500">
                        {alert.frequency.toLowerCase()} emails
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
