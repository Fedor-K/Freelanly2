'use client';

import { useState } from 'react';
import { JobAlert } from '@prisma/client';

interface Category {
  name: string;
  slug: string;
}

interface AlertsListProps {
  initialAlerts: JobAlert[];
  categories: readonly Category[];
}

export function AlertsList({ initialAlerts, categories }: AlertsListProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [frequency, setFrequency] = useState('DAILY');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/user/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, keywords, frequency }),
      });

      if (res.ok) {
        const newAlert = await res.json();
        setAlerts([newAlert, ...alerts]);
        setIsCreating(false);
        setCategory('');
        setKeywords('');
        setFrequency('DAILY');
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
                onChange={(e) => setCategory(e.target.value)}
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
                disabled={loading}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
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
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border p-6 ${
                !alert.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {getCategoryName(alert.category)}
                  </h3>
                  {alert.keywords && (
                    <p className="text-gray-600 mt-1">
                      Keywords: {alert.keywords}
                    </p>
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
          ))}
        </div>
      )}
    </div>
  );
}
