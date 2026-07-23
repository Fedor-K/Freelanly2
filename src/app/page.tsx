import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
import './marketing-styles.css';
import './landing-design.css';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Freelanly — Remote Tech Jobs Before They Hit the Boards',
  description: 'Freelanly reads LinkedIn hiring posts and catches remote engineering, data, DevOps and QA roles before they hit the job boards — with your application already drafted. You review and send.',
  alternates: {
    canonical: siteConfig.url,
    languages: {
      en: siteConfig.url,
      es: `${siteConfig.url}/es`,
      pt: `${siteConfig.url}/pt`,
      'x-default': siteConfig.url,
    },
  },
};

/**
 * Simplified one-pager (owner decision 2026-07-23, GroupsWatcher-style skeleton):
 * one promise → one live proof → the filter table → the letter → the price → FAQ.
 * Cut: marquee, stats strip, 3-step preview, feature grid — /how-it-works & /features
 * carry the long-form story; the homepage carries the decision.
 */
export default async function LandingPage() {
  // Prerenders at build (revalidate=300); fall back to a recent real value on a transient DB blip
  // instead of failing the whole deploy (P1001 killed builds twice on 07-16).
  const totalOpps = await prisma.opportunity
    .count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600000) } } })
    .catch(() => 800);

  return (
    <>
{/* NAV */}
<nav className="nav">
  <div className="nav-inner">
    <a href="/" className="logo">
      <span className="logo-mark">F</span>
      <span>Freelanly</span>
    </a>
    <ul className="nav-links">
      <li><a href="/how-it-works">How it works</a></li>
      <li><a href="/pricing">Pricing</a></li>
      <li><a href="/about">About</a></li>
    </ul>
    <div className="nav-cta">
      <a href="/auth/signin" className="btn btn-ghost btn-sm">Log in</a>
      <a href="/auth/signin" className="btn btn-primary btn-sm">Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </div>
</nav>

{/* 1 — HERO: the promise + live proof */}
<header className="hero">
  <div className="hero-bg-glow"></div>
  <div className="grid-bg"></div>
  <div className="container hero-inner">
    <div>
      <span className="hero-eyebrow">
        <span className="live-dot"></span>
        {totalOpps.toLocaleString()} fresh remote tech roles in the last 24h
      </span>
      <h1>
        We watch LinkedIn hiring posts<br/>
        <span className="accent">so you don&apos;t have to.</span>
      </h1>
      <p className="hero-sub">
        Fresh remote engineering, data, DevOps and QA roles — caught in LinkedIn hiring posts before they hit the job boards, with the cover letter already written. <strong>You review it and hit Send</strong> from your own Gmail.
      </p>
      <div className="hero-cta">
        <a href="/auth/signin" className="btn btn-primary btn-lg">
          Start free — first application on us
          <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div className="hero-meta">
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          No credit card
        </span>
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Nothing sends without your click
        </span>
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Cancel anytime
        </span>
      </div>
    </div>

    {/* Live-feed widget — illustrative sample of the product UI; fictional roles, no real brands. */}
    <div className="product-frame">
      <div className="product-chrome">
        <span className="chrome-dot"></span><span className="chrome-dot"></span><span className="chrome-dot"></span>
        <span className="chrome-url">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          app.freelanly.com/discovery
        </span>
      </div>
      <div className="product-header">
        <span className="product-title">Live feed</span>
        <span className="product-title-live">
          <span className="live-dot" style={{background:'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'pulse 1.8s infinite'}}></span>
          STREAMING
        </span>
      </div>
      <div className="feed">
        <div className="feed-inner">
          {[...Array(2)].flatMap((_, setIdx) => [
            { logo: 'S', color: '#FF6B6B', title: 'Senior React Developer · SaaS startup', meta: 'via LinkedIn · 2 min ago', status: '● drafted', cls: 'sending' },
            { logo: 'D', color: '#6EE7FF', title: 'Data Engineer · analytics platform', meta: 'via LinkedIn · contract · 8 min ago', status: '✦ reply!', cls: 'reply' },
            { logo: 'Q', color: '#FFB951', title: 'QA Automation Engineer · fintech startup', meta: 'via LinkedIn · 11 min ago', status: '✓ sent by you', cls: 'applied' },
            { logo: 'C', color: '#A78BFA', title: 'DevOps Engineer · cloud consultancy', meta: 'via LinkedIn · 18 min ago', status: '● drafted', cls: 'sending' },
            { logo: 'F', color: '#A8E024', title: 'Full-Stack Engineer · dev agency', meta: 'via LinkedIn · 24 min ago', status: '✓ sent by you', cls: 'applied' },
            { logo: 'M', color: '#F87171', title: 'iOS Engineer · mobile studio', meta: 'via LinkedIn · 31 min ago', status: '✓ sent by you', cls: 'applied' },
          ].map((item, i) => (
            <div key={`${setIdx}-${i}`} className="feed-item">
              <div className="feed-logo" style={{background: item.color}}>{item.logo}</div>
              <div>
                <div className="feed-title">{item.title}</div>
                <div className="feed-meta">{item.meta}</div>
              </div>
              <span className={`feed-status ${item.cls}`}>{item.status}</span>
            </div>
          )))}
        </div>
      </div>
    </div>
  </div>
</header>

{/* 2 — THE FILTER: what the matcher actually does */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— The filter</span>
      <h2>Most &quot;hiring&quot; posts aren&apos;t worth your time.<br/>We read them all anyway.</h2>
      <p>Every post is checked against your actual profile — stack, seniority, language, location. You only see the ones you could genuinely be sent to.</p>
    </div>

    <div className="reveal" style={{maxWidth: '760px', margin: '0 auto', border: '1px solid var(--line-2)', borderRadius: '16px', overflow: 'hidden'}}>
      <div style={{padding: '14px 20px', borderBottom: '1px solid var(--line)', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--ink-4)', display: 'flex', justifyContent: 'space-between'}}>
        <span>4 posts read this morning</span>
        <span style={{color: 'var(--accent)'}}>1 worth your attention</span>
      </div>
      {[
        { post: '“Hiring a Senior React Developer — remote, EU timezone, long-term”', verdict: 'Strong match — letter drafted', ok: true },
        { post: '“Open to work! Senior developer seeking new opportunities…”', verdict: 'Not a vacancy — skipped', ok: false },
        { post: '“Need a PHP / Laravel developer for our agency”', verdict: 'Not your stack — skipped', ok: false },
        { post: '“URGENT!! W2 only. Share visa status + rate + current employer”', verdict: 'Staffing spam — skipped', ok: false },
      ].map((r, i) => (
        <div key={i} style={{display: 'flex', gap: '16px', alignItems: 'center', padding: '16px 20px', borderBottom: i < 3 ? '1px solid var(--line)' : 'none'}}>
          <span style={{flexShrink: 0, width: '22px', height: '22px', borderRadius: '999px', display: 'grid', placeItems: 'center', fontSize: '12px', background: r.ok ? 'rgba(199,249,74,0.15)' : 'rgba(255,255,255,0.05)', color: r.ok ? 'var(--accent)' : 'var(--ink-4)'}}>{r.ok ? '✓' : '✗'}</span>
          <span style={{flex: 1, fontSize: '13.5px', color: r.ok ? 'var(--ink)' : 'var(--ink-3)'}}>{r.post}</span>
          <span style={{flexShrink: 0, fontFamily: "'Geist Mono', monospace", fontSize: '11.5px', color: r.ok ? 'var(--accent)' : 'var(--ink-4)'}}>{r.verdict}</span>
        </div>
      ))}
    </div>
  </div>
</section>

{/* 3 — THE LETTER */}
<section className="section" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— The letter</span>
      <h2>Drafted in seconds. Sounds like you.</h2>
      <p>The AI reads the full post and writes from your real background — then a second AI reviews it against the job&apos;s requirements. You edit anything, then hit Send from your own Gmail.</p>
    </div>

    <div className="reveal" style={{maxWidth: '640px', margin: '0 auto'}}>
      <div className="cover-card" style={{fontSize: '14px', lineHeight: 1.7}}>
        <span style={{color: 'var(--ink-4)', fontSize: '11px'}}>{'// drafted 1.8s ago · you edit, you send'}</span><br/>
        Hey <span className="accent">Sarah</span>,<br/><br/>
        Saw you&apos;re hiring a React dev for <span className="accent">your mobile team</span>. I shipped a similar offline-first sync engine last quarter for <span className="accent">a messaging startup</span> — happy to walk through how I&apos;d approach yours.<br/><br/>
        Portfolio: alex.dev/work<br/>
        <span className="cover-typing">— Alex</span>
      </div>
      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px', justifyContent: 'center', fontFamily: "'Geist Mono', monospace", fontSize: '12px'}}>
        <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>✓ Covers 7/9 requirements</span>
        <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>✓ Your CV attached</span>
        <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>✓ Sent from your Gmail</span>
      </div>
    </div>
  </div>
</section>

{/* 4 — THE PRICE */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— The price</span>
      <h2>Try it free. Pay as you go.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px'}}>
      {[
        { k: 'First application', v: 'Free — no card, see the whole flow work' },
        { k: 'After that', v: '$0.50 per application from a balance (top up from $3 · never expires)' },
        { k: 'Applying a lot?', v: 'PRO $5/mo — up to 20 applications a day · cancel anytime' },
      ].map((r, i) => (
        <div key={i} style={{display: 'flex', gap: '16px', alignItems: 'baseline', padding: '16px 20px', border: '1px solid var(--line-2)', borderRadius: '12px'}}>
          <span style={{flexShrink: 0, width: '150px', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em'}}>{r.k}</span>
          <span style={{fontSize: '14.5px', color: 'var(--ink-2)'}}>{r.v}</span>
        </div>
      ))}
      <div style={{textAlign: 'center', marginTop: '8px'}}>
        <a href="/pricing" className="link-arrow" style={{fontSize: '13px'}}>Full pricing details
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
    </div>
  </div>
</section>

{/* 5 — FAQ */}
<section className="section" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Fair questions</span>
      <h2>Straight answers.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
      {[
        { q: 'Is this just AI spam?', a: 'No — the design makes spam impossible. Every letter is drafted for one specific opening, references your real background, and is sent by you, from your own inbox, after you’ve read it. There’s a daily cap precisely so nobody can blast.' },
        { q: 'Does it ever send anything without me?', a: 'Never. Drafts wait until you review and click Send — or delete them. Your name is on the email; you stay in control of it.' },
        { q: 'Will recruiters know it’s AI-written?', a: 'Letters reference specifics from the post and your actual experience, pass a second AI review, and send from your personal Gmail. They read like a short, thoughtful note — and you can edit every word first.' },
        { q: 'What does it actually cost?', a: 'First application is free, no card. After that: $0.50 per application from a prepaid balance (top up from $3, never expires), or PRO at $5/month for up to 20 applications a day.' },
        { q: 'How do I cancel?', a: 'Two clicks from your billing page. Export your data to CSV anytime; deleting your account removes everything.' },
        { q: 'I’m applying from Latin America — does this work for me?', a: 'That’s exactly who most of our users are: developers in Latin America (and worldwide) applying to US and European companies that hire internationally. Applications send from your own Gmail, so they look like any other candidate’s — because they are.' },
      ].map((f, i) => (
        <details key={i} style={{border: '1px solid var(--line-2)', borderRadius: '12px', padding: '0'}}>
          <summary style={{padding: '16px 20px', cursor: 'pointer', fontSize: '14.5px', fontWeight: 500, listStyle: 'none'}}>{f.q}</summary>
          <div style={{padding: '0 20px 16px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--ink-3)'}}>{f.a}</div>
        </details>
      ))}
    </div>
  </div>
</section>

{/* 6 — FINAL CTA */}
<section className="final-cta" id="signup">
  <div className="final-cta-glow"></div>
  <div className="container final-cta-inner reveal">
    <span className="eyebrow eyebrow-accent">— Start today</span>
    <h2 style={{marginTop: '16px'}}>The role you want is <span className="accent">already posted.</span><br/>Be first in the inbox.</h2>
    <p>Sign up free — your first application is on us, no credit card.</p>
    <div className="hero-cta">
      <a href="/auth/signin" className="btn btn-primary btn-lg">
        Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
      <a href="/how-it-works" className="btn btn-ghost btn-lg">See how it works</a>
    </div>
  </div>
</section>

{/* FOOTER */}
<footer className="footer">
  <div className="container">
    <div className="footer-grid">
      <div className="footer-col footer-brand">
        <a href="/" className="logo">
          <span className="logo-mark">F</span>
          <span>Freelanly</span>
        </a>
        <p>Personal AI assistant for remote tech-job applications. Be first in the inbox. Win the role.</p>
      </div>
      <div className="footer-col">
        <h5>Product</h5>
        <ul>
          <li><a href="/how-it-works">How it works</a></li>
          <li><a href="/pricing">Pricing</a></li>
          <li><a href="/remote-jobs">Remote jobs</a></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Company</h5>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="/blog">Blog</a></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Resources</h5>
        <ul>
          <li><a href="/auth/signin">Start free</a></li>
          <li><a href="/apply-guides">Apply guides</a></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Legal</h5>
        <ul>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/terms">Terms</a></li>
        </ul>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© 2026 Freelanly · Made for engineers who&apos;d rather be building.</span>
    </div>
  </div>
</footer>

{/* Reveal animation script */}
<script dangerouslySetInnerHTML={{ __html: `document.addEventListener('DOMContentLoaded',function(){if(typeof IntersectionObserver==='undefined')return;document.querySelectorAll('.reveal').forEach(function(el){new IntersectionObserver(function(e){e.forEach(function(entry){if(entry.isIntersecting)entry.target.classList.add('in')})},{threshold:0.1}).observe(el)})})` }} />
    </>
  );
}
