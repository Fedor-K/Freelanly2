'use client';

import { useState, useEffect } from 'react';

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

function inferLevel(years?: number): string {
  if (!years) return 'MID';
  if (years <= 1) return 'JUNIOR';
  if (years <= 3) return 'MID';
  if (years <= 6) return 'SENIOR';
  return 'LEAD';
}

function inferJobTitles(profile: ParsedProfile): string[] {
  const titles: string[] = [];
  if (profile.current_title) titles.push(profile.current_title);
  if (profile.field) {
    const field = profile.field.toLowerCase();
    if (field.includes('frontend') || field.includes('react')) {
      titles.push('Frontend Developer', 'React Developer', 'UI Developer');
    } else if (field.includes('backend') || field.includes('node') || field.includes('python')) {
      titles.push('Backend Developer', 'Software Engineer');
    } else if (field.includes('full') && field.includes('stack')) {
      titles.push('Full Stack Developer', 'Software Engineer');
    } else if (field.includes('design')) {
      titles.push('UI/UX Designer', 'Product Designer', 'Web Designer');
    } else if (field.includes('data')) {
      titles.push('Data Analyst', 'Data Scientist', 'Data Engineer');
    } else if (field.includes('devops') || field.includes('cloud')) {
      titles.push('DevOps Engineer', 'Cloud Engineer', 'SRE');
    } else if (field.includes('market')) {
      titles.push('Digital Marketing Manager', 'Marketing Specialist');
    } else if (field.includes('product')) {
      titles.push('Product Manager', 'Product Owner');
    } else {
      titles.push(profile.field + ' Specialist');
    }
  }
  // Add skill-based titles
  if (profile.skills) {
    const skills = profile.skills.map(s => s.toLowerCase());
    if (skills.includes('react') && !titles.some(t => t.includes('React'))) titles.push('React Developer');
    if (skills.includes('python') && !titles.some(t => t.includes('Python'))) titles.push('Python Developer');
    if (skills.includes('java') && !titles.some(t => t.includes('Java'))) titles.push('Java Developer');
    if ((skills.includes('node') || skills.includes('node.js')) && !titles.some(t => t.includes('Node'))) titles.push('Node.js Developer');
  }
  return [...new Set(titles)].slice(0, 5);
}

export function LoopForm({ countries, levels, onLoopCreated, parsedProfile }: LoopFormProps) {
  const [loading, setLoading] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  // AI-inferred settings
  const inferredTitles = parsedProfile ? inferJobTitles(parsedProfile) : ['Developer'];
  const inferredLevel = parsedProfile ? inferLevel(parsedProfile.experience_years) : 'MID';
  const inferredKeywords = parsedProfile?.skills?.slice(0, 5).join(', ') || '';
  const levelLabel = levels.find(l => l.value === inferredLevel)?.label || inferredLevel;

  // Adjustable state (pre-filled by AI)
  const [jobTitles, setJobTitles] = useState(inferredTitles.join(', '));
  const [keywords, setKeywords] = useState(inferredKeywords);
  const [country, setCountry] = useState('');
  const [level, setLevel] = useState(inferredLevel);
  const [applyTo, setApplyTo] = useState<'both' | 'freelance' | 'fulltime'>('both');
  const [dailyLimit, setDailyLimit] = useState('10');

  // Update when profile changes
  useEffect(() => {
    if (parsedProfile) {
      const titles = inferJobTitles(parsedProfile);
      setJobTitles(titles.join(', '));
      setKeywords(parsedProfile.skills?.slice(0, 5).join(', ') || '');
      setLevel(inferLevel(parsedProfile.experience_years));
    }
  }, [parsedProfile]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/auto-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${inferredTitles[0] || 'Auto'} — Auto-Apply`,
          jobTitles: jobTitles.split(',').map(t => t.trim()).filter(Boolean),
          keywords: keywords || null,
          country: country || null,
          level: level || null,
          dailyLimit: parseInt(dailyLimit) || 10,
          mode: 'AUTO',
        }),
      });

      if (res.ok) {
        const loop = await res.json();
        onLoopCreated(loop);
      }
    } catch (error) {
      console.error('Error creating loop:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-orange-400 shadow-md p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-lg font-bold shrink-0 text-orange-700">
          🚀
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-1">Ready to Auto-Apply</h2>
          <p className="text-sm text-gray-500 mb-4">
            Based on your resume, AI will apply to these positions:
          </p>

          {/* AI-suggested summary */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Positions:</span>
                <div className="flex flex-wrap gap-1">
                  {inferredTitles.map((title, i) => (
                    <span key={i} className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded font-medium">{title}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Level:</span>
                <span>{levelLabel}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Skills:</span>
                <span className="text-gray-700">{inferredKeywords || 'Any'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Type:</span>
                <span>Freelance + Full-time</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Volume:</span>
                <span>10 applications per day</span>
              </div>
            </div>
          </div>

          {/* Main action */}
          <div className="flex gap-3 mb-3">
            <button
              onClick={handleStart}
              disabled={loading}
              className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? 'Starting...' : '🚀 Start Auto-Applying'}
            </button>
            <button
              onClick={() => setShowAdjust(!showAdjust)}
              className="px-4 py-3 border rounded-xl hover:bg-gray-50 transition-colors text-sm text-gray-600"
            >
              {showAdjust ? 'Hide settings' : 'Adjust settings'}
            </button>
          </div>

          {/* Adjustable settings (hidden by default) */}
          {showAdjust && (
            <div className="border-t pt-4 mt-2 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Job Titles</label>
                <input
                  type="text"
                  value={jobTitles}
                  onChange={(e) => setJobTitles(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Skills / Keywords</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Apply to</label>
                  <select value={applyTo} onChange={(e) => setApplyTo(e.target.value as typeof applyTo)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="both">Both</option>
                    <option value="freelance">Freelance</option>
                    <option value="fulltime">Full-time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Any</option>
                    {countries.map((c) => (
                      <option key={c.slug} value={c.code || c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Daily limit</label>
                  <select value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="5">5/day</option>
                    <option value="10">10/day</option>
                    <option value="20">20/day</option>
                    <option value="50">50/day</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
