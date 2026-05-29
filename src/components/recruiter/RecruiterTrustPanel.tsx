// Right-side converting panel for the recruiter sign-in, mirroring the candidate auth
// (dark + acid glow). Honest by design: value props only — NO fabricated stats or
// testimonials (this is a trust surface; fake numbers would undercut it).
export function RecruiterTrustPanel() {
  const points: [string, string][] = [
    ['Matched to your post', 'Sorted by fit — the skills and languages from the role you actually posted.'],
    ['See who’s active', 'A live badge flags candidates currently job-seeking, so you don’t chase ghosts.'],
    ['Reply in one click', 'CV, profile and your reply — all in one inbox. No password, no setup.'],
  ];
  return (
    <div
      className="hidden lg:flex flex-col justify-between relative overflow-hidden px-12 py-12"
      style={{ background: '#0A0B0F', color: '#E8E8E3' }}
    >
      <div
        className="absolute -top-[120px] -right-[120px] w-[360px] h-[360px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.12) 0%, transparent 70%)' }}
      />
      <div className="relative">
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-[#9C9EA2]">For recruiters</div>
        <div className="text-[clamp(28px,3.2vw,40px)] font-medium leading-[1.12] tracking-tight max-w-[18ch] mt-5">
          Candidates who <span className="text-[#C7F94A]">applied to you</span> — lined up and matched.
        </div>
        <div className="text-[15.5px] leading-snug mt-4 max-w-[34ch] text-[#B7B9BD]">
          No job board to manage. People apply to your posts; we put them here so you can review CVs and reply in one place.
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-9 relative">
        {points.map(([t, s]) => (
          <div
            key={t}
            className="rounded-[14px] p-4 flex gap-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="w-[7px] h-[7px] rounded-full bg-[#C7F94A] mt-[6px] flex-shrink-0" style={{ boxShadow: '0 0 10px #C7F94A' }} />
            <div>
              <div className="text-[14px] font-medium">{t}</div>
              <div className="text-[13px] text-[#9C9EA2] mt-0.5 leading-relaxed">{s}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center font-mono text-[11.5px] text-[#9C9EA2] mt-7 relative">
        <span>Free to review &amp; reply</span>
        <span>GDPR-ready</span>
      </div>
    </div>
  );
}
