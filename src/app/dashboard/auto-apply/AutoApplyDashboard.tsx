'use client';

import { useState } from 'react';
import { useTracker } from '@/hooks/useTracker';
import { LoopForm } from './LoopForm';
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

interface AutoApplyDashboardProps {
  initialLoops: AutoApplyLoop[];
  initialTemplates: CoverLetterTemplate[];
  initialSmtp: UserSmtp | null;
  initialApplications: AutoApplication[];
  stats: Stats;
  countries: readonly Country[];
  levels: readonly Level[];
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'loops', label: 'My Loops' },
  { key: 'applications', label: 'Applications' },
  { key: 'templates', label: 'Templates' },
  { key: 'smtp', label: 'SMTP Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AutoApplyDashboard({
  initialLoops,
  initialTemplates,
  initialSmtp,
  initialApplications,
  stats,
  countries,
  levels,
}: AutoApplyDashboardProps) {
  const { track: trackDb } = useTracker();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loops, setLoops] = useState<AutoApplyLoop[]>(initialLoops);
  const [templates, setTemplates] = useState<CoverLetterTemplate[]>(initialTemplates);
  const [smtp, setSmtp] = useState<UserSmtp | null>(initialSmtp);
  const [applications] = useState<AutoApplication[]>(initialApplications);

  const handleLoopCreated = (loop: AutoApplyLoop) => {
    setLoops([loop, ...loops]);
    trackDb('AUTO_APPLY_LOOP_CREATED', { name: loop.name, mode: loop.mode });
  };

  const handleLoopToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/user/auto-apply/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        setLoops(
          loops.map((l) => (l.id === id ? { ...l, isActive: !isActive } : l))
        );
      }
    } catch (error) {
      console.error('Error toggling loop:', error);
    }
  };

  const handleLoopDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loop?')) return;

    try {
      const res = await fetch(`/api/user/auto-apply/${id}`, { method: 'DELETE' });

      if (res.ok) {
        trackDb('AUTO_APPLY_LOOP_DELETED', { loopId: id });
        setLoops(loops.filter((l) => l.id !== id));
      }
    } catch (error) {
      console.error('Error deleting loop:', error);
    }
  };

  const handleTemplateCreated = (template: CoverLetterTemplate) => {
    setTemplates([template, ...templates]);
  };

  const handleTemplateDeleted = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
  };

  const handleSmtpUpdated = (newSmtp: UserSmtp) => {
    setSmtp(newSmtp);
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

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'text-black border-b-2 border-black'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-6">
              <p className="text-sm text-gray-500">Total Sent</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <p className="text-sm text-gray-500">Sent</p>
              <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <p className="text-sm text-gray-500">Replied</p>
              <p className="text-2xl font-bold text-green-600">{stats.replied}</p>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <p className="text-sm text-gray-500">Interviews</p>
              <p className="text-2xl font-bold text-purple-600">{stats.interview}</p>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
          </div>

          {/* Quick Status */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Quick Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">SMTP Connection</span>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    smtp?.verified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {smtp?.verified ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Loops</span>
                <span className="text-sm font-medium text-gray-900">
                  {loops.filter((l) => l.isActive).length} / {loops.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Templates</span>
                <span className="text-sm font-medium text-gray-900">
                  {templates.length}
                </span>
              </div>
            </div>
          </div>

          {/* Setup checklist if incomplete */}
          {(!smtp?.verified || templates.length === 0 || loops.length === 0) && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Setup Checklist</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      smtp?.verified
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {smtp?.verified ? '1' : '1'}
                  </span>
                  <span className={`text-sm ${smtp?.verified ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    Connect your email (SMTP)
                  </span>
                  {!smtp?.verified && (
                    <button
                      onClick={() => setActiveTab('smtp')}
                      className="text-xs text-blue-600 hover:underline ml-auto"
                    >
                      Set up
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      templates.length > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    2
                  </span>
                  <span className={`text-sm ${templates.length > 0 ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    Create a cover letter template
                  </span>
                  {templates.length === 0 && (
                    <button
                      onClick={() => setActiveTab('templates')}
                      className="text-xs text-blue-600 hover:underline ml-auto"
                    >
                      Create
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      loops.length > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    3
                  </span>
                  <span className={`text-sm ${loops.length > 0 ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    Create your first auto-apply loop
                  </span>
                  {loops.length === 0 && (
                    <button
                      onClick={() => setActiveTab('loops')}
                      className="text-xs text-blue-600 hover:underline ml-auto"
                    >
                      Create
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loops Tab */}
      {activeTab === 'loops' && (
        <div>
          <LoopForm
            templates={templates}
            countries={countries}
            levels={levels}
            onLoopCreated={handleLoopCreated}
          />

          {loops.length === 0 ? (
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No auto-apply loops yet
              </h2>
              <p className="text-gray-600 mb-6">
                Create a loop to automatically apply to jobs matching your criteria
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {loops.map((loop) => (
                <div
                  key={loop.id}
                  className={`bg-white rounded-xl border p-6 ${
                    !loop.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{loop.name}</h3>

                      {/* Filters display */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {loop.jobTitles.map((title) => (
                          <span
                            key={title}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {title}
                          </span>
                        ))}
                        {loop.keywords && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {loop.keywords}
                          </span>
                        )}
                        {loop.country && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                            {getCountryName(loop.country)}
                          </span>
                        )}
                        {loop.level && (
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                            {getLevelName(loop.level)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm text-gray-500">
                          {loop.mode.toLowerCase()} mode
                        </span>
                        <span className="text-sm text-gray-500">
                          {loop.sentToday}/{loop.dailyLimit} today
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            loop.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {loop.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoopToggle(loop.id, loop.isActive)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          loop.isActive
                            ? 'text-gray-600 hover:bg-gray-100'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {loop.isActive ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => handleLoopDelete(loop.id)}
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
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <ApplicationsList initialApplications={applications} />
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <TemplateEditor
          initialTemplates={templates}
          onTemplateCreated={handleTemplateCreated}
          onTemplateDeleted={handleTemplateDeleted}
        />
      )}

      {/* SMTP Tab */}
      {activeTab === 'smtp' && (
        <SmtpSetup initialSmtp={smtp} onSmtpUpdated={handleSmtpUpdated} />
      )}
    </div>
  );
}
