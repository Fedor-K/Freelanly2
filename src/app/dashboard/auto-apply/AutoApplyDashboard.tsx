'use client';

import { useState, useEffect } from 'react';
import { SmtpSetup } from './SmtpSetup';
import { TemplateEditor } from './TemplateEditor';
import { ApplicationsList } from './ApplicationsList';

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

interface CoverLetterTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  isDefault: boolean;
  createdAt: string;
}

interface UserSmtp {
  id: string;
  host: string;
  port: number;
  email: string;
  password: string;
  verified: boolean;
}

interface AutoApplication {
  id: string;
  loopId: string;
  companyName: string;
  jobTitle: string;
  appliedToEmail: string;
  coverLetter: string;
  subject: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

interface Stats {
  total: number;
  pending: number;
  sent: number;
  replied: number;
  interview: number;
  failed: number;
}

interface ParsedProfile {
  name?: string;
  skills?: string[];
  current_title?: string;
  field?: string;
  experience_years?: number;
  summary?: string;
}

interface AutoApplyDashboardProps {
  initialLoops: AutoApplyLoop[];
  initialTemplates: CoverLetterTemplate[];
  initialSmtp: UserSmtp | null;
  initialApplications: AutoApplication[];
  stats: Stats;
  countries: readonly Country[];
  levels: readonly Level[];
  parsedProfile?: Record<string, unknown> | null;
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
    if (field.includes('frontend') || field.includes('react')) titles.push('Frontend Developer', 'React Developer');
    else if (field.includes('backend') || field.includes('node')) titles.push('Backend Developer', 'Software Engineer');
    else if (field.includes('full') && field.includes('stack')) titles.push('Full Stack Developer');
    else if (field.includes('design')) titles.push('UI/UX Designer', 'Product Designer');
    else if (field.includes('data')) titles.push('Data Analyst', 'Data Scientist');
    else if (field.includes('devops')) titles.push('DevOps Engineer', 'Cloud Engineer');
    else if (field.includes('market')) titles.push('Marketing Manager');
    else titles.push(profile.field + ' Specialist');
  }
  if (profile.skills) {
    const skills = profile.skills.map(s => s.toLowerCase());
    if (skills.includes('react') && !titles.some(t => t.includes('React'))) titles.push('React Developer');
    if (skills.includes('python') && !titles.some(t => t.includes('Python'))) titles.push('Python Developer');
  }
  return [...new Set(titles)].slice(0, 5);
}

