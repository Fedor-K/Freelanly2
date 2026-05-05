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

interface ParsedProfile {
  name?: string;
  skills?: string[];
  current_title?: string;
  field?: string;
  experience_years?: number;
}

interface LoopFormProps {
  countries: readonly Country[];
  levels: readonly Level[];
  onLoopCreated: (loop: AutoApplyLoop) => void;
  parsedProfile?: ParsedProfile | null;
}

export function LoopForm({ countries, levels, onLoopCreated, parsedProfile }: LoopFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-fill from profile
  const suggestedTitle = parsedProfile?.current_title || '';
  const suggestedSkills = parsedProfile?.skills?.slice(0, 5).join(', ') || '';
  const suggestedName = suggestedTitle
    ? `${suggestedTitle} — Auto-Apply`
    : 'My Auto-Apply';

  // Form state — pre-filled from resume
  const [name, setName] = useState(suggestedName);
  const [jobTitles, setJobTitles] = useState(suggestedTitle);
  const [keywords, setKeywords] = useState(suggestedSkills);
  const [country, setCountry] = useState('');
  const [level, setLevel] = useState('');
  const [applyTo, setApplyTo] = useState<'both' | 'freelance' | 'fulltime'>('both');
  const [dailyLimit, setDailyLimit] = useState('10');
  const [mode, setMode] = useState('AUTO');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitles.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/user/auto-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || `${jobTitles.split(',')[0].trim()} Auto-Apply`,
          jobTitles: jobTitles.split(',').map(t => t.trim()).filter(Boolean),
          keywords: keywords || null,
          country: country || null,
          level: level || null,
          dailyLimit: parseInt(dailyLimit) || 10,
          mode,
        }),
      });

      if (res.ok) {
        const loop = await res.json();
        onLoopCreated(loop);
        setIsCreating(false);
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
        + Create Auto-Apply Loop
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">Create Auto-Apply Loop</h2>
      <p className="text-sm text-gray-500 mb-4">
        {parsedProfile
          ? 'Pre-filled from your resume. Adjust if needed.'
          : 'Tell us what jobs to apply for.'}
      </p>

      <form onSubmit={handleCreate} className="space-y-4">
        {/* Job Titles — most important, pre-filled */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Titles <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={jobTitles}
            onChange={(e) => setJobTitles(e.target.value)}
            placeholder="e.g. React Developer, Frontend Engineer, UI Developer"
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated. We&apos;ll match jobs containing these titles.</p>
        </div>

        {/* Apply to: Freelance / Full-time / Both */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apply to</label>
          <div className="flex gap-2">
            {[
              { id: 'both', label: '🔄 Both', desc: 'Freelance + Full-time' },
              { id: 'freelance', label: '💼 Freelance', desc: 'Projects only' },
              { id: 'fulltime', label: '🏢 Full-time', desc: 'Permanent jobs' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setApplyTo(opt.id as typeof applyTo)}
                className={`flex-1 p-3 rounded-lg border-2 text-center text-sm transition-all ${
                  applyTo === opt.id
                    ? 'border-black bg-gray-50 font-medium'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div>{opt.label}</div>
                <div className="text-xs text-gray-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Keywords — pre-filled from skills */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skills / Keywords</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. React, TypeScript, Remote"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Optional — narrows matching to jobs with these keywords.</p>
        </div>

        {/* Country + Level — compact row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Any country</option>
              {countries.map((c) => (
                <option key={c.slug} value={c.code || c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Any level</option>
              {levels.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Daily Limit + Mode — compact row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Daily Limit</label>
            <select
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="5">5 per day</option>
              <option value="10">10 per day</option>
              <option value="20">20 per day</option>
              <option value="30">30 per day</option>
              <option value="50">50 per day</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="AUTO">Auto — send without asking</option>
              <option value="SEMI">Semi — review before sending</option>
            </select>
          </div>
        </div>

        {/* Auto-generated name (hidden but editable) */}
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer hover:text-gray-600">Advanced: edit loop name</summary>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-2 px-3 py-1.5 border rounded-lg text-sm"
          />
        </details>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !jobTitles.trim()}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Loop'}
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
  );
}
