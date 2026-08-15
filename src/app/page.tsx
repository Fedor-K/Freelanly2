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
 * GroupsWatcher-skeleton homepage (owner: «скопировать его тексты и подход 1-в-1, только под наши
 * профессии и LinkedIn», 2026-07-23). Section order, rhetorical moves and FAQ aggression mirror
 * groupswatcher.com; adapted honestly: no client logos, no testimonials (we have none), no fake
 * 60-second guarantees — our real speed is "hours before the boards", so that's what we say.
 */
export default async function LandingPage() {
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
      <a href="/auth/signin" className="btn btn-primary btn-sm">Get started
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
      <h1>
        We watch LinkedIn hiring posts<br/>
        <span className="accent">so you don&apos;t have to.</span>
      </h1>
      <p className="hero-sub">
        Never miss a fresh remote role again. The moment a hiring post for your stack appears on LinkedIn, it lands in your feed — <strong>with the application already drafted</strong>. Hours before it reaches the job boards.
      </p>
      <div className="hero-cta">
        <a href="/auth/signin" className="btn btn-primary btn-lg">
          Get started — first 2 applications free
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
          No credit card
        </span>
      </div>
    </div>

    {/* Live match cards — illustrative product UI; fictional roles, no real brands. */}
    <div className="product-frame">
      <div className="product-chrome">
        <span className="chrome-dot"></span><span className="chrome-dot"></span><span className="chrome-dot"></span>
        <span className="chrome-url">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          app.freelanly.com/discovery
        </span>
      </div>
      <div className="product-header">
        <span className="product-title">{totalOpps.toLocaleString()} fresh roles · last 24h</span>
        <span className="product-title-live">
          <span className="live-dot" style={{background:'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'pulse 1.8s infinite'}}></span>
          LIVE
        </span>
      </div>
      <div className="feed">
        <div className="feed-inner">
          {[...Array(2)].flatMap((_, setIdx) => [
            { logo: 'N', color: '#FF6B6B', title: 'New match · Senior React Developer', meta: '“Looking for a senior React dev for our fintech dashboard — remote, EU hours” · 12s ago', status: '✍ drafted', cls: 'sending' },
            { logo: 'D', color: '#6EE7FF', title: 'New match · Data Engineer', meta: '“Need a data engineer, Snowflake + dbt, long-term contract” · 4m ago', status: '✍ drafted', cls: 'sending' },
            { logo: 'Q', color: '#FFB951', title: 'New match · QA Automation Engineer', meta: '“Hiring a QA automation engineer, Playwright, remote” · 9m ago', status: '✓ sent by you', cls: 'applied' },
            { logo: 'C', color: '#A78BFA', title: 'New match · DevOps Engineer', meta: '“We need a DevOps/SRE — AWS, K8s, Terraform” · 14m ago', status: '✦ reply!', cls: 'reply' },
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

{/* USE CASES — by profession */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Who it&apos;s for</span>
      <h2>Built for your stack.</h2>
    </div>
    <div className="reveal" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px'}}>
      {[
        { role: 'Frontend & full-stack', post: '“We’re hiring a senior React/TypeScript dev for a customer-facing product. Remote, long-term.”', tag: 'React · Node · TypeScript' },
        { role: 'Data & ML', post: '“Looking for a data engineer to own our pipelines — Snowflake, dbt, Python. Contract to start.”', tag: 'SQL · Python · ML' },
        { role: 'DevOps & cloud', post: '“Need a DevOps engineer for AWS + Kubernetes infra. Fully remote, EU or LatAm hours welcome.”', tag: 'AWS · K8s · Terraform' },
        { role: 'QA & automation', post: '“Hiring a QA automation engineer — Playwright/Cypress, API testing. Direct application.”', tag: 'Automation · SDET' },
      ].map((c, i) => (
        <div key={i} style={{border: '1px solid var(--line-2)', borderRadius: '16px', padding: '22px'}}>
          <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: '10px'}}>{c.role}</div>
          <div style={{fontSize: '13.5px', lineHeight: 1.6, color: 'var(--ink-2)', marginBottom: '14px'}}>
            <span style={{color: 'var(--ink-4)', fontSize: '11px', display: 'block', marginBottom: '6px'}}>posted on LinkedIn · minutes ago</span>
            {c.post}
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px'}}>
            <span style={{color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace"}}>{c.tag}</span>
            <span style={{color: 'var(--accent)', fontFamily: "'Geist Mono', monospace", fontSize: '11.5px'}}>matched → drafted</span>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

{/* HOW IT WORKS — 5 steps */}
<section className="section" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— How it works</span>
      <h2>Set it up once. We watch around the clock.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px'}}>
      {[
        { n: '1', t: 'Upload your résumé — or just your LinkedIn URL', d: 'That’s the whole setup. We build your profile from it: stack, seniority, languages. You can refine anything later from your dashboard.' },
        { n: '2', t: 'Our crawlers read every new hiring post', d: 'Around the clock, we scan LinkedIn “we’re hiring…” posts and company career pages across engineering, data, DevOps and QA — roles that never make it to job boards, or get there days late.' },
        { n: '3', t: 'AI checks every post against your actual profile', d: 'Stack, seniority, language, location. Only roles you could genuinely be sent to reach your feed — the rest you never see.' },
        { n: '4', t: 'The application is drafted for you', d: 'A personalized cover letter referencing the post and your real background, checked against the job’s requirements, with your CV attached. You edit anything, then hit Send.' },
        { n: '5', t: 'It sends from YOUR Gmail — we never touch your accounts', d: 'No LinkedIn automation, no auto-DMs, no bulk-mail domain. Applications go out from your own inbox, with your click, at human pace. Replies land back where you can answer them.' },
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

{/* AI FILTER */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— The filter</span>
      <h2>An AI that knows a real opening from noise.</h2>
      <p>LinkedIn holds incredibly valuable hiring posts. They&apos;re also buried under “open to work” updates, engagement bait and staffing spam. We taught our AI to tell the difference — it surfaces posts that genuinely fit you, and stays quiet about everything that doesn&apos;t.</p>
    </div>

    <div className="reveal" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', maxWidth: '860px', margin: '0 auto 32px'}}>
      {[
        { t: 'Reads every post like a recruiter would', d: 'The full post, not keywords — what the company actually needs, and whether that’s you.' },
        { t: 'Keywords alone are not enough', d: 'A post can say “React” and still be useless to you. Intent + fit detection skips the noise.' },
        { t: 'Silence is a feature', d: 'If nothing worth your time was posted, your feed stays quiet. Every match you see is one you can act on.' },
      ].map((b, i) => (
        <div key={i} style={{border: '1px solid var(--line-2)', borderRadius: '14px', padding: '18px 20px'}}>
          <div style={{fontWeight: 600, fontSize: '14px', marginBottom: '6px'}}>{b.t}</div>
          <div style={{fontSize: '13px', lineHeight: 1.6, color: 'var(--ink-3)'}}>{b.d}</div>
        </div>
      ))}
    </div>

    <div className="reveal" style={{maxWidth: '760px', margin: '0 auto', border: '1px solid var(--line-2)', borderRadius: '16px', overflow: 'hidden'}}>
      <div style={{padding: '14px 20px', borderBottom: '1px solid var(--line)', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--ink-4)'}}>Fit check</div>
      {[
        { post: '“Hiring a Senior React Developer — remote, EU timezone, long-term”', verdict: 'Strong match — drafted', ok: true },
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
      <div style={{padding: '13px 20px', borderTop: '1px solid var(--line)', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--ink-2)'}}>4 new posts read. <span style={{color: 'var(--accent)'}}>1 worth your attention.</span></div>
    </div>
  </div>
</section>

{/* COMPARISON */}
<section className="section" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Why not just…</span>
      <h2>Why candidates choose Freelanly.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '820px', margin: '0 auto', border: '1px solid var(--line-2)', borderRadius: '16px', overflow: 'hidden', fontSize: '13.5px'}}>
      <div style={{display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', borderBottom: '1px solid var(--line)', fontFamily: "'Geist Mono', monospace", fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-4)'}}>
        <div style={{padding: '14px 18px'}}>Capability</div>
        <div style={{padding: '14px 18px'}}>Job boards &amp; auto-apply tools</div>
        <div style={{padding: '14px 18px', color: 'var(--accent)'}}>Freelanly</div>
      </div>
      {[
        ['Sources LinkedIn hiring posts', 'No — Jobs-tab listings only', 'Yes'],
        ['Catches roles before the boards', 'You’re applicant #300', 'Hours after the post, not days'],
        ['Application written for you', 'Blank form, or a generic blast', 'Personalized letter, checked vs requirements'],
        ['Sends from your own inbox', 'Their domain — lands in spam', 'Your Gmail, your name, your click'],
        ['Your accounts at risk', 'Auto-apply bots use YOUR logins', 'We never touch your LinkedIn or email credentials'],
      ].map((r, i) => (
        <div key={i} style={{display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', borderBottom: i < 4 ? '1px solid var(--line)' : 'none'}}>
          <div style={{padding: '14px 18px', fontWeight: 500}}>{r[0]}</div>
          <div style={{padding: '14px 18px', color: 'var(--ink-4)'}}>{r[1]}</div>
          <div style={{padding: '14px 18px', color: 'var(--ink)'}}>{r[2]}</div>
        </div>
      ))}
    </div>
  </div>
</section>

{/* PRICING + safety callout */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Pricing</span>
      <h2>Try it free. Pay as you go.</h2>
    </div>

    <div className="reveal" style={{maxWidth: '640px', margin: '0 auto 26px', border: '1px solid rgba(199,249,74,0.25)', background: 'rgba(199,249,74,0.05)', borderRadius: '14px', padding: '18px 22px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--ink-2)'}}>
      <strong style={{color: 'var(--ink)'}}>Your LinkedIn account is never at risk.</strong> Most auto-apply tools run automation through <em>your</em> logins — which is how accounts get restricted. Freelanly reads public hiring posts on our side, and applications send from your own Gmail, one at a time, with your click. Nothing for a platform to flag.
    </div>

    <div className="reveal" style={{maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px'}}>
      {[
        { k: 'First application', v: 'Free — no card, see the whole flow work' },
        { k: 'After that', v: '$0.50 per application from a balance (top up from $3 · never expires)' },
        { k: 'Applying a lot?', v: 'PRO $5/mo — AI letters, CV on every send · cancel anytime' },
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

{/* FAQ */}
<section className="section" style={{background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.015))'}}>
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Common questions</span>
      <h2>Fair questions, straight answers.</h2>
    </div>
    <div className="reveal" style={{maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
      {[
        { q: 'Any alternatives to Freelanly?', a: 'Your options: (1) Refresh LinkedIn and five job boards all day — ~90 minutes daily, and you still miss the posts that never reach the boards. (2) Auto-apply blasters — they spray generic applications from their domains (or worse, through your accounts) and recruiters bin them on sight. (3) Do it all manually for the roles you find — which is exactly the hour of busywork per application we automate. Nobody else reads LinkedIn hiring posts and drafts the application for you.' },
        { q: 'Do you need my LinkedIn login?', a: 'Never. We don’t ask for your LinkedIn credentials, cookies, or any account access. We read public hiring posts on our side; your LinkedIn stays completely untouched — no auto-DMs, no auto-connects, nothing done with your account.' },
        { q: 'Does Freelanly ever send anything without me?', a: 'No. Nothing is ever emailed on your behalf without your click. Drafts wait until you review and send them — or delete them. Your name is on the email; you stay in control of it.' },
        { q: 'Will recruiters know it’s AI-written?', a: 'Letters reference specifics from the post and your actual experience, pass a second AI review against the job’s requirements, and send from your personal Gmail. They read like a short, thoughtful note — and you can edit every word first.' },
        { q: 'How fast do roles reach my feed?', a: 'Within hours of the hiring post going live — typically days before the same role is aggregated by job boards, where you’d be applicant #300. Fresh posts land around the clock.' },
        { q: 'What does it actually cost?', a: 'Your first 2 applications are free, no card. After that: $0.50 per application from a prepaid balance (top up from $3, never expires), or PRO at $5/month.' },
        { q: 'Can I cancel? Is there a refund?', a: 'Cancel anytime, two clicks from your billing page — no contracts. Not a fit? Email us within 7 days of a purchase for a full refund.' },
      ].map((f, i) => (
        <details key={i} style={{border: '1px solid var(--line-2)', borderRadius: '12px', padding: '0'}}>
          <summary style={{padding: '16px 20px', cursor: 'pointer', fontSize: '14.5px', fontWeight: 500, listStyle: 'none'}}>{f.q}</summary>
          <div style={{padding: '0 20px 16px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--ink-3)'}}>{f.a}</div>
        </details>
      ))}
      <div style={{textAlign: 'center', marginTop: '10px', fontSize: '13px', color: 'var(--ink-4)'}}>
        Have another question? Email <a href="mailto:support@freelanly.com" style={{color: 'var(--accent)'}}>support@freelanly.com</a> or use the chat in the corner — it&apos;s a small team, you&apos;ll get an answer from someone who builds the product.
      </div>
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta" id="signup">
  <div className="final-cta-glow"></div>
  <div className="container final-cta-inner reveal">
    <span className="eyebrow eyebrow-accent">— Start today</span>
    <h2 style={{marginTop: '16px'}}>Start catching roles<br/>from <span className="accent">LinkedIn hiring posts.</span></h2>
    <p>Upload your résumé and see today&apos;s matches — your first application is on us, no credit card.</p>
    <div className="hero-cta">
      <a href="/auth/signin" className="btn btn-primary btn-lg">
        Get started
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
        <p>For engineers, data, DevOps and QA candidates who need to catch remote roles in LinkedIn hiring posts before everyone else does.</p>
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
