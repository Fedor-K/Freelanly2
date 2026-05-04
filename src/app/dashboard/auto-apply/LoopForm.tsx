'use client';

import { useState } from 'react';

interface Country {
  slug: string;
  name: string;
  code: string | null;
}

interface Level {
  value: string;
  label: string;
}

interface CoverLetterTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  isDefault: boolean;
}

interface AutoApplyLoop {
  id: string;
  name: string;
  jobTitles: string[];
  keywords: string | null;
  country: string | null;
  level: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  mode: string;
  dailyLimit: number;
  sentToday: number;
  isActive: boolean;
  resumeUrl: string | null;
  templateId: string | null;
  blacklistCompanies: string[];
  applications: { id: string; status: string }[];
  createdAt: string;
}

interface LoopFormProps {
  templates: CoverLetterTemplate[];
  countries: readonly Country[];
  levels: readonly Level[];
  onLoopCreated: (loop: AutoApplyLoop) => void;
}

export function LoopForm({ templates, countries, levels, onLoopCreated }: LoopFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [jobTitlesInput, setJobTitlesInput] = useState('');
  const [keywords, setKeywords] = useState('');
  const [country, setCountry] = useState('');
  const [level, setLevel] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [dailyLimit, setDailyLimit] = useState('10');
  const [mode, setMode] = useState('AUTO');
  const [resumeUrl, setResumeUrl] = useState('');
  const [templateId, setTemplateId] = useState('');

  const resetForm = () => {
    setName('');
    setJobTitlesInput('');
    setKeywords('');
    setCountry('');
    setLevel('');
    setSalaryMin('');
    setSalaryMax('');
    setDailyLimit('10');
    setMode('AUTO');
    setResumeUrl('');
    setTemplateId('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const jobTitles = jobTitlesInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        name,
        jobTitles,
        keywords: keywords || null,
        country: country || null,
        level: level || null,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
        dailyLimit: parseInt(dailyLimit) || 10,
        mode,
        resumeUrl: resumeUrl || null,
        templateId: templateId || null,
      };

      const res = await fetch('/api/user/auto-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const newLoop = await res.json();
        onLoopCreated(newLoop);
        setIsCreating(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating loop:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isCreating) {
    return (
      <button
        onClick={() => setIsCreating(true)}
        className="mb-6 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        Create New Loop
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Create Auto-Apply Loop</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loop Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Frontend Remote EU"
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Titles (comma-separated)
          </label>
          <input
            type="text"
            value={jobTitlesInput}
            onChange={(e) => setJobTitlesInput(e.target.value)}
            placeholder="e.g. React Developer, Frontend Engineer, UI Developer"
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the job titles you want to target, separated by commas
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keywords (optional)
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. React, TypeScript, Remote"
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Salary (optional)
            </label>
            <input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Salary (optional)
            </label>
            <input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="e.g. 100000"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Limit
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              min="1"
              max="50"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="AUTO">Auto — send without confirmation</option>
              <option value="SEMI">Semi — review before sending</option>
              <option value="MANUAL">Manual — only show matches</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resume URL (optional)
          </label>
          <input
            type="url"
            value={resumeUrl}
            onChange={(e) => setResumeUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cover Letter Template (optional)
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">No template (AI-generated)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !name || !jobTitlesInput}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Loop'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              resetForm();
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
