import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
import './marketing-styles.css';
import './landing-design.css';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Freelanly — Personal AI Assistant for Vacancies & Projects Application',
  description: 'Freelanly finds fresh vacancies and freelance projects matched to your profile and drafts a tailored cover letter for each — you review and send from your own inbox.',
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

export default async function LandingPage() {
  const [totalUsers, totalCompanies, totalOpps] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600000) } } }),
  ]);

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
      <li><a href="/features">Features</a></li>
      <li><a href="/pricing">Pricing</a></li>
      <li><a href="/about">About</a></li>
    </ul>
    <div className="nav-cta">
      <a href="/recruiter/login" className="btn btn-ghost btn-sm">For recruiters</a>
      <a href="/auth/signin" className="btn btn-ghost btn-sm">Log in</a>
      <a href="/auth/signin" className="btn btn-primary btn-sm">Start free
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
        {totalOpps.toLocaleString()} fresh gigs · updated every 3 hours
      </span>
      <h1>
        Your personal <span className="accent">AI assistant</span><br/>
        for job &amp; project applications.
      </h1>
      <p className="hero-sub">
        Be first in the inbox — win the project. Freelanly catches new vacancies and freelance gigs the moment they&apos;re posted on LinkedIn and <strong>{totalCompanies.toLocaleString()}+</strong> company sites, then drafts a personalized application for every strong match. <strong>You review it and hit Send</strong> — straight from your own Gmail.
      </p>
      <div className="hero-cta">
        <a href="/auth/signin" className="btn btn-primary btn-lg">
          Start free — no card needed
          <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="/how-it-works" className="btn btn-ghost btn-lg">See how it works</a>
      </div>
      <div className="hero-meta">
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          No credit card
        </span>
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Free to browse your matches
        </span>
        <span className="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Cancel anytime
        </span>
      </div>
    </div>

    {/* Product widget */}
    <div className="product-frame">
      <div className="product-chrome">
        <span className="chrome-dot"></span><span className="chrome-dot"></span><span className="chrome-dot"></span>
        <span className="chrome-url">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          app.freelanly.com/inbox
        </span>
      </div>
      <div className="product-header">
        <span className="product-title">Live activity</span>
        <span className="product-title-live">
          <span className="live-dot" style={{background:'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'pulse 1.8s infinite'}}></span>
          STREAMING
        </span>
      </div>
      <div className="feed">
        <div className="feed-inner">
          {/* Illustrative sample of the product UI — fictional roles/companies, no real brands implied. */}
          {[...Array(2)].flatMap((_, setIdx) => [
            { logo: 'S', color: '#FF6B6B', title: 'Senior React Developer · SaaS startup', meta: 'via LinkedIn · 2 min ago', status: '● drafted', cls: 'sending' },
            { logo: 'D', color: '#A8E024', title: 'Full-Stack Engineer · dev agency', meta: 'careers page · 6 min ago', status: '✓ sent by you', cls: 'applied' },
            { logo: 'B', color: '#6EE7FF', title: 'Brand Designer · e-commerce brand', meta: 'via LinkedIn · contract · 8 min ago', status: '✦ reply!', cls: 'reply' },
            { logo: 'P', color: '#FFB951', title: 'Product Designer · fintech startup', meta: 'via LinkedIn · 11 min ago', status: '✓ sent by you', cls: 'applied' },
            { logo: 'M', color: '#F87171', title: 'iOS Engineer · mobile studio', meta: 'careers page · 14 min ago', status: '✓ sent by you', cls: 'applied' },
            { logo: 'C', color: '#A78BFA', title: 'DevOps Engineer · cloud consultancy', meta: 'via LinkedIn · 18 min ago', status: '● drafted', cls: 'sending' },
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

      <div className="stat-float">
        <div>
          <div className="stat-float-num tabular" style={{color: 'var(--accent)'}}>47</div>
          <div className="stat-float-label">Today</div>
        </div>
        <div style={{width:'1px', height:'36px', background: 'var(--line)'}}></div>
        <div>
          <div className="stat-float-num tabular" style={{color: 'var(--ink)'}}>4</div>
          <div className="stat-float-label">Replies</div>
          <div className="stat-float-sub">▲ this week</div>
        </div>
      </div>
    </div>
  </div>
</header>

{/* MARQUEE */}
<section className="marquee">
  <div className="marquee-label">Fresh openings across</div>
  <div className="marquee-track">
    {[...Array(2)].flatMap((_, i) => ['Engineering','·','Design','·','Marketing','·','Data','·','DevOps','·','Product','·','Writing','·','Translation','·','Mobile','·','QA','·','Sales','·'].map((name, j) => (
      <span key={`${i}-${j}`} className="marquee-item">{name}</span>
    )))}
  </div>
</section>

{/* STATS */}
<section className="section-sm">
  <div className="container reveal">
    <div className="stats-strip">
      <div className="stat">
        <div className="stat-num">{(totalUsers / 1000).toFixed(1)}K+</div>
        <div className="stat-label">Freelancers signed up</div>
      </div>
      <div className="stat">
        <div className="stat-num">3h</div>
        <div className="stat-label">Feed refresh cycle</div>
      </div>
      <div className="stat">
        <div className="stat-num">{totalCompanies.toLocaleString()}+</div>
        <div className="stat-label">Companies tracked</div>
      </div>
      <div className="stat">
        <div className="stat-num"><span className="accent">3×</span></div>
        <div className="stat-label">More replies from your own inbox</div>
      </div>
      <div className="stat">
        <div className="stat-num">90+</div>
        <div className="stat-label">Countries</div>
      </div>
    </div>
  </div>
</section>

{/* HOW IT WORKS PREVIEW */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— How it works</span>
      <h2>Three steps. Zero busywork.</h2>
      <p>Set your filters once. We hunt and write — you review and hit Send.</p>
    </div>

    <div className="how-preview reveal">
      <div className="how-step">
        <div className="how-step-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </div>
        <div className="how-num">01 — Discover</div>
        <h3>We find the gigs others miss</h3>
        <p>Freelanly scrapes LinkedIn hiring posts and {totalCompanies.toLocaleString()}+ company career pages every few hours — so you see openings before they hit Indeed or Upwork.</p>
      </div>
      <div className="how-step">
        <div className="how-step-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
        </div>
        <div className="how-num">02 — Personalize</div>
        <h3>AI writes a cover letter that doesn&apos;t sound like AI</h3>
        <p>Trained on what wins replies. Pulls from your portfolio, references the job specifics, opens with a human hook — not &quot;I hope this email finds you well.&quot;</p>
      </div>
      <div className="how-step">
        <div className="how-step-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </div>
        <div className="how-num">03 — Review &amp; send</div>
        <h3>From your inbox. Tracked end-to-end.</h3>
        <p>Applications go out from your own email. We track opens and replies, so you know which threads are warm and worth a personal nudge. You see everything in one dashboard.</p>
      </div>
    </div>

    <div style={{marginTop:'32px', textAlign:'center'}} className="reveal">
      <a href="/how-it-works" className="btn btn-soft">
        Read the full breakdown
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </div>
</section>

{/* FEATURES */}
<section className="section" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="split-head reveal" style={{marginBottom: '56px'}}>
      <div className="section-head" style={{marginBottom: 0}}>
        <span className="eyebrow">— What&apos;s inside</span>
        <h2>Built to win replies, not send spam.</h2>
      </div>
      <a href="/features" className="link-arrow">
        All features
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>

    <div className="feature-grid">
      <div className="feat feat-big reveal">
        <span className="feat-eyebrow">AI Cover Letter</span>
        <h3>Sounds like you. Hits the specifics.</h3>
        <p>Reads the full job post, pulls from your real background, and writes an opener they actually want to read — then a second AI reviews it against the job&apos;s requirements.</p>
        <div className="feat-visual">
          <div className="cover-card">
            <span style={{color: 'var(--ink-4)', fontSize: '11px'}}>{'// generated 2s ago'}</span><br/>
            Hey <span className="accent">Sarah</span>,<br/><br/>
            Saw you&apos;re hiring a React dev for <span className="accent">Linear&apos;s mobile team</span>. I shipped a similar offline-first sync engine last quarter for <span className="accent">Plain</span> — happy to walk through how I&apos;d approach yours.<br/><br/>
            Portfolio: alex.dev/work<br/>
            <span className="cover-typing">— Alex</span>
          </div>
        </div>
      </div>

      <div className="feat feat-mid reveal">
        <span className="feat-eyebrow">Smart matching</span>
        <h3>Set your criteria. Skip the noise.</h3>
        <p>Tell Freelanly the stack, role, and red flags. It filters thousands of gigs down to the ones worth your time — each with a cover letter already drafted, ready for you to review and send.</p>
        <div style={{marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
            <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>+ React</span>
            <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>+ TypeScript</span>
            <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>+ Remote</span>
            <span className="tag" style={{color: 'var(--bad)', borderColor: 'rgba(248,113,113,0.3)'}}>− &quot;Web3&quot;</span>
            <span className="tag" style={{color: 'var(--bad)', borderColor: 'rgba(248,113,113,0.3)'}}>− &quot;rockstar&quot;</span>
          </div>
          <div style={{border: '1px solid var(--line-2)', borderRadius: '10px', padding: '14px', fontFamily: "'Geist Mono', monospace", fontSize: '12.5px', color: 'var(--ink-2)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span>Send window</span>
              <span style={{color: 'var(--accent)'}}>9–17 Mon–Fri</span>
            </div>
            <div style={{height:'1px', background: 'var(--line)', margin: '10px 0'}}></div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span>Daily cap</span>
              <span style={{color: 'var(--accent)'}}>20 applications</span>
            </div>
          </div>
        </div>
      </div>

      <div className="feat feat-small reveal">
        <span className="feat-eyebrow">Tracking</span>
        <h3>Know what worked.</h3>
        <p>Opens, replies, interview rate — per template, per company, per week.</p>
        <div className="tracking-vis">
          <div className="track-row"><div><div style={{fontSize:'12.5px', color: 'var(--ink-2)', marginBottom: '6px'}}>React roles</div><div className="track-bar"><div className="track-bar-fill" style={{width: '72%'}}></div></div></div><div className="track-num">12% reply</div></div>
          <div className="track-row"><div><div style={{fontSize:'12.5px', color: 'var(--ink-2)', marginBottom: '6px'}}>Design roles</div><div className="track-bar"><div className="track-bar-fill" style={{width: '48%'}}></div></div></div><div className="track-num">8% reply</div></div>
          <div className="track-row"><div><div style={{fontSize:'12.5px', color: 'var(--ink-2)', marginBottom: '6px'}}>Backend roles</div><div className="track-bar"><div className="track-bar-fill" style={{width: '34%'}}></div></div></div><div className="track-num">5% reply</div></div>
        </div>
      </div>

      <div className="feat feat-small reveal">
        <span className="feat-eyebrow">Open Tracking</span>
        <h3>Know when they look.</h3>
        <p>See when a recruiter opens your application — so you know which ones are warm and worth a nudge from your own inbox.</p>
        <div className="followup-vis">
          <div className="followup-step done"><div className="followup-time">Day 0 — 09:14</div><div className="followup-text">Application sent from your Gmail</div></div>
          <div className="followup-step done"><div className="followup-time">Day 1 — 11:32</div><div className="followup-text">Recruiter opened your application</div></div>
          <div className="followup-step"><div className="followup-time">Your move</div><div className="followup-text" style={{color: 'var(--ink-4)'}}>Reply lands straight in your inbox</div></div>
        </div>
      </div>

      <div className="feat feat-small reveal">
        <span className="feat-eyebrow">Unified Inbox</span>
        <h3>One place to reply.</h3>
        <p>Every reply lands back in Freelanly. Snooze, label, hand off to your real email when it gets serious.</p>
        <div style={{marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'10px', padding: '10px 12px', border:'1px solid var(--line-2)', borderRadius: '8px', background: 'rgba(199,249,74,0.06)'}}>
            <div style={{width:'6px',height:'6px',background:'var(--accent)',borderRadius:'999px'}}></div>
            <div style={{flex:1, fontSize: '13px'}}>Sarah · Linear</div>
            <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)'}}>2m</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'10px', padding: '10px 12px', border:'1px solid var(--line)', borderRadius: '8px'}}>
            <div style={{width:'6px',height:'6px',background:'var(--ink-4)',borderRadius:'999px'}}></div>
            <div style={{flex:1, fontSize: '13px', color: 'var(--ink-3)'}}>Marcus · Stripe</div>
            <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)'}}>1h</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'10px', padding: '10px 12px', border:'1px solid var(--line)', borderRadius: '8px'}}>
            <div style={{width:'6px',height:'6px',background:'var(--ink-4)',borderRadius:'999px'}}></div>
            <div style={{flex:1, fontSize: '13px', color: 'var(--ink-3)'}}>Priya · Vercel</div>
            <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)'}}>3h</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>


{/* FINAL CTA */}
<section className="final-cta" id="signup">
  <div className="final-cta-glow"></div>
  <div className="container final-cta-inner reveal">
    <span className="eyebrow eyebrow-accent">— Start today</span>
    <h2 style={{marginTop: '16px'}}>Your next client is <span className="accent">already posting.</span><br/>Get there first.</h2>
    <p>Sign up free and see fresh projects matched to your profile — no credit card. PRO ($5/mo) unlocks applying: AI-written letters, your CV attached, sent from your own inbox.</p>
    <div className="hero-cta">
      <a href="/auth/signin" className="btn btn-primary btn-lg">
        Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
      <a href="/pricing" className="btn btn-ghost btn-lg">See pricing</a>
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
        <p>Personal AI assistant for vacancies and projects application. Be first in the inbox. Win the project.</p>
      </div>
      <div className="footer-col">
        <h5>Product</h5>
        <ul>
          <li><a href="/how-it-works">How it works</a></li>
          <li><a href="/features">Features</a></li>
          <li><a href="/pricing">Pricing</a></li>
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
          <li><a href="/recruiter/login">Recruiter login</a></li>
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
      <span>© 2026 Freelanly · Made for freelancers who&apos;d rather be working.</span>
    </div>
  </div>
</footer>

{/* Reveal animation script */}
<script dangerouslySetInnerHTML={{ __html: `document.addEventListener('DOMContentLoaded',function(){if(typeof IntersectionObserver==='undefined')return;document.querySelectorAll('.reveal').forEach(function(el){new IntersectionObserver(function(e){e.forEach(function(entry){if(entry.isIntersecting)entry.target.classList.add('in')})},{threshold:0.1}).observe(el)})})` }} />
    </>
  );
}
