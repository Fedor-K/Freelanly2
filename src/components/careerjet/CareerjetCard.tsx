'use client';

import { useEffect, useState } from 'react';
import type { CareerjetJob } from '@/lib/careerjet';

const COLORS = ['#FF6B6B', '#A8E024', '#6EE7FF', '#FFB951', '#A78BFA', '#34D399', '#F87171', '#818CF8'];

/**
 * Fetch Careerjet CPC jobs for the current visitor (their real IP/geo is read server-side by the
 * /api/careerjet route). Returns [] until loaded or on any error, so callers just render nothing extra.
 */
export function useCareerjetJobs(keywords: string, pageSize = 8): CareerjetJob[] {
  const [jobs, setJobs] = useState<CareerjetJob[]>([]);
  useEffect(() => {
    const kw = (keywords || '').trim();
    if (!kw) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/careerjet?keywords=${encodeURIComponent(kw)}&page_size=${pageSize}`);
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data.jobs)) setJobs(data.jobs);
      } catch { /* best-effort — feed shows only our own opportunities */ }
    })();
    return () => { alive = false; };
  }, [keywords, pageSize]);
  return jobs;
}

// Best-effort client click log (reconciles with Careerjet's own dashboard). JOB_SOURCE_CLICK is an
// existing ActivityAction; details carry source='careerjet'. Fire-and-forget beacon — the href still
// navigates to the tracking url regardless.
function logClick(job: CareerjetJob) {
  try {
    const payload = JSON.stringify({
      events: [{
        action: 'JOB_SOURCE_CLICK',
        details: { source: 'careerjet', title: job.title, company: job.company, url: job.url },
        pageUrl: typeof location !== 'undefined' ? location.href : undefined,
      }],
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch { /* non-critical */ }
}

function salaryLine(job: CareerjetJob): string | null {
  if (!job.salary) return null;
  const per = ({ Y: '/yr', M: '/mo', W: '/wk', D: '/day', H: '/hr' } as Record<string, string>)[job.salary_type || ''] || '';
  return `${job.salary}${per}`;
}

/**
 * A single Careerjet CPC job, styled to match the surrounding feed. Links out to the tracking url
 * (target=_blank, rel="nofollow sponsored") and is labelled "Sponsored" — it leaves our site, so we
 * disclose it. `variant`: 'dark' = public NicheFeed (Tailwind), 'light' = dashboard DiscoveryFeed
 * (bespoke .job-card global CSS).
 */
export function CareerjetCard({ job, index = 0, variant }: { job: CareerjetJob; index?: number; variant: 'dark' | 'light' }) {
  const color = COLORS[index % COLORS.length];
  const sal = salaryLine(job);
  const letter = job.company?.[0]?.toUpperCase() || 'J';

  if (variant === 'dark') {
    return (
      <a
        href={job.url}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        onClick={() => logClick(job)}
        className="flex gap-4 items-start rounded-2xl border p-5 transition-colors hover:border-[#C7F94A]/40"
        style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="w-10 h-10 rounded-lg grid place-items-center font-semibold text-[#0A0B0F] shrink-0" style={{ background: color }}>
          {letter}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] text-[#FAFAFA]">{job.title}</span>
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded" style={{ color: '#9CA3AF', background: 'rgba(255,255,255,0.06)' }}>Sponsored</span>
          </div>
          <div className="text-[13px] text-[#A1A1AA] mt-0.5">
            {job.company}{job.locations ? ` · ${job.locations}` : ''}{sal ? ` · ${sal}` : ''}
          </div>
        </div>
        <span className="text-[13px] text-[#C7F94A] shrink-0 self-center hidden sm:block">Apply on Careerjet →</span>
      </a>
    );
  }

  // light — dashboard .job-card grid (40px 1fr auto)
  return (
    <a
      href={job.url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={() => logClick(job)}
      className="job-card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="logo" style={{ background: color }}>{letter}</div>
      <div>
        <div className="row gap-2">
          <div className="job-title">{job.title}</div>
          <span className="chip">Sponsored</span>
        </div>
        <div className="job-company">{job.company ? `${job.company} · ` : ''}via Careerjet</div>
        <div className="job-meta">
          {job.locations && <span className="tag">{job.locations}</span>}
          {sal && <span className="tag">{sal}</span>}
        </div>
      </div>
      <div className="job-right">
        <div className="job-actions">
          <span className="btn btn-primary btn-sm">Apply on Careerjet →</span>
        </div>
      </div>
    </a>
  );
}
