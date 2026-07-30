import { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import '../marketing-styles.css';
import './pricing-design.css';

export const metadata: Metadata = {
  title: 'Pricing — first free · $0.50 per application · PRO $5/mo',
  description: 'Try Freelanly free — your first application is on us. PRO ($5/mo) keeps them coming: AI-written letters, a morning ready-queue, your CV attached to every send.',
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

{/* HEADER */}
<header className="page-head">
  <div className="page-head-bg"></div>
  <div className="container">
    <span className="eyebrow">— Pricing</span>
    <h1>Your first application is <span className="accent">free</span>.<br/>Then pay per application — or go PRO.</h1>
    <p className="lede">Sign up, get matched, and send your first AI-drafted application on us — no credit card. After that: top up a balance and send at $0.50 per application, or go PRO ($5/mo) — for less than a coffee.</p>
  </div>
</header>

{/* PLANS */}
<section className="section-sm">
  <div className="container">
    <div className="price-grid reveal" style={{maxWidth: '1080px', margin: '0 auto'}}>

      {/* FREE */}
      <div className="price-col">
        <div className="plan-name">Free</div>
        <p className="plan-tag">Try the whole flow — first application on us.</p>
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
          <li><Chk /> <span><strong>First application free</strong> — see the full flow end to end</span></li>
          <li><Chk /> <span>Fresh matched remote tech roles in your feed daily</span></li>
          <li><Chk /> <span>Why-you-match reasons on every card</span></li>
          <li><Chk /> <span>R&eacute;sum&eacute; parsing + profile built from your CV and LinkedIn</span></li>
          <li><Chk /> <span>AI cover letter with a second reviewer pass + &quot;covers N of M requirements&quot; check — on every application, every plan</span></li>
          <li><Chk /> <span>Your CV attached to every send</span></li>
          <li><Chk /> <span>Unified reply inbox + pipeline tracking</span></li>
          <li><Chk /> <span>Send from your own Gmail — one-click connect (any plan)</span></li>
        </ul>
      </div>

      {/* PAY AS YOU GO — the balance model, the offer every walled user actually sees */}
      <div className="price-col">
        <div className="plan-name">Pay as you go</div>
        <p className="plan-tag">No subscription. Top up, apply, done.</p>
        <div className="plan-price">
          <span className="currency">$</span>
          <span className="amount">0.50</span>
        </div>
        <div className="plan-monthly-eq">per application · top up from $3</div>
        <div className="plan-cta">
          <a href="/auth/signin" className="btn btn-ghost">Start free</a>
        </div>
        <div className="plan-section-label">Everything in Free, plus</div>
        <ul className="plan-features">
          <li><Chk /> <span><strong>$0.50 per application</strong> — pay only when you actually send</span></li>
          <li><Chk /> <span><strong>Balance never expires</strong> — top up $3, $5 or $10, use it whenever</span></li>
          <li><Chk /> <span>AI cover letter + your CV attached on every send</span></li>
          <li><Chk /> <span>One-tap top-ups after the first — card saved securely by Stripe</span></li>
        </ul>
      </div>

      {/* PRO */}
      <div className="price-col featured">
        <div className="featured-badge">Most popular</div>
        <div className="plan-name">Pro</div>
        <p className="plan-tag">Wake up to your matches already queued.</p>
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
          <li><Chk /> <span><strong>Flat $5 — no per-application charges.</strong> Cheaper than the balance past ~10 sends a month</span></li>
          <li><Chk /> <span><strong>Morning ready-queue</strong> — your top matches queued overnight; open one, the letter is drafted in seconds, review &amp; send</span></li>
        </ul>
      </div>

    </div>

    <p className="reveal" style={{textAlign: 'center', marginTop: '28px', fontSize: '13px', color: 'var(--ink-4)'}}>
      On any plan you can connect your own Gmail or SMTP and send from your address — own-inbox sends get a higher daily safety cap that protects your email reputation.
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
        <div className="faq-a">Everything up to and including your first sent application: matching, the AI letter, your CV attached, sending, and the reply inbox. You see the entire flow work end to end before paying a cent. After that, pay as you go — top up a balance (from $3) and send at <strong>$0.50 per application</strong>, no subscription, balance never expires — or go PRO.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">What exactly does PRO add?</div>
        <div className="faq-a">Two things. <strong>A flat price:</strong> $5 — no per-send charges, cheaper than the $0.50 balance once you send more than 10 a month. And <strong>the morning ready-queue:</strong> your top matches queued overnight with one-click drafting, so you review and hit Send instead of hunting. Everything else — AI letters with the reviewer pass, your CV attached, the inbox — is the same on every plan.</div>
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
    </div>
  </div>
</section>

{/* FOOTER */}
<footer className="footer">
  <div className="container">
    <div className="footer-grid">
      <div className="footer-col footer-brand">
        <a href="/" className="logo"><span className="logo-mark">F</span><span>Freelanly</span></a>
        <p>Personal AI assistant for remote tech-job applications. Be first in the inbox. Win the role.</p>
      </div>
      <div className="footer-col">
        <h5>Product</h5>
        <ul>
          <li><a href="/how-it-works">How it works</a></li>
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
      <div>© 2026 Freelanly · Made for engineers who&apos;d rather be building.</div>
    </div>
  </div>
</footer>

{/* Reveal */}
<script dangerouslySetInnerHTML={{ __html: `document.addEventListener('DOMContentLoaded',function(){if(typeof IntersectionObserver==='undefined')return;document.querySelectorAll('.reveal').forEach(function(el){new IntersectionObserver(function(e){e.forEach(function(entry){if(entry.isIntersecting)entry.target.classList.add('in')})},{threshold:0.1}).observe(el)})})` }} />
    </div>
  );
}
