import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
import '../marketing-styles.css';
import './about-design.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'About Freelanly — the personal AI application assistant',
  description: 'Why we built Freelanly: freelancers lose a billable day every week to job-hunting busywork. Our story, our rules, and honest answers to fair questions.',
  alternates: { canonical: `${siteConfig.url}/about` },
};

const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>;

export default async function AboutPage() {
  const [totalUsers, totalCompanies] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
  ]);
  const usersK = `${(totalUsers / 1000).toFixed(1)}K+`;

  return (
    <div className="pg-about">
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
    <span className="eyebrow eyebrow-accent">— About</span>
    <h1 style={{marginTop: '18px'}}>Built for people who&apos;d rather work than <span className="accent">apply.</span></h1>
    <p className="lede">Freelanly is a personal AI assistant for vacancies and projects application. It finds fresh openings, drafts a tailored application for each — and you review and send every one yourself. Today {usersK} freelancers and remote candidates use it to spend less time on the application treadmill.</p>
  </div>
</header>

{/* Manifesto */}
<section className="section">
  <div className="container">
    <div className="manifesto reveal">
      <p>We started with one belief: <strong>the freelancer&apos;s biggest cost isn&apos;t taxes or tools — it&apos;s the time spent looking for the next gig.</strong> A typical full-time freelancer loses 8–12 hours a week to job-hunting. That&apos;s a full billable day. Every week.</p>
      <p>The job-board industry doesn&apos;t want to fix this. Their business model depends on you refreshing the same feed 30 times a day. Their feeds depend on listings that have already been seen by 500 people.</p>
      <div className="pull">
        We&apos;re building the opposite of a job board. A feed that catches openings <span style={{color: 'var(--accent)', fontStyle: 'italic'}}>before</span> they hit the boards and drafts the application for you — so all that&apos;s left is to review, hit Send, and get back to the work that pays.
      </div>
      <p>Freelanly is a tool, not a community. We don&apos;t sell ads to recruiters. We don&apos;t sell your data. Our only customer is you — the freelancer or the candidate — and our only metric is whether you book more work with less time spent applying.</p>
      <p>If we ever stop doing that — leave. Take your data with you. Export is one click.</p>
    </div>
  </div>
</section>

{/* Story */}
<section className="section-xs">
  <div className="container">
    <div className="story-banner reveal">
      <div className="quote">Freelanly didn&apos;t start this way. The first version was a remote-jobs board. Watching how people actually used it taught us the real problem wasn&apos;t <em>finding</em> openings — it was the hour of busywork behind every single application. In 2026 we rebuilt the product around that: <span className="accent">a personal AI assistant that does the busywork, while you stay the one who applies.</span></div>
      <div className="author">— the Freelanly team</div>
    </div>
  </div>
</section>

{/* Numbers */}
<section className="section-sm">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Today</span>
      <h2>Where Freelanly is <span style={{color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>right now.</span></h2>
    </div>
    <div className="timeline reveal">
      <div className="tl-step">
        <div className="tl-year">{usersK}</div>
        <h4>Signed-up freelancers &amp; candidates</h4>
        <p>From 90+ countries — most applying to remote roles and freelance projects at US and European companies.</p>
      </div>
      <div className="tl-step">
        <div className="tl-year">{totalCompanies.toLocaleString()}+</div>
        <h4>Companies tracked</h4>
        <p>LinkedIn hiring posts and company career pages, re-checked every few hours for fresh openings.</p>
      </div>
      <div className="tl-step">
        <div className="tl-year">2</div>
        <h4>AI passes on every letter</h4>
        <p>A drafter writes your application; a second reviewer critiques it against the job&apos;s requirements before you see it.</p>
      </div>
      <div className="tl-step">
        <div className="tl-year">100%</div>
        <h4>Of applications sent by you</h4>
        <p>Nothing goes out without your click. Every application is reviewed and sent by the human it represents.</p>
      </div>
    </div>
  </div>
</section>

{/* Values */}
<section className="section">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— What we believe</span>
      <h2>Three rules we won&apos;t break.</h2>
    </div>
    <div className="values-grid">
      <div className="value reveal">
        <div className="value-num">— 01</div>
        <h3>Your time is the product.</h3>
        <p>Every feature is judged by one question: does it give the freelancer an hour back? If not, we don&apos;t build it. Even if it would look great in a launch tweet.</p>
      </div>
      <div className="value reveal">
        <div className="value-num">— 02</div>
        <h3>You send. Always.</h3>
        <p>Freelanly is an assistant, not a bot. It drafts, checks, and queues — but no application ever leaves without your review and your click. Your name is on the email; you stay in control of it.</p>
      </div>
      <div className="value reveal">
        <div className="value-num">— 03</div>
        <h3>No dark patterns. Ever.</h3>
        <p>One-click cancel. One-click data export. No hidden upsells, no four-step downgrade flows. We compete on the product, not the friction.</p>
      </div>
    </div>
  </div>
</section>

{/* FAQ */}
<section className="section" id="faq">
  <div className="container" style={{maxWidth: '920px'}}>
    <div className="section-head reveal" style={{marginBottom: '32px'}}>
      <span className="eyebrow">— FAQ</span>
      <h2>Fair questions, straight answers.</h2>
    </div>
    <div className="reveal">
      <details className="faq-item-acc" open>
        <summary>
          <span className="q">Is this just AI spam?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">No — and the design makes it hard to spam. Every application is drafted for one specific opening, references specifics from the post and your real background, and is sent by <em>you</em>, from <em>your own inbox</em>, after you&apos;ve read it. There&apos;s a daily cap on sends precisely so nobody can blast.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Does Freelanly ever send anything without me?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">No. Nothing is ever emailed on your behalf without your click. Drafts wait in your queue until you review and send them — or delete them.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Will hiring managers know it&apos;s AI?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Letters reference the specifics of the job post and your actual portfolio, then go through a second AI reviewer pass — so they read like a short, thoughtful note, not a template. And you can edit every word before sending. What arrives is what you approved.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">What does it cost?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Signing up is free and your first application is on us — no credit card. After that, PRO is $5/month: unlimited applications and a morning ready-queue, with your CV attached to every send. Cancel anytime from your billing page, in two clicks.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">What happens to my data if I cancel?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">You can export your applications and replies to CSV with one click, and delete your account — with all its data — right from Settings. We never sell or share your data with third parties.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Does Freelanly work for full-time roles, not just freelance?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Yes — Freelanly covers both vacancies and freelance projects. Same feed, same filters, same AI drafting; the cover letter adjusts its tone to the type of role.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Will I get banned from LinkedIn or my email provider?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Applications go out from <em>your</em> inbox via Gmail OAuth (or your own SMTP), at human cadence, capped per day — that cap exists to protect your sender reputation. On the LinkedIn side we only read public hiring posts: no auto-DM, no auto-connect, nothing done with your LinkedIn account.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">How is this different from Upwork or Indeed?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Upwork is a marketplace — you compete with hundreds of freelancers per job and pay a fee on everything you earn. Freelanly is direct application: openings sourced from hiring posts and career pages, your letter, your inbox, no middleman between you and the client.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">How do I contact support?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Email support@freelanly.com. It&apos;s a small independent team — you&apos;ll get an answer from someone who actually works on the product.</div>
      </details>
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta" style={{position: 'relative', padding: '120px 0', overflow:'hidden', borderTop: '1px solid var(--line)'}}>
  <div style={{position:'absolute', width:'900px', height:'600px', background: 'radial-gradient(ellipse, rgba(199,249,74,0.16), transparent 60%)', filter: 'blur(40px)', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents:'none'}}></div>
  <div className="container" style={{position:'relative', textAlign:'center'}}>
    <span className="eyebrow eyebrow-accent">— One last thing</span>
    <h2 style={{fontSize: 'clamp(40px, 5.5vw, 68px)', letterSpacing: '-0.035em', marginTop: '16px', marginBottom: '22px'}}>Less applying. <span style={{color:'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>More working.</span></h2>
    <p style={{fontSize: '18px', color: 'var(--ink-3)', maxWidth: '540px', margin: '0 auto 32px'}}>Sign up free, plug in your inbox, see who&apos;s hiring.</p>
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
