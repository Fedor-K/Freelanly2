import { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import '../marketing-styles.css';
import './pricing-design.css';

export const metadata: Metadata = {
  title: 'Pricing — Freelanly · browse free · PRO $5/mo',
  description: 'Browse fresh matched projects free. PRO ($5/mo) unlocks applying: up to 20 applications a day with AI-written letters, a morning ready-queue, and your CV attached to every send.',
  alternates: { canonical: `${siteConfig.url}/pricing` },
};

const Chk = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;

export default function PricingPage() {
  return (
    <div className="pg-pricing">
{/* NAV */}
<nav className="nav">
  <div className="nav-inner">
    <a href="/" className="logo"><span className="logo-mark">F</span><span>Freelanly</span></a>
    <ul className="nav-links">
      <li><a href="/how-it-works">How it works</a></li>
      <li><a href="/features">Features</a></li>
      <li><a href="/pricing">Pricing</a></li>
      <li><a href="/about">About</a></li>
    </ul>
    <div className="nav-cta">
      <a href="/auth/signin" className="btn btn-primary btn-sm">Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </div>
</nav>

{/* HEADER */}
<header className="page-head">
  <div className="page-head-bg"></div>
  <div className="container">
    <span className="eyebrow">— Pricing</span>
    <h1>Browsing is <span className="accent">free</span>.<br/>Applying is $5/month.</h1>
    <p className="lede">Sign up, get matched, and see fresh projects for your profile — no credit card. PRO ($5/mo) unlocks applying: up to 20 applications a day with AI-written letters and your CV attached, sent from your own inbox — for less than a coffee.</p>
  </div>
</header>

{/* PLANS */}
<section className="section-sm">
  <div className="container">
    <div className="price-grid reveal" style={{maxWidth: '860px', margin: '0 auto'}}>

      {/* FREE */}
      <div className="price-col">
        <div className="plan-name">Free</div>
        <p className="plan-tag">See who&apos;s hiring for your profile.</p>
        <div className="plan-price">
          <span className="currency">$</span>
          <span className="amount">0</span>
        </div>
        <div className="plan-monthly-eq">no credit card</div>
        <div className="plan-cta">
          <a href="/auth/signin" className="btn btn-ghost">Start free</a>
        </div>
        <div className="plan-section-label">What&apos;s included</div>
        <ul className="plan-features">
          <li><Chk /> <span>Fresh matched vacancies &amp; projects in your feed daily</span></li>
          <li><Chk /> <span>Why-you-match reasons on every card</span></li>
          <li><Chk /> <span>R&eacute;sum&eacute; parsing + profile built from your CV and LinkedIn</span></li>
          <li><Chk /> <span>Unified reply inbox + pipeline tracking</span></li>
        </ul>
      </div>

      {/* PRO */}
      <div className="price-col featured">
        <div className="featured-badge">Most popular</div>
        <div className="plan-name">Pro</div>
        <p className="plan-tag">Wake up to applications already written.</p>
        <div className="plan-price">
          <span className="currency">$</span>
          <span className="amount">5</span>
        </div>
        <div className="plan-monthly-eq">per month · cancel anytime</div>
        <div className="plan-cta">
          <a href="/auth/signin?callbackUrl=%2Fdashboard%2Fbilling" className="btn btn-primary" style={{width: '100%'}}>Get Pro
            <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
        </div>
        <div className="plan-section-label">Everything in Free, plus</div>
        <ul className="plan-features">
          <li><Chk /> <span><strong>20 applications a day</strong> — enough to cover your whole search; the cap keeps sends out of spam folders</span></li>
          <li><Chk /> <span><strong>AI cover letter for every application</strong> — with a second <strong>reviewer pass</strong> and a &quot;covers N of M requirements&quot; check</span></li>
          <li><Chk /> <span><strong>Morning ready-queue</strong> — applications pre-written for your top matches; review &amp; send in one click</span></li>
          <li><Chk /> <span><strong>Your CV on every application</strong> — your r&eacute;sum&eacute; attached automatically to each send</span></li>
          <li><Chk /> <span>Send from your own Gmail — one-click connect</span></li>
        </ul>
      </div>

    </div>

    <p className="reveal" style={{textAlign: 'center', marginTop: '28px', fontSize: '13px', color: 'var(--ink-4)'}}>
      Both plans send from your own inbox. Own-inbox sends have a daily safety cap — it protects your email account&apos;s reputation.
    </p>
  </div>
</section>

{/* FAQ */}
<section className="section">
  <div className="container" style={{maxWidth: '760px'}}>
    <div className="section-head reveal">
      <span className="eyebrow">— Questions</span>
      <h2>Fair questions, straight answers.</h2>
    </div>
    <div className="faq-list reveal">
      <div className="faq-item">
        <div className="faq-q">What&apos;s actually free?</div>
        <div className="faq-a">Everything up to the Send button: signing up, r&eacute;sum&eacute; parsing, daily matched projects with why-you-match reasons, and the reply inbox. You see exactly who&apos;s hiring for your profile before paying a cent. Applying — the AI letter, your CV attached, the send itself — is PRO.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">What exactly does PRO add?</div>
        <div className="faq-a">Applying, end to end. <strong>Up to 20 applications a day</strong> — the $5 covers your whole search, not per-send fees. <strong>AI-written letters</strong> with a reviewer pass for every one. A <strong>morning ready-queue</strong>: applications pre-written for your top matches, so you review and hit Send instead of hunting and drafting. And <strong>your CV on every send</strong> — attached automatically.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">Does Freelanly send anything without me?</div>
        <div className="faq-a">No. Nothing is ever emailed on your behalf without your click — every application is sent by you, after you&apos;ve seen it, from your own inbox.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">Will recruiters know it&apos;s AI-written?</div>
        <div className="faq-a">Letters reference specifics from the job post and your real background, go through a second reviewer pass, and send from your personal inbox. They read like a thoughtful note, not a blast — and you can edit every word before sending.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">Can I cancel PRO?</div>
        <div className="faq-a">Anytime, in two clicks, from your billing page. No calls, no forms. You keep Free forever.</div>
      </div>
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta" style={{position: 'relative', padding: '120px 0', overflow:'hidden', borderTop: '1px solid var(--line)'}}>
  <div style={{position:'absolute', width:'900px', height:'600px', background: 'radial-gradient(ellipse, rgba(199,249,74,0.16), transparent 60%)', filter: 'blur(40px)', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents:'none'}}></div>
  <div className="container" style={{position:'relative', textAlign:'center'}}>
    <span className="eyebrow eyebrow-accent">— Start today</span>
    <h2 style={{fontSize: 'clamp(40px, 5.5vw, 68px)', letterSpacing: '-0.035em', marginTop: '16px', marginBottom: '22px'}}>Stop drafting. Start <span style={{color:'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>sending.</span></h2>
    <p style={{fontSize: '18px', color: 'var(--ink-3)', maxWidth: '540px', margin: '0 auto 32px'}}>Sign up, upload your r&eacute;sum&eacute;, connect your Gmail. Your first drafts will be ready to review within the hour.</p>
    <div style={{display:'flex', gap: '12px', justifyContent:'center', flexWrap:'wrap'}}>
      <a href="/auth/signin" className="btn btn-primary btn-lg">Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
      <a href="/features" className="btn btn-ghost btn-lg">See features</a>
    </div>
  </div>
</section>

{/* FOOTER */}
<footer className="footer">
  <div className="container">
    <div className="footer-grid">
      <div className="footer-col footer-brand">
        <a href="/" className="logo"><span className="logo-mark">F</span><span>Freelanly</span></a>
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
          <li><a href="/about#faq">FAQ</a></li>
          <li><a href="/blog">Blog</a></li>
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
      <div>© 2026 Freelanly · Made for freelancers who&apos;d rather be working.</div>
    </div>
  </div>
</footer>

{/* Reveal */}
<script dangerouslySetInnerHTML={{ __html: `document.addEventListener('DOMContentLoaded',function(){if(typeof IntersectionObserver==='undefined')return;document.querySelectorAll('.reveal').forEach(function(el){new IntersectionObserver(function(e){e.forEach(function(entry){if(entry.isIntersecting)entry.target.classList.add('in')})},{threshold:0.1}).observe(el)})})` }} />
    </div>
  );
}
