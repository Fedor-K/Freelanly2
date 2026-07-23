'use client';

import { useEffect, useState } from 'react';

interface PublicStats {
  signingUpNow: number;
  totalFreelancers: number;
  projectsToday: number;
  replyRate: number;
  medianTimeToSpot: string;
}

export function TrustPanel() {
  const [stats, setStats] = useState<PublicStats>({
    signingUpNow: 1,
    totalFreelancers: 6000,
    projectsToday: 300,
    replyRate: 2.0,
    medianTimeToSpot: '~15 min',
  });

  useEffect(() => {
    fetch('/api/public/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div
      className="hidden lg:flex flex-col justify-between relative overflow-hidden px-12 py-12"
      style={{ background: '#0A0B0F', color: '#E8E8E3' }}
    >
      {/* Acid glow */}
      <div
        className="absolute -top-[120px] -right-[120px] w-[360px] h-[360px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.12) 0%, transparent 70%)' }}
      />

      {/* Top */}
      <div>
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-[#9C9EA2] relative">
          Live · last 24h
        </div>
        <div className="mt-5 relative">
          <div className="font-mono text-[clamp(48px,5vw,64px)] font-medium leading-none tracking-tight text-[#C7F94A]">
            {stats.projectsToday.toLocaleString()}
          </div>
          <div className="text-[17px] leading-snug mt-3 max-w-[30ch]">
            fresh projects routed today across LinkedIn and career pages.
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-6 mt-7 relative">
          <div>
            <div className="font-mono text-[22px] font-medium">{stats.replyRate}%</div>
            <div className="text-[11.5px] text-[#9C9EA2] mt-0.5">avg reply rate</div>
          </div>
          <div>
            <div className="font-mono text-[22px] font-medium">{stats.medianTimeToSpot}</div>
            <div className="text-[11.5px] text-[#9C9EA2] mt-0.5">median time-to-spot</div>
          </div>
          <div>
            <div className="font-mono text-[22px] font-medium">{(stats.totalFreelancers / 1000).toFixed(1)}K+</div>
            <div className="text-[11.5px] text-[#9C9EA2] mt-0.5">tech candidates</div>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="flex flex-col gap-3.5 mt-9 relative">
        <div
          className="rounded-[14px] p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full grid place-items-center font-mono font-semibold text-xs text-black" style={{ background: '#C7F94A' }}>
              MR
            </div>
            <div>
              <div className="text-[13.5px] font-medium">Fresh-source discovery</div>
              <div className="text-[12px] text-[#9C9EA2]">LinkedIn posts · career pages</div>
            </div>
          </div>
          <div className="text-[13.5px] leading-relaxed">
            Freelanly catches hiring posts on LinkedIn and career pages I&apos;d never find scrolling — and the cover letter is already written when I open a match.
          </div>
        </div>

        <div
          className="rounded-[14px] p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full grid place-items-center font-mono font-semibold text-xs text-black" style={{ background: '#FF6B6B' }}>
              JK
            </div>
            <div>
              <div className="text-[13.5px] font-medium">Send from your Gmail</div>
              <div className="text-[12px] text-[#9C9EA2]">one-click connect</div>
            </div>
          </div>
          <div className="text-[13.5px] leading-relaxed">
            Applications send from your own Gmail — recruiters reply to a real inbox, and it shows.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center font-mono text-[11.5px] text-[#9C9EA2] relative mt-7">
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-[#C7F94A] animate-pulse" style={{ boxShadow: '0 0 10px #C7F94A' }} />
          {stats.signingUpNow} {stats.signingUpNow === 1 ? 'person' : 'people'} signing up right now
        </span>
        <span>GDPR-ready</span>
      </div>
    </div>
  );
}
