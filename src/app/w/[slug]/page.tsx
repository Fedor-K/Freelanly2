import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { watcherBySlug, WATCHERS } from '@/config/watchers';
import '../../marketing-styles.css';
import '../../landing-design.css';

export const revalidate = 300;

export function generateStaticParams() {
  return WATCHERS.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const w = watcherBySlug((await params).slug);
  if (!w) return {};
  const url = `https://${w.hosts[0]}`;
  return {
    title: `${w.name} — Remote ${w.roleShort} Jobs Before They Hit the Boards`,
    description: w.heroTagline,
    alternates: { canonical: url },
    openGraph: { title: w.name, description: w.heroTagline, url, type: 'website' },
  };
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Watcher landing — GroupsWatcher skeleton, one niche, zero Freelanly branding.
 * The stream is REAL: latest niche roles from the shared engine's DB.
 */
export default async function WatcherLanding({ params }: { params: Promise<{ slug: string }> }) {
  const w = watcherBySlug((await params).slug);
  if (!w) notFound();

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const pool = await prisma.opportunity.findMany({
    where: { isActive: true, createdAt: { gte: weekAgo }, applyEmail: { not: null } },
    select: { id: true, slug: true, title: true, skills: true, createdAt: true, location: true, clientAvatar: true, clientName: true, posterCompany: true },
    orderBy: { createdAt: 'desc' },
    take: 600,
  }).catch(() => []);
  const roles = pool.filter((o) => w.titleRe.test(o.title) || o.skills.some((s) => w.titleRe.test(s)));
  const stream = roles.slice(0, 30);
  const weekCount = roles.length;
  const dayCount = roles.filter((o) => o.createdAt.getTime() > Date.now() - 86400000).length;

  return (
    <>
{/* NAV — watcher brand only */}
<nav className="nav">
  <div className="nav-inner">
    <a href="/" className="logo">
      <span className="logo-mark" style={{ background: 'var(--accent)', color: '#000' }}>{w.roleShort[0]}</span>
      <span>{w.name}</span>
    </a>
    <ul className="nav-links">
      <li><a href="#how">How it works</a></li>
      <li><a href="#pricing">Pricing</a></li>
      <li><a href="#faq">FAQ</a></li>
    </ul>
    <div className="nav-cta">
      <a href="/join" className="btn btn-primary btn-sm">Get started
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </div>
</nav>

{/* HERO */}
<header className="hero">
  <div className="hero-bg-glow"></div>
  <div className="grid-bg"></div>
  <div className="container hero-inner">
    <div>
      <span className="hero-eyebrow">
        <span className="live-dot"></span>
        {weekCount.toLocaleString()} fresh {w.roleShort} roles this week · {dayCount} today
      </span>
      <h1>
        We watch LinkedIn for<br/>
        <span className="accent">{w.roleShort} hiring posts.</span>
      </h1>
      <p className="hero-sub">{w.heroTagline} <strong>You review it and hit Send.</strong></p>
      <div className="hero-cta">
        <a href="/join" className="btn btn-primary btn-lg">
          Get started
          <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div className="hero-meta">
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          We never touch your LinkedIn account
        </span>
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Cancel anytime
        </span>
      </div>
    </div>

    {/* LIVE STREAM — real data */}
    <div className="product-frame">
      <div className="product-chrome">
        <span className="chrome-dot"></span><span className="chrome-dot"></span><span className="chrome-dot"></span>
        <span className="chrome-url">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          {w.hosts[0]} · live catches
        </span>
      </div>
      <div className="product-header">
        <span className="product-title">Latest {w.roleShort} catches</span>
        <span className="product-title-live">
          <span className="live-dot" style={{background:'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'pulse 1.8s infinite'}}></span>
          LIVE
        </span>
      </div>
      <div className="feed">
        <div className="feed-inner">
          {stream.slice(0, 8).map((o) => (
            <a key={o.id} href={`/roles/${o.slug}`} className="feed-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="feed-logo" style={{background: 'var(--accent)', color: '#000'}}>{(o.posterCompany || o.clientName || o.title)[0]?.toUpperCase()}</div>
              <div>
                <div className="feed-title">{o.title.slice(0, 60)}</div>
                <div className="feed-meta">caught {timeAgo(o.createdAt)}{o.location ? ` · ${o.location.slice(0, 28)}` : ''}</div>
              </div>
              <span className="feed-status sending">view →</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  </div>
</header>

{/* STREAM FULL LIST */}
<section className="section" id="stream">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Caught this week</span>
      <h2>{weekCount} {w.roleShort} roles, straight from hiring posts.</h2>
      <p>Every one below was found in a LinkedIn hiring post or a company careers page — most days before it reaches the job boards.</p>
    </div>
    <div className="reveal" style={{maxWidth: '760px', margin: '0 auto', border: '1px solid var(--line-2)', borderRadius: '16px', overflow: 'hidden'}}>
      {stream.map((o, i) => (
        <a key={o.id} href={`/roles/${o.slug}`} style={{display: 'flex', gap: '14px', alignItems: 'center', padding: '14px 20px', borderBottom: i < stream.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit'}}>
          <span style={{flexShrink: 0, fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)', width: '64px'}}>{timeAgo(o.createdAt)}</span>
          <span style={{flex: 1, fontSize: '14px', color: 'var(--ink)'}}>{o.title.slice(0, 80)}</span>
          <span style={{flexShrink: 0, fontFamily: "'Geist Mono', monospace", fontSize: '11.5px', color: 'var(--accent)'}}>view →</span>
        </a>
      ))}
    </div>
  </div>
</section>

{/* HOW IT WORKS */}
<section className="section" id="how" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— How it works</span>
      <h2>Set it up once. We watch around the clock.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px'}}>
      {[
        { n: '1', t: 'Tell us who you are', d: `Upload your résumé or paste your LinkedIn URL — that's the whole setup. We build your profile from it.` },
        { n: '2', t: `We read every new ${w.roleShort} hiring post`, d: `Around the clock, ${w.name} scans LinkedIn "we're hiring…" posts and careers pages — roles that never make it to the boards, or get there days late.` },
        { n: '3', t: 'The application is drafted for you', d: `A personalized cover letter referencing the post and your real background, with your CV attached. You edit anything, then hit Send.` },
        { n: '4', t: 'New catches come to you', d: `Fresh matches land in your feed and your inbox — you'll never refresh a job board again.` },
      ].map((s, i) => (
        <div key={i} style={{display: 'flex', gap: '18px', border: '1px solid var(--line-2)', borderRadius: '14px', padding: '20px 22px'}}>
          <div style={{flexShrink: 0, width: '30px', height: '30px', borderRadius: '999px', background: 'rgba(199,249,74,0.12)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: '13px'}}>{s.n}</div>
          <div>
            <div style={{fontWeight: 600, fontSize: '15px', marginBottom: '6px'}}>{s.t}</div>
            <div style={{fontSize: '13.5px', lineHeight: 1.65, color: 'var(--ink-3)'}}>{s.d}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

{/* PRICING */}
<section className="section" id="pricing">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Pricing</span>
      <h2>One plan. No surprises.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '440px', margin: '0 auto', border: '1px solid rgba(199,249,74,0.3)', borderRadius: '18px', padding: '30px 28px', textAlign: 'center'}}>
      <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: '8px'}}>{w.name}</div>
      <div style={{fontSize: '44px', fontWeight: 650}}>$5<span style={{fontSize: '15px', color: 'var(--ink-4)', fontWeight: 400}}>/month</span></div>
      <ul style={{listStyle: 'none', padding: 0, margin: '20px 0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'var(--ink-2)', textAlign: 'left'}}>
        <li>✓ Every fresh {w.roleShort} hiring post, caught for you</li>
        <li>✓ Applications drafted — you review &amp; send, up to 20/day</li>
        <li>✓ Your CV attached to every send</li>
        <li>✓ Replies tracked; answer from one inbox</li>
        <li>✓ Cancel anytime · 7-day refund if it&apos;s not a fit</li>
      </ul>
      <a href="/join" className="btn btn-primary btn-lg" style={{width: '100%'}}>Get started</a>
    </div>
  </div>
</section>

{/* FAQ */}
<section className="section" id="faq" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Common questions</span>
      <h2>Fair questions, straight answers.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
      {[
        { q: 'Do you need my LinkedIn login?', a: `Never. We don't ask for your LinkedIn credentials, cookies, or any account access. We read public hiring posts on our side; your LinkedIn stays completely untouched.` },
        { q: `Does ${w.name} ever send anything without me?`, a: 'No. Nothing is ever emailed on your behalf without your click — every application is reviewed and sent by you.' },
        { q: 'Where do the roles come from?', a: `LinkedIn "we're hiring" posts and company careers pages, scanned around the clock. A mix of direct hirers and recruiters — each card shows who posted it.` },
        { q: 'Will recruiters know it’s AI-written?', a: 'Letters reference specifics from the post and your real background. They read like a short, thoughtful note — and you can edit every word before sending.' },
        { q: 'Can I cancel? Refund?', a: 'Cancel anytime in two clicks. Not a fit? Email us within 7 days of purchase for a full refund.' },
      ].map((f, i) => (
        <details key={i} style={{border: '1px solid var(--line-2)', borderRadius: '12px'}}>
          <summary style={{padding: '16px 20px', cursor: 'pointer', fontSize: '14.5px', fontWeight: 500, listStyle: 'none'}}>{f.q}</summary>
          <div style={{padding: '0 20px 16px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--ink-3)'}}>{f.a}</div>
        </details>
      ))}
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta">
  <div className="final-cta-glow"></div>
  <div className="container final-cta-inner reveal">
    <h2 style={{marginTop: '16px'}}>The next {w.roleShort} role is<br/><span className="accent">already being posted.</span></h2>
    <p>Set up your watcher — it takes a minute.</p>
    <div className="hero-cta">
      <a href="/join" className="btn btn-primary btn-lg">Get started
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </div>
</section>

{/* FOOTER — watcher + umbrella */}
<footer className="footer">
  <div className="container">
    <div className="footer-bottom" style={{borderTop: 'none', paddingTop: 0, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px'}}>
      <span>© 2026 {w.name} · an IntentPond product</span>
      <span><a href="/privacy" style={{color: 'var(--ink-4)'}}>Privacy</a> · <a href="/terms" style={{color: 'var(--ink-4)'}}>Terms</a> · <a href="mailto:support@freelanly.com" style={{color: 'var(--ink-4)'}}>Support</a></span>
    </div>
  </div>
</footer>
    </>
  );
}
