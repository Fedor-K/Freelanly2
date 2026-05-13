import { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import '../marketing-styles.css';
import './pricing-design.css';

export const metadata: Metadata = {
  title: 'Pricing — Freelanly · from $0/mo · cancel anytime',
  description: 'Three plans for solo freelancers, pros, and agencies. Free $0, Pro $29/mo, Agency $89/mo. 14-day money back. Annual saves 20%.',
  alternates: { canonical: `${siteConfig.url}/pricing` },
};

const Chk = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;
const X = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>;

export default function PricingPage() {
  return (
    <>
{/* NAV */}
<nav className="nav">
  <div className="nav-inner">
    <Link href="/" className="logo"><span className="logo-mark">F</span><span>Freelanly</span></Link>
    <ul className="nav-links">
      <li><Link href="/how-it-works">How it works</Link></li>
      <li><Link href="/features">Features</Link></li>
      <li><Link href="/pricing">Pricing</Link></li>
      <li><Link href="/about">About</Link></li>
    </ul>
    <div className="nav-cta">
      <Link href="/auth/login" className="btn btn-ghost btn-sm">Sign in</Link>
      <Link href="/auth/signin" className="btn btn-primary btn-sm">Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </Link>
    </div>
  </div>
</nav>

{/* HEADER */}
<header className="page-head" style={{textAlign:'center'}}>
  <div className="page-head-bg"></div>
  <div className="container" style={{textAlign:'center'}}>
    <span className="eyebrow">— Pricing</span>
    <h1>Pay less than <span className="accent">one billable hour</span>.<br/>Apply to a thousand gigs.</h1>
    <p className="lede" style={{textAlign:'center', margin:'0 auto'}}>Start free. Upgrade when your inbox starts filling up. Cancel any time — your data goes with you.</p>
  </div>
</header>

{/* PLANS */}
<section className="section-sm">
  <div className="container">
    <div className="price-grid reveal">

      {/* FREE */}
      <div className="price-col">
        <div className="plan-name">Free</div>
        <p className="plan-tag">For testing the waters. See what Freelanly catches before you commit.</p>
        <div className="plan-price">
          <span className="currency">$</span>
          <span className="amount">0</span>
        </div>
        <div className="plan-monthly-eq">forever, on us</div>
        <div className="plan-cta">
          <Link href="/auth/signin" className="btn btn-ghost">Start free</Link>
        </div>
        <div className="plan-section-label">What&apos;s included</div>
        <ul className="plan-features">
          <li><Chk /> <span><strong>10</strong> AI applications / month</span></li>
          <li><Chk /> <span>Browse all live gigs</span></li>
          <li><Chk /> <span>Basic AI cover letter</span></li>
          <li><Chk /> <span>Manual send</span></li>
          <li className="dim"><X /> <span>Auto-apply</span></li>
          <li className="dim"><X /> <span>Follow-ups</span></li>
        </ul>
      </div>

      {/* PRO (FEATURED) */}
      <div className="price-col featured">
        <span className="featured-badge">Most popular</span>
        <div className="plan-name" style={{color: 'var(--accent)'}}>Pro</div>
        <p className="plan-tag">For full-time freelancers. Auto-apply + AI cover letters + follow-ups, on autopilot.</p>
        <div className="plan-price">
          <span className="currency">$</span>
          <span className="amount">29</span>
          <span className="period">/ month</span>
        </div>
        <div className="plan-monthly-eq">billed monthly</div>
        <div className="plan-cta">
          <Link href="/auth/signin" className="btn btn-primary">Start 7-day free trial
            <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </Link>
        </div>
        <div className="plan-section-label">Everything in Free, plus</div>
        <ul className="plan-features">
          <li><Chk /> <span><strong>500</strong> AI applications / month</span></li>
          <li><Chk /> <span><strong>Auto-apply</strong> with smart filters</span></li>
          <li><Chk /> <span><strong>Auto follow-ups</strong> after 5 days</span></li>
          <li><Chk /> <span>Premium AI model (GPT-class)</span></li>
          <li><Chk /> <span>Tracking &amp; reply analytics</span></li>
          <li><Chk /> <span>Send from your own inbox</span></li>
          <li><Chk /> <span>Early access to new jobs (3hr edge)</span></li>
        </ul>
      </div>

      {/* AGENCY */}
      <div className="price-col">
        <div className="plan-name">Agency</div>
        <p className="plan-tag">For studios &amp; small teams running outreach for multiple freelancers.</p>
        <div className="plan-price">
          <span className="currency">$</span>
          <span className="amount">89</span>
          <span className="period">/ month</span>
        </div>
        <div className="plan-monthly-eq">up to 5 seats</div>
        <div className="plan-cta">
          <a href="mailto:hi@freelanly.com" className="btn btn-ghost">Talk to us</a>
        </div>
        <div className="plan-section-label">Everything in Pro, plus</div>
        <ul className="plan-features">
          <li><Chk /> <span><strong>Unlimited</strong> applications</span></li>
          <li><Chk /> <span><strong>5 seats</strong> ($15 / extra seat)</span></li>
          <li><Chk /> <span>Shared template library</span></li>
          <li><Chk /> <span>Team analytics &amp; pipeline view</span></li>
          <li><Chk /> <span>Priority support (4hr SLA)</span></li>
          <li><Chk /> <span>Custom AI training on your style</span></li>
        </ul>
      </div>
    </div>

    <div style={{textAlign:'center', marginTop: '28px', fontSize: '14px', color: 'var(--ink-4)'}} className="reveal">
      All plans include unlimited browsing · No credit card to start · Cancel any time
    </div>
  </div>
</section>

{/* ROI */}
<section className="section-sm">
  <div className="container">
    <div className="roi-card reveal">
      <div>
        <span className="eyebrow eyebrow-accent">— Math check</span>
        <h3 style={{marginTop: '14px'}}>One gig pays for a year.</h3>
        <p className="muted" style={{fontSize: '15px', maxWidth: '36ch'}}>A typical Pro user sends ~280 applications/month, gets ~22 replies, and books 2–4 new projects.</p>
      </div>
      <div className="divider-v"></div>
      <div className="roi-stat-grid">
        <div><div className="roi-stat-num">$348</div><div className="roi-stat-label">/ year on Pro</div></div>
        <div><div className="roi-stat-num">~$4,800</div><div className="roi-stat-label">Avg first project</div></div>
        <div><div className="roi-stat-num">14×</div><div className="roi-stat-label">Median ROI in month 1</div></div>
        <div><div className="roi-stat-num">5 days</div><div className="roi-stat-label">To first reply</div></div>
      </div>
    </div>
  </div>
</section>

{/* COMPARE */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Compare</span>
      <h2>Everything, side by side.</h2>
    </div>
    <div className="compare-wrap reveal">
      <table className="compare">
        <thead>
          <tr>
            <th style={{width: '40%'}}>Feature</th>
            <th>Free</th>
            <th className="col-featured">Pro</th>
            <th>Agency</th>
          </tr>
        </thead>
        <tbody>
          <tr className="group-row"><td colSpan={4}>Discovery</td></tr>
          <tr><td>Live job feed (13,842+ active)</td><td><span className="check">●</span></td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>
          <tr><td>LinkedIn hiring-post discovery</td><td><span className="check">●</span></td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>
          <tr><td>Career-page crawler (3,500+ companies)</td><td>Limited</td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>
          <tr><td>Early access window</td><td>—</td><td className="col-featured">3 hrs</td><td>3 hrs</td></tr>

          <tr className="group-row"><td colSpan={4}>Outreach</td></tr>
          <tr><td>AI cover letter / month</td><td>10</td><td className="col-featured">500</td><td>Unlimited</td></tr>
          <tr><td>Auto-apply with smart filters</td><td><span className="x">—</span></td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>
          <tr><td>Send from your own inbox</td><td><span className="x">—</span></td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>
          <tr><td>Auto follow-ups</td><td><span className="x">—</span></td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>
          <tr><td>AI model</td><td>Standard</td><td className="col-featured">Premium</td><td>Premium + Custom</td></tr>

          <tr className="group-row"><td colSpan={4}>Tracking</td></tr>
          <tr><td>Reply &amp; open tracking</td><td>Basic</td><td className="col-featured">Full</td><td>Full</td></tr>
          <tr><td>Per-template analytics</td><td><span className="x">—</span></td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>
          <tr><td>Pipeline / Kanban view</td><td><span className="x">—</span></td><td className="col-featured"><span className="check">●</span></td><td><span className="check">●</span></td></tr>

          <tr className="group-row"><td colSpan={4}>Team &amp; integration</td></tr>
          <tr><td>Seats</td><td>1</td><td className="col-featured">1</td><td>5 (+15/seat)</td></tr>
          <tr><td>Shared templates</td><td><span className="x">—</span></td><td className="col-featured"><span className="x">—</span></td><td><span className="check">●</span></td></tr>
          <tr><td>Support</td><td>Email</td><td className="col-featured">Email + chat</td><td>Priority (4hr)</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

{/* FAQ */}
<section className="section">
  <div className="container" style={{maxWidth: '880px'}}>
    <div className="section-head reveal" style={{marginBottom: '32px'}}>
      <span className="eyebrow">— Common questions</span>
      <h2>Things people ask before signing up.</h2>
    </div>
    <div className="faq-list reveal">
      <div className="faq-item">
        <div className="faq-q">Does this actually get me clients, or is it just spam?</div>
        <div className="faq-a">It&apos;s outreach, not spam. Every application is personalized to the specific job and sent from your real inbox. Our model is tuned for reply rate, not volume — the median Pro user sends ~280/month, not thousands. Spam doesn&apos;t get 8% reply rates.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">What happens to my data if I cancel?</div>
        <div className="faq-a">Export everything (sent applications, replies, contacts, templates) to CSV with one click. We hard-delete your data within 30 days unless you ask us to keep it.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">Will hiring managers know it&apos;s AI?</div>
        <div className="faq-a">No — and we test for this. Cover letters reference specifics from the job post, your portfolio, and (when public) the hiring manager&apos;s background. They read like a thoughtful 3-minute write-up, not a template.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">Can I edit applications before they go out?</div>
        <div className="faq-a">Always. You can run in <strong>review mode</strong> (every draft waits for your OK) or <strong>auto mode</strong> (we send for you, you can recall within 60 minutes). Most Pro users start in review for a week, then flip to auto.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">What if I&apos;m just job-hunting, not freelancing?</div>
        <div className="faq-a">Freelanly works for both. About 30% of our users are looking for full-time remote roles. Same engine, same filters — just check &quot;FT roles&quot; in your preferences.</div>
      </div>
      <div className="faq-item">
        <div className="faq-q">Is there a free trial on Pro?</div>
        <div className="faq-a">Yes — 7 days, full access, no card required up front. If you don&apos;t book at least one interview, we&apos;ll extend it.</div>
      </div>
    </div>
    <div style={{textAlign: 'center', marginTop: '48px'}} className="reveal">
      <Link href="/about#faq" className="btn btn-soft">See all FAQs
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </Link>
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta" style={{position: 'relative', padding: '120px 0', overflow:'hidden', borderTop: '1px solid var(--line)'}}>
  <div style={{position:'absolute', width:'900px', height:'600px', background: 'radial-gradient(ellipse, rgba(199,249,74,0.16), transparent 60%)', filter: 'blur(40px)', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents:'none'}}></div>
  <div className="container" style={{position:'relative', textAlign:'center'}}>
    <span className="eyebrow eyebrow-accent">— Start today</span>
    <h2 style={{fontSize: 'clamp(40px, 5.5vw, 68px)', letterSpacing: '-0.035em', marginTop: '16px', marginBottom: '22px'}}>Stop applying. Start <span style={{color:'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>replying.</span></h2>
    <p style={{fontSize: '18px', color: 'var(--ink-3)', maxWidth: '540px', margin: '0 auto 32px'}}>Sign up, plug in your inbox, set your filters. We&apos;ll have your first 10 applications out by tomorrow.</p>
    <div style={{display:'flex', gap: '12px', justifyContent:'center', flexWrap:'wrap'}}>
      <Link href="/auth/signin" className="btn btn-primary btn-lg">Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </Link>
      <Link href="/features" className="btn btn-ghost btn-lg">See features</Link>
    </div>
  </div>
</section>

{/* FOOTER */}
<footer className="footer">
  <div className="container">
    <div className="footer-grid">
      <div className="footer-col footer-brand">
        <Link href="/" className="logo"><span className="logo-mark">F</span><span>Freelanly</span></Link>
        <p>AI outreach engine for freelancers. Be first in the inbox. Win the project.</p>
      </div>
      <div className="footer-col">
        <h5>Product</h5>
        <ul>
          <li><Link href="/how-it-works">How it works</Link></li>
          <li><Link href="/features">Features</Link></li>
          <li><Link href="/pricing">Pricing</Link></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Company</h5>
        <ul>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/about#faq">FAQ</Link></li>
          <li><Link href="/blog">Blog</Link></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Resources</h5>
        <ul>
          <li><Link href="/freelance">Browse Jobs</Link></li>
          <li><Link href="/companies">Companies</Link></li>
        </ul>
      </div>
      <div className="footer-col">
        <h5>Legal</h5>
        <ul>
          <li><Link href="/privacy">Privacy</Link></li>
          <li><Link href="/terms">Terms</Link></li>
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
    </>
  );
}
