import { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import '../marketing-styles.css';
import './about-design.css';

export const metadata: Metadata = {
  title: 'About Freelanly — why we built the freelancer\'s outreach engine',
  description: 'Freelanly was built by ex-freelancers tired of losing gigs because they couldn\'t out-apply the crowd. Read our manifesto, team, and timeline.',
  alternates: { canonical: `${siteConfig.url}/about` },
};

const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>;

export default function AboutPage() {
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
    <h1 style={{marginTop: '18px'}}>Built by freelancers who got tired of <span className="accent">applying.</span></h1>
    <p className="lede">In 2024, our co-founder spent 90 minutes every morning refreshing Upwork and Indeed for half-decent contracts. He shipped one line of client code per day. So he built Freelanly. Now 10,000+ freelancers in 90+ countries run their outreach this way.</p>
  </div>
</header>

{/* Manifesto */}
<section className="section">
  <div className="container">
    <div className="manifesto reveal">
      <p>We started with one belief: <strong>the freelancer&apos;s biggest cost isn&apos;t taxes or tools — it&apos;s the time spent looking for the next gig.</strong> A typical full-time freelancer loses 8–12 hours a week to job-hunting. That&apos;s a full billable day. Every week.</p>
      <p>The job-board industry doesn&apos;t want to fix this. Their business model depends on you refreshing the same feed 30 times a day. Their feeds depend on listings that have already been seen by 500 people.</p>
      <div className="pull">
        We&apos;re building the opposite of a job board. A feed that catches openings <span style={{color: 'var(--accent)', fontStyle: 'italic'}}>before</span> they hit the boards, writes the email for you, and sends it — so you can be back to the work that pays.
      </div>
      <p>Freelanly is a tool, not a community. We don&apos;t sell ads to recruiters. We don&apos;t sell your data. Our only customer is you, the freelancer, and our only metric is whether you book more work with less time on the application treadmill.</p>
      <p>If we ever stop doing that — leave. Take your data with you. We&apos;ll help you set up a competitor.</p>
    </div>
  </div>
</section>

{/* Story quote */}
<section className="section-xs">
  <div className="container">
    <div className="story-banner reveal">
      <div className="quote">&ldquo;I built Freelanly because I&apos;d lost three good contracts to <span className="accent">someone who replied two hours earlier than me.</span> That&apos;s it. That&apos;s the whole insight.&rdquo;</div>
      <div className="author">— Daniil V., Founder &amp; CEO</div>
    </div>
  </div>
</section>

{/* Timeline */}
<section className="section-sm">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— Timeline</span>
      <h2>Two years. Two co-founders. <span style={{color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>10,000+ users.</span></h2>
    </div>
    <div className="timeline reveal">
      <div className="tl-step">
        <div className="tl-year">Mar · 2024</div>
        <h4>One-day side project</h4>
        <p>Daniil scripts a LinkedIn scraper to find React contracts before they hit Upwork. Uses it personally for 3 weeks. Lands 2 retainers.</p>
      </div>
      <div className="tl-step">
        <div className="tl-year">Oct · 2024</div>
        <h4>First 100 users</h4>
        <p>Posts on Indie Hackers. First 100 paying users sign up in a week. AI cover-letter feature ships, becomes the #1 reason people stay.</p>
      </div>
      <div className="tl-step">
        <div className="tl-year">May · 2025</div>
        <h4>The auto-apply engine</h4>
        <p>Maya joins as CTO. Builds the rules engine, the throttling system, the unified inbox. The product becomes a tool, not a hack.</p>
      </div>
      <div className="tl-step">
        <div className="tl-year">Today</div>
        <h4>10K+ freelancers · 90+ countries</h4>
        <p>500+ applications go out daily. 8% reply rate, on average. No outside funding. Profitable since month 9.</p>
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
        <h3>No dark patterns. Ever.</h3>
        <p>One-click cancel. One-click data export. No hidden upsells, no &quot;are you sure you want to leave&quot; four-step downgrade flows. We compete on the product, not the friction.</p>
      </div>
      <div className="value reveal">
        <div className="value-num">— 03</div>
        <h3>Reply rate, not application count.</h3>
        <p>Spam tools optimize for volume. We optimize for replies. If we ever start bragging about &quot;100,000 applications sent&quot; instead of reply quality, fire us.</p>
      </div>
    </div>
  </div>
</section>

{/* Team */}
<section className="section-sm">
  <div className="container">
    <div className="section-head reveal">
      <span className="eyebrow">— The team</span>
      <h2>Four people. <span style={{color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>No middle managers.</span></h2>
    </div>
    <div className="team-grid">
      <div className="member reveal">
        <div className="member-avatar" style={{background:'#C7F94A', color:'#000'}}>DV</div>
        <h4>Daniil Volkov</h4>
        <div className="role">— Founder, CEO</div>
        <p>Ex-freelance React dev. Built v1 in a week. Still answers support emails.</p>
      </div>
      <div className="member reveal">
        <div className="member-avatar" style={{background:'#6EE7FF', color:'#000'}}>MO</div>
        <h4>Maya Okafor</h4>
        <div className="role">— CTO</div>
        <p>Built the rules engine and the inbox. Previously at Plain &amp; Linear.</p>
      </div>
      <div className="member reveal">
        <div className="member-avatar" style={{background:'#FFB951', color:'#000'}}>RT</div>
        <h4>Ravi Thakkar</h4>
        <div className="role">— Head of AI</div>
        <p>The cover-letter model lives in his head. ML/NLP, 6 years at Anthropic before joining.</p>
      </div>
      <div className="member reveal">
        <div className="member-avatar" style={{background:'#FF6B6B', color:'#000'}}>SC</div>
        <h4>Sofia Chen</h4>
        <div className="role">— Design &amp; growth</div>
        <p>Designed this site. Runs the freelancer community calls. Replies in your inbox.</p>
      </div>
    </div>
  </div>
</section>

{/* FAQ */}
<section className="section" id="faq">
  <div className="container" style={{maxWidth: '920px'}}>
    <div className="section-head reveal" style={{marginBottom: '32px'}}>
      <span className="eyebrow">— FAQ</span>
      <h2>Everything else.</h2>
    </div>
    <div className="reveal">
      <details className="faq-item-acc" open>
        <summary>
          <span className="q">Does this actually work, or is it just AI spam?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">It&apos;s outreach, not spam. Every application is personalized to the specific job and sent from your real inbox — not a bulk-mail server. The median Pro user sends ~280 applications/month and gets ~22 replies. That&apos;s an 8% reply rate, well above industry baseline for cold outreach.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Will hiring managers know it&apos;s AI?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">No — and we test for this regularly. Cover letters reference specifics from the job post, your portfolio, and (when public) the hiring manager&apos;s background. They read like a thoughtful 3-minute write-up because, structurally, they are. We&apos;ve A/B tested against human-written letters and reply rates are within 1.5%.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Can I edit applications before they&apos;re sent?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Always. Two modes: <strong style={{color: 'var(--ink)'}}>Review</strong> (drafts queue up and wait for your OK) and <strong style={{color: 'var(--ink)'}}>Auto</strong> (we send for you, with a 60-minute recall window in case you change your mind). Most Pro users start in Review for a week, then flip to Auto.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">What happens to my data if I cancel?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">You can export everything — applications, replies, contacts, templates — to CSV with one click. We hard-delete the rest of your data within 30 days of cancellation, unless you ask us to keep it. We never sell or share data with third parties.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Does Freelanly work for full-time roles, not just freelance?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Yes — about 30% of our users are looking for remote full-time roles. Same engine, same filters, just check &quot;FT roles&quot; in your preferences. The AI cover letter adjusts tone accordingly.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Will I get banned from LinkedIn / my email provider?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Applications go out from <em>your</em> inbox via OAuth, at human cadence — never more than 25/day, spread across business hours, with randomized timing. We&apos;ve sent millions of emails this way; zero account suspensions on the email side. For LinkedIn, we only read public hiring posts (no auto-DM, no auto-connect), so there&apos;s no policy violation.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Is there a free trial?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Yes. The Free plan gives you 10 AI applications/month, forever. Pro has a 7-day full-access trial with no credit card required up front. If you don&apos;t book at least one interview during the trial, we&apos;ll extend it on request.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">How is this different from Upwork or Indeed?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Upwork is a marketplace — you compete with 500 other freelancers per job, pay a 10% fee, and the rate gets squeezed downward. Freelanly is direct outreach to companies hiring outside marketplaces. No middleman fees, no race-to-the-bottom rates, and the contracts are usually 2–3× higher.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">Do you have a freelancer Slack / community?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Yes — a Discord with ~3,000 active members, free to join with any plan. Members share contracts they&apos;ve passed on, review each other&apos;s portfolios, and run a weekly &quot;what&apos;s working in your inbox&quot; call.</div>
      </details>
      <details className="faq-item-acc">
        <summary>
          <span className="q">How do I contact support?</span>
          <span className="icon"><PlusIcon /></span>
        </summary>
        <div className="a">Email hello@freelanly.com — replies usually within 4 hours on weekdays. Pro &amp; Agency plans get live chat in the app. There&apos;s no support phone line; we believe written support produces better answers.</div>
      </details>
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta" style={{position: 'relative', padding: '120px 0', overflow:'hidden', borderTop: '1px solid var(--line)'}}>
  <div style={{position:'absolute', width:'900px', height:'600px', background: 'radial-gradient(ellipse, rgba(199,249,74,0.16), transparent 60%)', filter: 'blur(40px)', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents:'none'}}></div>
  <div className="container" style={{position:'relative', textAlign:'center'}}>
    <span className="eyebrow eyebrow-accent">— One last thing</span>
    <h2 style={{fontSize: 'clamp(40px, 5.5vw, 68px)', letterSpacing: '-0.035em', marginTop: '16px', marginBottom: '22px'}}>Less reading. <span style={{color:'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>More replying.</span></h2>
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
        <p>AI outreach engine for freelancers. Be first in the inbox. Win the project.</p>
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
        <h5>Resources</h5>
        <ul>
          <li><a href="/freelance">Browse Jobs</a></li>
          <li><a href="/companies">Companies</a></li>
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
