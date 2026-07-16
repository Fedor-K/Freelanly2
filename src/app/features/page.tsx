import { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import '../marketing-styles.css';
import './features-design.css';

export const metadata: Metadata = {
  title: 'Features — Freelanly · discovery, AI applications, tracking',
  description: 'Every feature in Freelanly: real-time gig discovery, AI-written applications with a reviewer pass, tailored CVs, pipeline tracking, inbox routing, and more.',
  alternates: { canonical: `${siteConfig.url}/features` },
};

export default function FeaturesPage() {
  return (
    <div className="pg-features">
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
    <span className="eyebrow eyebrow-accent">— Features</span>
    <h1 style={{marginTop: '18px'}}>Every tool you need to <span className="accent">land</span> more work.</h1>
    <p className="lede">Twenty-four product features grouped into four pillars: <strong style={{color: 'var(--ink)'}}>discovery</strong>, <strong style={{color: 'var(--ink)'}}>outreach</strong>, <strong style={{color: 'var(--ink)'}}>tracking</strong>, and <strong style={{color: 'var(--ink)'}}>workflow</strong>. Built specifically for freelancers, not job-board users.</p>
  </div>
</header>

{/* Sticky pillar nav */}
<nav className="pillars">
  <a href="#discovery"><span className="num">01</span>Discovery</a>
  <a href="#outreach"><span className="num">02</span>Outreach</a>
  <a href="#tracking"><span className="num">03</span>Tracking</a>
  <a href="#workflow"><span className="num">04</span>Workflow</a>
</nav>

{/* PILLAR 1: DISCOVERY */}
<section className="pillar" id="discovery">
  <div className="container">
    <div className="pillar-head reveal">
      <div>
        <div className="pillar-num">— Pillar 01 — Discovery</div>
        <div className="pillar-name">
          <h2>Find gigs <span className="accent">before</span> they go viral.</h2>
        </div>
      </div>
      <p className="pillar-desc">Job-board listings are the leftovers. Real opportunities surface as LinkedIn posts, career-page drops, and Slack-community shouts hours before they hit the boards.</p>
    </div>
    <div className="feat-cards">
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </div>
        <h3>LinkedIn post crawler</h3>
        <p>Scrapes &quot;we&apos;re hiring&quot; posts from hiring managers — not the public Jobs tab. Pulls a feed of fresh openings every 3 hours.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
        </div>
        <h3>Career-page monitoring</h3>
        <p>We watch LinkedIn hiring posts and company career pages — new roles land in your feed within hours of being posted.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <h3>Requirements coverage check</h3>
        <p>Every application is checked against the job&apos;s actual requirements before you send — you see &quot;Covers 7 of 9 requirements&quot; right on the review screen.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        </div>
        <h3>Direct contact from the post</h3>
        <p>When the hiring post lists a real application email, we surface it — your application lands in the inbox the poster actually reads.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </div>
        <h3>Custom feeds</h3>
        <p>Save filters as named feeds: &quot;EU React contracts&quot;, &quot;Brand design over $5k&quot;, etc. Each one streams independently.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>
        </div>
        <h3>Quiet-hours scanning</h3>
        <p>The crawlers run round the clock so when you wake up, the EU and US morning posts are already in your queue.</p>
      </div>
    </div>
  </div>
</section>

{/* PILLAR 2: OUTREACH */}
<section className="pillar" id="outreach">
  <div className="container">
    <div className="pillar-head reveal">
      <div>
        <div className="pillar-num">— Pillar 02 — Outreach</div>
        <div className="pillar-name">
          <h2>Outreach that <span className="accent">actually</span> gets replies.</h2>
        </div>
      </div>
      <p className="pillar-desc">Sending more applications doesn&apos;t win you more work — sending <em>better</em> ones does. Our AI is tuned on what hiring managers actually reply to: short, specific, human.</p>
    </div>
    <div className="feat-cards">
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>
        </div>
        <h3>AI cover letter writer</h3>
        <p>Reads the job post, references specifics from your portfolio, sounds like you. ~90 words. No &quot;I hope this email finds you well.&quot;</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
        </div>
        <h3>One-click apply</h3>
        <p>Every match comes with the cover letter already written. Review it, tweak if you want, and send — no copy-paste, no blank page.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
        </div>
        <h3>Reviewer pass on every letter</h3>
        <p>Two AI passes, not one: a drafter writes your application, then a second reviewer critiques it against the job&apos;s requirements and your real background — before you ever see it.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"/></svg>
        </div>
        <h3>Open tracking</h3>
        <p>See the moment a recruiter opens your application — so you know which threads are warm and worth a personal nudge from your inbox.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
        </div>
        <h3>Deal-breaker filters</h3>
        <p>Never apply to &quot;Web3 ninja rockstar&quot; posts again. Block keywords, company types, contract terms, rate floors.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </div>
        <h3>Send from your inbox</h3>
        <p>One-click Gmail connect (OAuth), or any inbox via SMTP app password. Sends as <em>you</em>, not a third-party domain. Replies route back into Freelanly.</p>
      </div>
    </div>
  </div>
</section>

{/* PILLAR 3: TRACKING */}
<section className="pillar" id="tracking">
  <div className="container">
    <div className="pillar-head reveal">
      <div>
        <div className="pillar-num">— Pillar 03 — Tracking</div>
        <div className="pillar-name">
          <h2>Know exactly <span className="accent">what&apos;s working.</span></h2>
        </div>
      </div>
      <p className="pillar-desc">Every application is tracked from send → open → reply → interview → offer. See which templates, openers, and verticals earn the highest reply rate.</p>
    </div>
    <div className="feat-cards">
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></svg>
        </div>
        <h3>Reply &amp; open analytics</h3>
        <p>Open rate, reply rate, interview rate. By week, by template, by company size, by industry.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>
        <h3>Pipeline / Kanban</h3>
        <p>Drag-and-drop board: <em>Sent → Opened → Replied → Call booked → Offer</em>. Conversion rate at each stage, visible at a glance.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        </div>
        <h3>Tailored CV per application</h3>
        <p>PRO rebuilds your r&eacute;sum&eacute; for each role — summary angled to the job, most relevant skills first. Same facts, sharper story, attached automatically.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
        </div>
        <h3>Reply categorization</h3>
        <p>Auto-tags every reply: <span className="tag" style={{display: 'inline-flex', verticalAlign: 'middle'}}>interested</span> <span className="tag" style={{display: 'inline-flex', verticalAlign: 'middle'}}>rate-mismatch</span> <span className="tag" style={{display: 'inline-flex', verticalAlign: 'middle'}}>already-filled</span>. So you can move fast on the hot ones.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <h3>Weekly digest</h3>
        <p>Every Monday at 9am: applications sent, replies in, top-performing template, next week&apos;s queue. Read in 30 seconds.</p>
      </div>
    </div>
  </div>
</section>

{/* PILLAR 4: WORKFLOW */}
<section className="pillar" id="workflow">
  <div className="container">
    <div className="pillar-head reveal">
      <div>
        <div className="pillar-num">— Pillar 04 — Workflow</div>
        <div className="pillar-name">
          <h2>Fits the rest of your <span className="accent">stack.</span></h2>
        </div>
      </div>
      <p className="pillar-desc">A freelancer&apos;s day already includes Notion, Calendly, Slack, an invoicing tool, and a CRM. Freelanly slots in — it doesn&apos;t replace your stack.</p>
    </div>
    <div className="feat-cards">
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </div>
        <h3>Booking link in every letter</h3>
        <p>Add your Calendly / Cal.com link once — we include it in your applications so interested recruiters can grab time with you directly.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
        </div>
        <h3>Portfolio integration</h3>
        <p>Plug in your portfolio URL once. We index your projects so the AI can pick the most relevant ones to mention per job.</p>
      </div>
      <div className="feat-card reveal">
        <div className="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <h3>Data export &amp; portability</h3>
        <p>CSV-export every application, reply, contact, template — anytime. Hard-delete your account in one click. Your data stays yours.</p>
      </div>
    </div>
  </div>
</section>

{/* Versus */}
<section className="section">
  <div className="container">
    <div className="section-head reveal" style={{textAlign:'center', margin: '0 auto 56px', alignItems: 'center'}}>
      <span className="eyebrow eyebrow-accent">— Why not just…</span>
      <h2>Manual outreach vs. Freelanly</h2>
    </div>
    <div className="compare-row reveal">
      <div className="compare-cell bad">
        <h3>Doing it yourself</h3>
        <h4>You, every morning, for 90 minutes.</h4>
        <ul>
          <li>Refresh job boards, miss the fresh posts</li>
          <li>Write each cover letter from scratch</li>
          <li>Send, then forget about it</li>
          <li>No tracking, no signal, no learning</li>
          <li>Burn out after 2 weeks of consistency</li>
        </ul>
      </div>
      <div className="compare-cell good">
        <h3>Freelanly</h3>
        <h4>Set it once. Check it once a day.</h4>
        <ul>
          <li>Fresh posts arrive within hours of posting</li>
          <li>AI drafts a personalized letter in 2 seconds</li>
          <li>Sent from your own inbox in one click</li>
          <li>Open &amp; reply tracking on every application</li>
          <li>Fresh matches keep coming, even on the weeks you don&apos;t look</li>
        </ul>
      </div>
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta" style={{position: 'relative', padding: '120px 0', overflow:'hidden', borderTop: '1px solid var(--line)'}}>
  <div style={{position:'absolute', width:'900px', height:'600px', background: 'radial-gradient(ellipse, rgba(199,249,74,0.16), transparent 60%)', filter: 'blur(40px)', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents:'none'}}></div>
  <div className="container" style={{position:'relative', textAlign:'center'}}>
    <span className="eyebrow eyebrow-accent">— Try the whole stack</span>
    <h2 style={{fontSize: 'clamp(40px, 5.5vw, 68px)', letterSpacing: '-0.035em', marginTop: '16px', marginBottom: '22px'}}>Sign up free — <span style={{color:'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>first application on us.</span></h2>
    <p style={{fontSize: '18px', color: 'var(--ink-3)', maxWidth: '540px', margin: '0 auto 32px'}}>No credit card. Cancel any time. Take your data with you if you go.</p>
    <div style={{display:'flex', gap: '12px', justifyContent:'center', flexWrap:'wrap'}}>
      <a href="/auth/signin" className="btn btn-primary btn-lg">Start free
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