export function AutoApplyDashboard({
  initialLoops,
  initialTemplates,
  initialSmtp,
  initialApplications,
  stats,
  countries,
  levels,
  parsedProfile: rawProfile,
}: AutoApplyDashboardProps) {
  const [loops, setLoops] = useState<AutoApplyLoop[]>(initialLoops);
  const [templates, setTemplates] = useState<CoverLetterTemplate[]>(initialTemplates);
  const [smtp, setSmtp] = useState<UserSmtp | null>(initialSmtp);
  const [applications] = useState<AutoApplication[]>(initialApplications);
  const [startingLoop, setStartingLoop] = useState(false);

  const profile = rawProfile as ParsedProfile | null;
  const [resumeUploaded, setResumeUploaded] = useState(!!profile?.name || !!profile?.skills);
  const hasResume = resumeUploaded;
  const hasSmtp = !!smtp?.verified;
  const hasStyle = templates.length > 0;
  const hasLoop = loops.length > 0;
  const isRunning = hasLoop && loops.some(l => l.isActive);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/user/auto-apply');
        if (res.ok) {
          const data = await res.json();
          if (data.loops) setLoops(data.loops);
        }
      } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const inferredTitles = profile ? inferJobTitles(profile) : ['Developer'];
  const inferredLevel = profile ? inferLevel(profile.experience_years) : 'MID';
  const levelLabel = levels.find(l => l.value === inferredLevel)?.label || inferredLevel;

  const handleStartAutoApply = async () => {
    setStartingLoop(true);
    try {
      const res = await fetch('/api/user/auto-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${inferredTitles[0]} — Auto-Apply`,
          jobTitles: inferredTitles,
          keywords: profile?.skills?.slice(0, 5).join(', ') || null,
          level: inferredLevel,
          dailyLimit: 10,
          mode: 'AUTO',
        }),
      });
      if (res.ok) {
        const loop = await res.json();
        setLoops([loop, ...loops]);
      }
    } catch (e) {
      console.error('Error starting auto-apply:', e);
    } finally {
      setStartingLoop(false);
    }
  };

  const handlePauseResume = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/user/auto-apply', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      if (res.ok) {
        setLoops(loops.map(l => l.id === id ? { ...l, isActive: !isActive } : l));
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this auto-apply loop?')) return;
    try {
      const res = await fetch(`/api/user/auto-apply?id=${id}`, { method: 'DELETE' });
      if (res.ok) setLoops(loops.filter(l => l.id !== id));
    } catch {}
  };

  // ============ RUNNING STATE — show stats + applications ============
  if (isRunning) {
    return (
      <div>
        {/* Status banner */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                <h2 className="text-xl font-bold">Auto-Apply is Running</h2>
              </div>
              <p className="text-green-100 mt-1">
                Applying to {inferredTitles.join(', ')} • {levelLabel} • {loops[0]?.dailyLimit || 10}/day
              </p>
              <p className="text-green-200 text-sm mt-1">
                Scanning every 15 min • Next scan in ~{15 - (new Date().getMinutes() % 15)} min
              </p>
            </div>
            <button
              onClick={() => handlePauseResume(loops[0].id, true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              ⏸ Pause
            </button>
          </div>
        </div>

        {/* Scanning indicator */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Actively scanning for matching jobs • Every 15 minutes</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
            { label: 'Sent', value: stats.sent, color: 'text-blue-600' },
            { label: 'Replied', value: stats.replied, color: 'text-green-600' },
            { label: 'Interview', value: stats.interview, color: 'text-purple-600' },
            { label: 'Failed', value: stats.failed, color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Applications */}
        {applications.length > 0 && (
          <ApplicationsList initialApplications={applications} />
        )}

        {/* Settings (collapsed) */}
        <details className="mt-6">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">⚙️ Settings</summary>
          <div className="mt-4 space-y-4">
            <SmtpSetup initialSmtp={smtp} onSmtpUpdated={setSmtp} />
            {loops.map(loop => (
              <div key={loop.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                <div>
                  <span className="font-medium">{loop.name}</span>
                  <span className="text-sm text-gray-500 ml-2">{loop.sentToday}/{loop.dailyLimit} today</span>
                </div>
                <button onClick={() => handleDelete(loop.id)} className="text-sm text-red-500 hover:underline">Delete</button>
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  }

  // ============ PAUSED STATE ============
  if (hasLoop && !isRunning) {
    return (
      <div>
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-yellow-800">⏸ Auto-Apply Paused</h2>
              <p className="text-yellow-700 mt-1">
                {inferredTitles.join(', ')} • {loops[0]?.sentToday || 0} sent today
              </p>
            </div>
            <button
              onClick={() => handlePauseResume(loops[0].id, false)}
              className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              ▶ Resume
            </button>
          </div>
        </div>

        {stats.total > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-500">Sent</p>
              <p className="text-xl font-bold text-blue-600">{stats.sent}</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-500">Replied</p>
              <p className="text-xl font-bold text-green-600">{stats.replied}</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-500">Interview</p>
              <p className="text-xl font-bold text-purple-600">{stats.interview}</p>
            </div>
          </div>
        )}

        {applications.length > 0 && <ApplicationsList initialApplications={applications} />}

        <details className="mt-6">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">⚙️ Settings</summary>
          <div className="mt-4">
            <button onClick={() => handleDelete(loops[0].id)} className="text-sm text-red-500 hover:underline">Delete loop and start over</button>
          </div>
        </details>
      </div>
    );
  }

  // ============ SETUP STATE — linear flow ============
  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-8 mb-8 text-white">
        <h2 className="text-2xl font-bold mb-2">🚀 Auto-Apply</h2>
        <p className="text-orange-100">
          Upload your resume, connect your email, and Freelanly will apply to matching jobs automatically.
          AI writes a unique cover letter for each application.
        </p>
      </div>

      {/* Step 1: Resume */}
      <TemplateEditor
        initialTemplates={templates}
        onTemplateCreated={(t) => setTemplates([t, ...templates])}
        onTemplateDeleted={(id) => setTemplates(templates.filter(t => t.id !== id))}
        onResumeUploaded={() => setResumeUploaded(true)}
      />

      {/* Step 2: Connect Email */}
      {hasResume && (
        <div className="mt-4">
          <SmtpSetup initialSmtp={smtp} onSmtpUpdated={setSmtp} />
        </div>
      )}

      {/* Step 3: Start — one button */}
      {hasResume && hasSmtp && hasStyle && !hasLoop && (
        <div className="bg-white rounded-xl border-2 border-green-400 shadow-md p-6 mt-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg shrink-0">🚀</div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">Everything is ready!</h2>
              <p className="text-sm text-gray-500 mb-3">
                AI will apply to these positions based on your resume:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex flex-wrap gap-1 mb-2">
                  {inferredTitles.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded font-medium">{t}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {levelLabel} level • Freelance + Full-time • 10 per day • via {smtp?.email}
                </p>
              </div>
              <button
                onClick={handleStartAutoApply}
                disabled={startingLoop}
                className="px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium text-lg disabled:opacity-50"
              >
                {startingLoop ? 'Starting...' : '🚀 Start Auto-Applying'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
