import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Freelanly — AI Outreach Engine for Freelancers',
  description: 'Be first in the inbox. Win the project. Freelanly catches new freelance gigs from LinkedIn and 3,500+ company sites, then sends a personalized AI application for you.',
  alternates: { canonical: siteConfig.url },
};

export default async function LandingPage() {
  const [totalUsers, totalCompanies, totalOpps] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600000) } } }),
  ]);

  return (
    <div style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <nav className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center" style={{ background: 'rgba(10,11,15,0.72)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-[1240px] mx-auto w-full px-8 flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-[17px]">
            <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center font-mono font-bold text-sm" style={{ background: '#C7F94A', color: '#000', boxShadow: '0 0 18px #C7F94A50' }}>F</span>
            <span>Freelanly</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 flex-1 text-[14px] text-[#A1A1AA]">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/freelance" className="hover:text-white transition-colors">Browse Jobs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-[14px] px-4 py-2 rounded-full border hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Sign in</Link>
            <Link href="/auth/signin" className="text-[14px] px-4 py-2 rounded-full font-semibold" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free →</Link>
          </div>
        </div>
      </nav>
      <header className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.16) 0%, transparent 55%)', filter: 'blur(40px)' }} />
        <div className="max-w-[1240px] mx-auto px-8 relative z-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-[#A1A1AA] px-3 py-1.5 rounded-full mb-6" style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C7F94A] animate-pulse" style={{ boxShadow: '0 0 10px #C7F94A' }} />
              {totalOpps.toLocaleString()} fresh gigs · updated every 3 hours
            </span>
            <h1 className="text-[clamp(48px,6.5vw,84px)] font-semibold tracking-tighter leading-none mb-6">Be first in the inbox.<br /><span className="text-[#C7F94A]">Win</span> the project.</h1>
            <p className="text-[19px] text-[#D4D4D8] leading-relaxed max-w-[60ch] mb-8">Freelanly catches new freelance gigs the moment they&apos;re posted on LinkedIn and <strong className="text-white">{totalCompanies.toLocaleString()}+</strong> company sites — then sends a personalized AI application for you.</p>
            <div className="flex gap-3 flex-wrap mb-6">
              <Link href="/auth/signin" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px] hover:-translate-y-px transition-transform" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free — no card needed →</Link>
              <Link href="/freelance" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] border hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Browse projects</Link>
            </div>
            <div className="flex gap-5 text-[13px] text-[#A1A1AA]">{['No credit card', 'First 25 applications free', 'Cancel anytime'].map(t => (<span key={t} className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7F94A" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>{t}</span>))}</div>
          </div>
        </div>
      </header>
      <section className="py-16"><div className="max-w-[1240px] mx-auto px-8"><div className="grid grid-cols-2 md:grid-cols-5 rounded-[14px] overflow-hidden" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>{[{ num: `${(totalUsers/1000).toFixed(1)}K+`, label: 'Freelancers' },{ num: `${totalOpps}+`, label: 'Projects today' },{ num: `${totalCompanies.toLocaleString()}+`, label: 'Companies' },{ num: '5.1%', label: 'Reply rate', accent: true },{ num: '90+', label: 'Countries' }].map((s, i) => (<div key={i} className="p-7 border-r last:border-r-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}><div className={`text-[32px] font-semibold tracking-tight ${s.accent ? 'text-[#C7F94A]' : ''}`}>{s.num}</div><div className="text-[13px] text-[#A1A1AA] mt-1">{s.label}</div></div>))}</div></div></section>
      <section className="py-24"><div className="max-w-[1240px] mx-auto px-8"><div className="mb-14"><span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— How it works</span><h2 className="text-[clamp(36px,4.4vw,56px)] font-semibold tracking-tighter mt-4">Three steps. Zero busywork.</h2><p className="text-[#D4D4D8] text-lg mt-3">Set your filters once. We hunt, write, and send while you do real work.</p></div><div className="grid md:grid-cols-3 gap-6">{[{ num: '01', title: 'Discover', sub: 'We find the gigs others miss', desc: 'Scrapes LinkedIn hiring posts and 3,500+ career pages every few hours.' },{ num: '02', title: 'Personalize', sub: 'AI writes a letter that sounds like you', desc: 'References your portfolio, opens with a human hook. No "I hope this email finds you well."' },{ num: '03', title: 'Send & follow up', sub: 'Tracked. Followed up. From your inbox.', desc: 'Track opens, replies. Sends a nudge after 5 days if they go quiet.' }].map(s => (<div key={s.num} className="p-7 rounded-[14px]" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}><div className="font-mono text-xs tracking-widest uppercase text-[#C7F94A] mb-4">{s.num} — {s.title}</div><h3 className="text-[22px] font-semibold tracking-tight mb-3">{s.sub}</h3><p className="text-[#A1A1AA] text-[15px] leading-relaxed">{s.desc}</p></div>))}</div></div></section>
      <section className="py-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))' }}><div className="max-w-[1240px] mx-auto px-8"><div className="mb-14"><span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— What&apos;s inside</span><h2 className="text-[clamp(36px,4.4vw,56px)] font-semibold tracking-tighter mt-4">Built to win replies, not send spam.</h2></div><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[{ t: 'AI cover letters', d: 'Reads the job post, references your portfolio. ~90 words. No fluff.' },{ t: 'Auto-apply engine', d: 'Set criteria once. Applications go out at human cadence.' },{ t: 'Auto follow-ups', d: 'If they go quiet for 5 days, one polite nudge. Then it stops.' },{ t: 'Reply & open tracking', d: 'Open rate, reply rate, interview rate by template.' },{ t: 'Pipeline / Kanban', d: 'Sent → Opened → Replied → Interview → Offer.' },{ t: 'Send from your inbox', d: 'OAuth into Gmail. Sends as you, replies route back.' }].map(f => (<div key={f.t} className="p-6 rounded-[14px] hover:border-white/15 transition-colors" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}><h3 className="text-[18px] font-semibold tracking-tight mb-2">{f.t}</h3><p className="text-[#A1A1AA] text-[14px] leading-relaxed">{f.d}</p></div>))}</div></div></section>
      <section className="py-24"><div className="max-w-[1240px] mx-auto px-8"><div className="mb-14"><span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Real freelancers</span><h2 className="text-[clamp(36px,4.4vw,56px)] font-semibold tracking-tighter mt-4">Less refreshing job boards. More billable work.</h2></div><div className="grid md:grid-cols-3 gap-6">{[{ q: 'I went from 4 client emails a month to 6 in a week. The cover letters genuinely sound like me.', n: 'Alex K.', r: 'Full-stack · Warsaw', c: '#C7F94A' },{ q: 'The "first in the inbox" thing is real. I landed a brand sprint because Freelanly caught the post 18 hours early.', n: 'Sofia D.', r: 'Brand designer · Lisbon', c: '#FF6B6B' },{ q: 'I paid for one month and got two retainers. The auto-follow-up alone is worth the subscription.', n: 'Ravi T.', r: 'iOS dev · Bangalore', c: '#6EE7FF' }].map(t => (<div key={t.n} className="p-7 rounded-[14px]" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}><blockquote className="text-[15px] leading-relaxed text-[#D4D4D8] mb-6">&quot;{t.q}&quot;</blockquote><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full grid place-items-center font-mono font-semibold text-xs text-black" style={{ background: t.c }}>{t.n.split(' ').map(w=>w[0]).join('')}</div><div><div className="text-[13.5px] font-medium">{t.n}</div><div className="text-[12px] text-[#6B7280]">{t.r}</div></div></div></div>))}</div></div></section>
      <section className="py-24 relative overflow-hidden"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} /><div className="max-w-[800px] mx-auto px-8 text-center relative z-10"><span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Start today</span><h2 className="text-[clamp(36px,4.4vw,56px)] font-semibold tracking-tighter mt-4 mb-5">Your next client is <span className="text-[#C7F94A]">already posting.</span><br />Get there first.</h2><p className="text-[#D4D4D8] text-lg mb-8 max-w-[50ch] mx-auto">Free for your first 25 applications. No credit card. Plug in your CV, pick your filters, and see what comes back.</p><div className="flex gap-3 justify-center flex-wrap"><Link href="/auth/signin" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px] hover:-translate-y-px transition-transform" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free →</Link><Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] border hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>See pricing</Link></div></div></section>
      <footer className="pt-20 pb-10" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}><div className="max-w-[1240px] mx-auto px-8"><div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16"><div className="col-span-2 md:col-span-1"><Link href="/" className="flex items-center gap-2.5 font-semibold mb-4"><span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center font-mono font-bold text-sm" style={{ background: '#C7F94A', color: '#000' }}>F</span>Freelanly</Link><p className="text-[14px] text-[#A1A1AA] max-w-[260px]">AI outreach engine for freelancers.</p></div>{[{t:'Product',l:[['Pricing','/pricing'],['Browse Jobs','/freelance'],['Companies','/companies']]},{t:'Resources',l:[['Blog','/blog'],['Contact','mailto:hi@freelanly.com']]},{t:'Legal',l:[['Privacy','/privacy'],['Terms','/terms']]}].map(c=>(<div key={c.t}><h5 className="font-mono text-[11px] tracking-widest uppercase text-[#6B7280] mb-4">{c.t}</h5><ul className="space-y-2.5">{c.l.map(([l,h])=>(<li key={l}><Link href={h} className="text-[14px] text-[#D4D4D8] hover:text-[#C7F94A] transition-colors">{l}</Link></li>))}</ul></div>))}</div><div className="flex justify-between items-center pt-8 text-[13px] text-[#6B7280]" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}><span>© 2026 Freelanly</span><span>Made for freelancers who&apos;d rather be working.</span></div></div></footer>
    </div>
  );
}
