import Link from 'next/link';

interface ProjectDetailProps {
  opportunity: {
    id: string;
    title: string;
    description: string;
    companyName: string;
    clientName: string;
    clientHeadline?: string | null;
    clientAvatar?: string | null;
    clientLinkedIn?: string;
    source?: string;
    sourceUrl?: string | null;
    skills: string[];
    locationType?: string | null;
    location?: string | null;
    level?: string | null;
    salary?: string | null;
    createdAt: Date;
    category?: { name: string; slug: string } | null;
    originalContent?: string | null;
  };
  totalProjectCount: number;
  isLoggedIn: boolean;
  postedAgo: string;
}

export function ProjectDetailNew({ opportunity, totalProjectCount, isLoggedIn, postedAgo }: ProjectDetailProps) {
  const initials = opportunity.clientName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'FL';
  const colors = ['#5E6AD2', '#FF6B6B', '#FFB951', '#6EE7FF', '#A78BFA', '#34D399', '#F87171'];
  const logoColor = colors[opportunity.title.length % colors.length];

  return (
    <div style={{ background: '#F7F6F1', minHeight: '100vh', paddingBottom: isLoggedIn ? 0 : 132 }}>
      {/* Public header */}
      <header className="sticky top-0 z-30" style={{ background: 'rgba(247,246,241,0.88)', backdropFilter: 'saturate(140%) blur(12px)', borderBottom: '1px solid rgba(11,12,15,0.07)' }}>
        <div className="max-w-[1180px] mx-auto px-6 py-3.5 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-base">
            <span className="w-7 h-7 rounded-lg bg-[#0A0B0F] text-[#C7F94A] grid place-items-center font-mono font-bold text-sm">F</span>
            <span>Freelanly</span>
          </Link>
          <nav className="hidden md:flex gap-5 ml-7">
            <Link href="/how-it-works" className="text-[13.5px] text-[#5C6068] hover:text-[#0A0B0F]">How it works</Link>
            <Link href="/pricing" className="text-[13.5px] text-[#5C6068] hover:text-[#0A0B0F]">Pricing</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <Link href="/auth/login" className="text-[13.5px] text-[#5C6068] hover:text-[#0A0B0F]">Sign in</Link>
            <Link href="/auth/signin" className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#C7F94A] text-black">Sign up free</Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1180px] mx-auto px-6 pt-7 pb-12">
        {/* Back link */}
        <Link href="/freelance" className="inline-flex items-center gap-2 font-mono text-xs text-[#5C6068] hover:text-[#0A0B0F] mb-5">
          ← Browse all <span className="text-[#0A0B0F]">{totalProjectCount.toLocaleString('en-US')}</span> open projects
        </Link>

        {/* Hero */}
        <div className="grid grid-cols-[80px_1fr] md:grid-cols-[80px_1fr] gap-5 items-start mb-7">
          <div className="w-20 h-20 rounded-[18px] grid place-items-center font-mono font-bold text-4xl text-white" style={{ background: logoColor }}>
            {opportunity.companyName?.[0] || 'F'}
          </div>
          <div>
            <h1 className="text-[clamp(28px,4vw,40px)] font-medium tracking-tight leading-[1.1] mb-2">{opportunity.title}</h1>
            <p className="text-[15px] text-[#5C6068] mb-3.5">
              <strong className="text-[#0A0B0F]">{opportunity.companyName}</strong> · {postedAgo} · spotted on{' '}
              {opportunity.sourceUrl ? <a href={opportunity.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[3px] decoration-[#E6E3D8] hover:text-[#0A0B0F]">LinkedIn</a> : 'LinkedIn'}
              {opportunity.clientName && ` via ${opportunity.clientName}`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {opportunity.skills?.slice(0, 5).map(s => (
                <span key={s} className="px-2.5 py-1 rounded-full text-xs font-mono bg-[#C7F94A] text-black font-medium">{s}</span>
              ))}
              {opportunity.locationType && <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-white border border-[rgba(11,12,15,0.12)]">{opportunity.location || opportunity.locationType}</span>}
              {opportunity.level && <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-white border border-[rgba(11,12,15,0.12)]">{opportunity.level}</span>}
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 rounded-[14px] overflow-hidden mb-7 bg-white" style={{ border: '1px solid rgba(11,12,15,0.07)' }}>
          {[
            { lbl: 'Engagement', val: opportunity.locationType === 'REMOTE' ? 'Remote' : opportunity.locationType || 'Flexible', sub: opportunity.level || 'Any level' },
            { lbl: 'Timezone', val: opportunity.location || 'Flexible', sub: '' },
            { lbl: 'Category', val: opportunity.category?.name || 'General', sub: '' },
            { lbl: 'Posted', val: postedAgo, sub: '' },
          ].map((m, i) => (
            <div key={i} className="px-5 py-4" style={{ borderRight: i < 3 ? '1px solid rgba(11,12,15,0.07)' : 'none' }}>
              <div className="font-mono text-[10.5px] tracking-widest uppercase text-[#8A8E96] mb-1.5">{m.lbl}</div>
              <div className="text-[15px] font-medium">{m.val}</div>
              {m.sub && <div className="text-xs text-[#5C6068] mt-0.5">{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* Two column grid */}
        <div className="grid md:grid-cols-[1fr_340px] gap-7 items-start">
          {/* LEFT: Job description */}
          <div>
            <div className="mb-9">
              <h2 className="font-mono text-[14px] tracking-wider uppercase text-[#8A8E96] font-medium mb-3.5">The project</h2>
              <div className="text-[15.5px] leading-[1.7] text-[#2F3138] whitespace-pre-line" dangerouslySetInnerHTML={{ __html: (opportunity.description || '').replace(/\n/g, '<br/>') }} />
            </div>

            {/* AI application preview (blurred for non-logged-in) */}
            <div className="mb-9">
              <h2 className="font-mono text-[14px] tracking-wider uppercase text-[#8A8E96] font-medium mb-3.5">What Freelanly would send for you</h2>
              <div className="rounded-[14px] overflow-hidden bg-white" style={{ border: '1px solid rgba(11,12,15,0.07)' }}>
                <div className="px-4 py-3 flex justify-between items-center text-xs font-mono text-[#5C6068]" style={{ background: '#F0EEE6', borderBottom: '1px solid rgba(11,12,15,0.07)' }}>
                  <span>From <strong className="text-[#0A0B0F]">you</strong> → {opportunity.clientName || 'recruiter'}</span>
                  <span>AI-personalized · 19s to write</span>
                </div>
                <div className="px-6 py-5 text-[14.5px] leading-[1.65] text-[#2F3138] relative">
                  <p className="mb-3">Hi <span className="bg-[rgba(199,249,74,0.2)] px-1 rounded text-[#0A0B0F] font-medium">{opportunity.clientName?.split(' ')[0] || 'Hiring Manager'}</span>,</p>
                  <p className="mb-3">Saw your post — I&apos;ve <span className="bg-[rgba(199,249,74,0.2)] px-1 rounded text-[#0A0B0F] font-medium">[your strongest relevant story]</span> and it&apos;s the work I&apos;m proudest of.</p>
                  <p className="mb-3">I&apos;m <span className="bg-[rgba(199,249,74,0.2)] px-1 rounded text-[#0A0B0F] font-medium">[your location]</span>, available <span className="bg-[rgba(199,249,74,0.2)] px-1 rounded text-[#0A0B0F] font-medium">[your availability]</span>.</p>
                  <p>Quick call this week? Portfolio: <span className="bg-[rgba(199,249,74,0.2)] px-1 rounded text-[#0A0B0F] font-medium">[your link]</span></p>
                  {!isLoggedIn && (
                    <div className="absolute left-0 right-0 bottom-0 h-[70px] flex items-end justify-center pb-3.5 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, white 75%)' }}>
                      <span className="font-mono text-[11.5px] text-[#5C6068] bg-white px-3 py-1.5 rounded-full border border-[rgba(11,12,15,0.07)]">Sign up to see your personalized version →</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dark callout */}
            <div className="rounded-[14px] p-5 bg-[#0A0B0F] text-[#E8E8E3] grid md:grid-cols-[auto_1fr_auto] gap-4 items-center">
              <div className="w-[42px] h-[42px] rounded-xl bg-[#C7F94A] text-black grid place-items-center font-mono font-semibold">⚡</div>
              <div className="text-[14px] leading-relaxed text-[#9C9EA2]">
                <strong className="text-[#E8E8E3]">Spotted {postedAgo}</strong> — applications under 20 so far. Apply now and you&apos;re in the top of their inbox.
              </div>
              <Link href="/auth/signin" className="px-4 py-2.5 rounded-[10px] bg-[#C7F94A] text-black text-[13.5px] font-medium whitespace-nowrap">Apply with one click →</Link>
            </div>
          </div>

          {/* RIGHT: Poster + match + signals */}
          <div>
            {/* Poster card */}
            <div className="rounded-[14px] p-5 mb-4 bg-white" style={{ border: '1px solid rgba(11,12,15,0.07)' }}>
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-[#8A8E96] font-medium mb-3.5">Posted by</h3>
              <div className="grid grid-cols-[48px_1fr] gap-3 items-center">
                {opportunity.clientAvatar ? (
                  <img src={opportunity.clientAvatar} alt={opportunity.clientName} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#C7F94A] grid place-items-center font-mono font-semibold text-sm text-black">{initials}</div>
                )}
                <div>
                  <div className="text-[14px] font-medium">{opportunity.clientName}</div>
                  <div className="text-[12.5px] text-[#5C6068] mt-0.5">{opportunity.clientHeadline || opportunity.companyName}</div>
                </div>
              </div>
              {opportunity.clientLinkedIn && (
                <a href={opportunity.clientLinkedIn} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-3 text-[12.5px] text-[#5C6068] hover:text-[#0A0B0F] font-mono">
                  View on LinkedIn →
                </a>
              )}
            </div>

            {/* Match score (blurred for non-logged-in) */}
            <div className="rounded-[14px] p-5 mb-4 bg-white text-center" style={{ border: '1px solid rgba(11,12,15,0.07)' }}>
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-[#8A8E96] font-medium mb-3.5">Your match</h3>
              {isLoggedIn ? (
                <div>
                  <div className="w-[88px] h-[88px] rounded-full bg-[#C7F94A] grid place-items-center mx-auto mb-3.5 font-mono text-[32px] font-semibold text-black relative">
                    ?
                    <div className="absolute -inset-1.5 rounded-full border-[1.5px] border-dashed border-[#4D8B0A] opacity-40" />
                  </div>
                  <div className="text-[14px] font-medium">Upload CV to see match</div>
                </div>
              ) : (
                <div>
                  <div className="w-[88px] h-[88px] rounded-full bg-[#F0EEE6] grid place-items-center mx-auto mb-3.5 text-[14px] text-[#8A8E96] blur-[2px]">??</div>
                  <div className="text-[14px] font-medium">Get my match score</div>
                  <div className="text-[12px] text-[#5C6068] mt-1">takes 30 seconds · free</div>
                  <Link href="/auth/signin" className="inline-block mt-3 px-4 py-2 rounded-full text-[12.5px] font-medium bg-[#0A0B0F] text-white">Sign up →</Link>
                </div>
              )}
            </div>

            {/* Signal card */}
            <div className="rounded-[14px] p-5 bg-white" style={{ border: '1px solid rgba(11,12,15,0.07)' }}>
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-[#8A8E96] font-medium mb-3.5">Why this is on the board</h3>
              <ul className="space-y-2.5 text-[13px] text-[#2F3138]">
                <li className="flex items-start gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4D8B0A" strokeWidth="2.5" className="mt-0.5 flex-shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                  Trending today — high engagement on original post
                </li>
                <li className="flex items-start gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4D8B0A" strokeWidth="2.5" className="mt-0.5 flex-shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                  {opportunity.skills?.length > 0 ? `Requires: ${opportunity.skills.slice(0, 3).join(', ')}` : 'Rare skill combination'}
                </li>
                <li className="flex items-start gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4D8B0A" strokeWidth="2.5" className="mt-0.5 flex-shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                  Low competition window — apply early
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky CTA banner for unauthenticated users */}
      {!isLoggedIn && (
        <div className="fixed bottom-0 left-0 right-0 z-50" style={{ background: '#0A0B0F', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-4 py-3.5 px-6 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-wider uppercase px-2.5 py-1 rounded-full" style={{ background: 'rgba(199,249,74,0.15)', color: '#C7F94A', border: '1px solid rgba(199,249,74,0.3)' }}>
                1 of {totalProjectCount.toLocaleString('en-US')}
              </span>
              <span className="text-[14px] text-[#E8E8E3]">
                open projects. <span className="text-[#9C9EA2]">Sign up — AI applies to all of them for you.</span>
              </span>
            </div>
            <Link href="/auth/signin" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-[14px] whitespace-nowrap hover:-translate-y-px transition-transform bg-[#C7F94A] text-black">
              Start free →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
