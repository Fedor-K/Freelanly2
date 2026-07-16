import Link from 'next/link';

export function MarketingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center" style={{ background: 'rgba(10,11,15,0.72)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="max-w-[1240px] mx-auto w-full px-8 flex items-center gap-10">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-[17px]">
          <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center font-mono font-bold text-sm" style={{ background: '#C7F94A', color: '#000', boxShadow: '0 0 18px #C7F94A50' }}>F</span>
          <span>Freelanly</span>
        </Link>
        <div className="hidden md:flex items-center gap-7 flex-1 text-[14px] text-[#A1A1AA]">
          <Link href="/how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="/features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-[14px] px-4 py-2 rounded-full border hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Sign in</Link>
          <Link href="/auth/signin" className="text-[14px] px-4 py-2 rounded-full font-semibold hover:-translate-y-px transition-transform" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free →</Link>
        </div>
      </div>
    </nav>
  );
}

export function MarketingCTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
      <div className="max-w-[800px] mx-auto px-8 text-center relative z-10">
        <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Start today</span>
        <h2 className="text-[clamp(36px,4.4vw,56px)] font-semibold tracking-tighter mt-4 mb-5">Your next client is <span className="text-[#C7F94A]">already posting.</span><br />Get there first.</h2>
        <p className="text-[#D4D4D8] text-lg mb-8 max-w-[50ch] mx-auto">Sign up free — your first application is on us. No credit card required.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/auth/signin" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px] hover:-translate-y-px transition-transform" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free →</Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] border hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>See pricing</Link>
        </div>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="pt-20 pb-10" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 font-semibold mb-4">
              <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center font-mono font-bold text-sm" style={{ background: '#C7F94A', color: '#000' }}>F</span>Freelanly
            </Link>
            <p className="text-[14px] text-[#A1A1AA] max-w-[260px]">Personal AI assistant for vacancies and projects application.</p>
          </div>
          {[
            { t: 'Product', l: [['How it works', '/how-it-works'], ['Features', '/features'], ['Pricing', '/pricing']] },
            { t: 'Resources', l: [['Blog', '/blog'], ['Apply Guides', '/apply-guides'], ['About', '/about'], ['FAQ', '/about#faq']] },
            { t: 'Legal', l: [['Privacy', '/privacy'], ['Terms', '/terms']] },
          ].map(c => (
            <div key={c.t}>
              <h5 className="font-mono text-[11px] tracking-widest uppercase text-[#6B7280] mb-4">{c.t}</h5>
              <ul className="space-y-2.5">{c.l.map(([l, h]) => (<li key={l}><Link href={h} className="text-[14px] text-[#D4D4D8] hover:text-[#C7F94A] transition-colors">{l}</Link></li>))}</ul>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-8 text-[13px] text-[#6B7280]" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span>© 2026 Freelanly</span>
          <span>Made for freelancers who&apos;d rather be working.</span>
        </div>
      </div>
    </footer>
  );
}
