import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      {/* Nav */}
      <nav className="h-16 flex items-center px-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(10,11,15,0.72)', backdropFilter: 'blur(20px)' }}>
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-[17px]">
          <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center font-mono font-bold text-sm" style={{ background: '#C7F94A', color: '#000' }}>F</span>
          <span>Freelanly</span>
        </Link>
        <div className="hidden md:flex items-center gap-7 ml-10 text-sm text-[#A1A1AA]">
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
          <Link href="/freelance" className="hover:text-white">Browse Jobs</Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/auth/login" className="text-sm px-4 py-2 rounded-full border text-white hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Sign in</Link>
          <Link href="/auth/signin" className="text-sm px-4 py-2 rounded-full font-semibold" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free</Link>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 grid md:grid-cols-2 items-center gap-16 max-w-[1240px] mx-auto px-8 py-20 relative">
        {/* Glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[260px] -left-[180px] w-[740px] h-[740px] rounded-full blur-[20px]" style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.20) 0%, transparent 60%)' }} />
          <div className="absolute -bottom-[300px] -right-[200px] w-[680px] h-[680px] rounded-full blur-[20px]" style={{ background: 'radial-gradient(circle, rgba(110,231,255,0.10) 0%, transparent 60%)' }} />
        </div>

        {/* Left */}
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2.5 font-mono text-xs tracking-widest uppercase text-[#A1A1AA] px-3 py-1.5 rounded-full mb-7" style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" style={{ boxShadow: '0 0 10px #F87171' }} />
            Error 404 · page not found
          </span>

          <h1 className="text-[clamp(48px,7vw,88px)] font-semibold tracking-tighter leading-none mb-6">
            That gig got <span className="text-[#C7F94A] italic font-medium">snapped up.</span>
          </h1>
          <p className="text-lg text-[#D4D4D8] leading-relaxed mb-9 max-w-[44ch]">
            The page you&apos;re after either moved, never existed, or was filled before you got here. The good news — we&apos;re already scanning job boards for the next one.
          </p>

          <div className="flex gap-3 flex-wrap mb-9">
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-[15px] hover:-translate-y-px transition-transform" style={{ background: '#C7F94A', color: '#0A0B0F' }}>
              Take me home →
            </Link>
            <Link href="/auth/signin" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[15px] border hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
              Start applying free
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 max-w-[480px]">
            {[
              { href: '/freelance', label: 'Browse gigs', sub: 'discovery · live feed' },
              { href: '/pricing', label: 'Pricing', sub: 'from $0 · cancel anytime' },
              { href: '/freelance/engineering', label: 'Engineering', sub: 'react · python · devops' },
              { href: '/freelance/design', label: 'Design', sub: 'product · brand · ux' },
            ].map(link => (
              <Link key={link.href} href={link.href} className="grid grid-cols-[1fr_14px] gap-3 items-center p-3.5 rounded-xl transition-all hover:-translate-y-px hover:border-white/20" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div className="text-[13.5px] font-medium">{link.label}</div>
                  <div className="font-mono text-[10.5px] text-[#6B7280] mt-0.5">{link.sub}</div>
                </div>
                <span className="text-[#A1A1AA]">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right — Giant 404 */}
        <div className="relative z-10 hidden md:block">
          <div className="text-center select-none" style={{ fontSize: 'clamp(220px,32vw,380px)', fontWeight: 500, letterSpacing: '-0.06em', lineHeight: '0.85', color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.14)' }} aria-hidden="true">
            404
          </div>

          {/* Trace card */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-full max-w-[380px] rounded-xl overflow-hidden font-mono text-[11.5px] leading-relaxed" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 30px 60px -10px rgba(0,0,0,0.6)' }}>
            <div className="flex justify-between items-center px-3.5 py-2 text-[10.5px] tracking-widest uppercase text-[#A1A1AA]" style={{ background: '#14171F', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span>GET request trace</span>
              <span className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF6058]" />
                <span className="w-2 h-2 rounded-full bg-[#FFBD2E]" />
                <span className="w-2 h-2 rounded-full bg-[#28C840]" />
              </span>
            </div>
            <div className="p-3.5 text-[#D4D4D8]">
              <div className="flex gap-2.5"><span className="text-[#6B7280]">19:04:21</span><span>resolving freelanly.com…</span></div>
              <div className="flex gap-2.5"><span className="text-[#6B7280]">19:04:21</span><span className="text-[#C7F94A]">✓ TLS 1.3 · 142ms</span></div>
              <div className="flex gap-2.5"><span className="text-[#6B7280]">19:04:22</span><span>routing <span className="text-white">/page-not-found</span></span></div>
              <div className="flex gap-2.5"><span className="text-[#6B7280]">19:04:22</span><span className="text-[#F87171]">✕ 404 · no such route</span></div>
              <div className="flex gap-2.5"><span className="text-[#6B7280]">19:04:23</span><span>↳ best guess: <span className="text-white">/freelance</span><span className="inline-block w-[7px] h-3 bg-[#C7F94A] ml-1 animate-pulse" /></span></div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <div className="flex justify-between items-center px-8 py-4 font-mono text-[11px] text-[#6B7280]" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" style={{ boxShadow: '0 0 8px #4ADE80' }} />
          All systems operational
        </div>
        <a href="mailto:hi@freelanly.com" className="text-[#A1A1AA] hover:text-[#C7F94A]">Tell us what you were looking for →</a>
      </div>
    </div>
  );
}
