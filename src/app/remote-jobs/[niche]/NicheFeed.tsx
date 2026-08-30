'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { CareerjetCard, useCareerjetJobs } from '@/components/careerjet/CareerjetCard';

export type NicheCard = {
  slug: string;
  title: string;
  company: string;
  location: string;
  level: string;
  skills: string[];
  createdAt: string;
};

const COLORS = ['#FF6B6B', '#A8E024', '#6EE7FF', '#FFB951', '#A78BFA', '#34D399', '#F87171', '#818CF8'];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NicheFeed({ cards, label, keywords }: { cards: NicheCard[]; label: string; keywords?: string }) {
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('all');
  const [level, setLevel] = useState('all');
  // Careerjet CPC jobs for this niche, interleaved into the feed (and used to fill an empty niche).
  // Best-effort: [] until loaded / on error. Keyed on the niche keywords or label.
  const cjJobs = useCareerjetJobs(keywords || label, 12);

  const locations = useMemo(() => {
    const set = new Map<string, number>();
    for (const c of cards) set.set(c.location, (set.get(c.location) || 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([l]) => l);
  }, [cards]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (loc !== 'all' && c.location !== loc) return false;
      if (level !== 'all' && c.level !== level) return false;
      if (term && !(c.title + ' ' + c.company + ' ' + c.skills.join(' ')).toLowerCase().includes(term)) return false;
      return true;
    });
  }, [cards, q, loc, level]);

  if (!cards.length) {
    // No own opportunities in this niche right now — fill the feed with Careerjet CPC jobs (still
    // monetizes the visit) if any loaded; otherwise the notify prompt.
    return (
      <div>
        {cjJobs.length > 0 && (
          <div className="flex flex-col gap-3 mb-8">
            {cjJobs.map((job, i) => <CareerjetCard key={job.url} job={job} index={i} variant="dark" />)}
          </div>
        )}
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <p className="text-[#A1A1AA] text-[15px]">The freshest {label} matches land in your feed — created for your profile.</p>
          <Link href="/auth/signin" className="inline-block mt-4 text-[#C7F94A] text-[14px]">Create a profile and get notified →</Link>
        </div>
      </div>
    );
  }

  const inputStyle = { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)', color: '#FAFAFA' };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${label} roles — skill, company…`}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg border text-[14px] outline-none"
          style={inputStyle}
        />
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className="px-3 py-2.5 rounded-lg border text-[14px] outline-none" style={inputStyle}>
          <option value="all">All locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="px-3 py-2.5 rounded-lg border text-[14px] outline-none" style={inputStyle}>
          <option value="all">All levels</option>
          <option value="JUNIOR">Junior</option>
          <option value="MID">Mid</option>
          <option value="SENIOR">Senior</option>
        </select>
      </div>

      <div className="text-[12px] text-[#6B7280] mb-4 font-mono">{filtered.length} of {cards.length} roles</div>

      {/* Feed */}
      <div className="flex flex-col gap-3">
        {filtered.map((c, i) => (
          <Fragment key={c.slug}>
          <Link
            href={`/freelance/${c.slug}`}
            className="flex gap-4 items-start rounded-2xl border p-5 transition-colors hover:border-[#C7F94A]/40"
            style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="w-10 h-10 rounded-lg grid place-items-center font-semibold text-[#0A0B0F] shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
              {c.company[0]?.toUpperCase() || 'F'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[15px] text-[#FAFAFA]">{c.title}</span>
                <span className="text-[11px] text-[#6B7280] font-mono">· {timeAgo(c.createdAt)}</span>
              </div>
              <div className="text-[13px] text-[#A1A1AA] mt-0.5">{c.company} · {c.location}</div>
              {c.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {c.skills.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-md text-[11px]" style={{ background: 'rgba(255,255,255,0.05)', color: '#D4D4D8' }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[13px] text-[#C7F94A] shrink-0 self-center hidden sm:block">View & apply →</span>
          </Link>
          {/* One Careerjet CPC card after every 4 opportunities (billable click on its tracking url). */}
          {(i + 1) % 4 === 0 && cjJobs[Math.floor((i + 1) / 4) - 1] && (
            <CareerjetCard job={cjJobs[Math.floor((i + 1) / 4) - 1]} index={i} variant="dark" />
          )}
          </Fragment>
        ))}
      </div>

      {/* Sign-up nudge under the feed */}
      <div className="mt-8 rounded-2xl border p-7 text-center" style={{ borderColor: 'rgba(199,249,74,0.25)', background: 'rgba(199,249,74,0.04)' }}>
        <p className="text-[15px] text-[#FAFAFA] font-medium mb-1">These are live, but the freshest matches land in your feed.</p>
        <p className="text-[13px] text-[#A1A1AA] mb-4">Create a profile — we match new {label} roles to you and draft each application for review.</p>
        <Link href="/auth/signin" className="inline-block px-6 py-3 rounded-full font-semibold text-[14px]" style={{ background: '#C7F94A', color: '#0A0B0F' }}>
          Start free · first application on us →
        </Link>
      </div>
    </div>
  );
}
