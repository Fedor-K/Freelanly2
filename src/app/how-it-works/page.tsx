import { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import '../marketing-styles.css';
import './hiw-design.css';

export const metadata: Metadata = {
  title: 'How Freelanly works — from discovery to signed contract',
  description: 'See the full pipeline: real-time gig discovery, AI personalization, smart sending, follow-ups, and reply tracking — explained step by step.',
  alternates: { canonical: `${siteConfig.url}/how-it-works` },
};

const Chk = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;

export default function HowItWorksPage() {
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
<header className="page-head">
  <div className="page-head-bg"></div>
  <div className="container">
    <div className="page-head-grid">
      <div>
        <span className="eyebrow eyebrow-accent">— How it works</span>
        <h1 style={{marginTop: '18px'}}>The whole loop,<br/>from <span className="accent">post</span> to <span className="accent">paycheck.</span></h1>
        <p className="lede" style={{marginTop: '22px'}}>Freelanly is a five-step pipeline running 24/7. Here&apos;s what&apos;s actually happening between &quot;new freelance gig posted&quot; and &quot;client replies.&quot;</p>
      </div>
      <nav className="toc">
        <div className="toc-label">On this page</div>
        <ol>
          <li><a href="#discover">Discovery</a></li>
          <li><a href="#match">Smart matching</a></li>
          <li><a href="#write">AI cover letter</a></li>
          <li><a href="#send">Send &amp; inbox</a></li>
          <li><a href="#followup">Follow-up &amp; tracking</a></li>
        </ol>
      </nav>
    </div>
  </div>
</header>

{/* STEP 1 — Discovery */}
<section className="step-section" id="discover">
  <div className="container">
    <div className="step-grid">
      <div className="step-copy reveal">
        <div className="step-num"><span className="step-bar"></span> Step 01 — Discovery</div>
        <h2>Catch <span className="accent">hiring posts</span> before they hit the boards.</h2>
        <p>Every 3 hours, Freelanly scrapes LinkedIn for fresh &quot;we&apos;re hiring a...&quot; posts and crawls 3,400+ company career pages. We surface jobs <strong>18–48 hours before</strong> they reach Indeed, Upwork, or LinkedIn Jobs.</p>
        <ul className="bullet-list">
          <li><Chk /> <span><strong>3,400+ company pages</strong> crawled every 3 hours</span></li>
          <li><Chk /> <span><strong>LinkedIn signal extraction</strong> — hiring manager posts, not just &quot;Open to work&quot;</span></li>
          <li><Chk /> <span><strong>Direct contact</strong> — email or LinkedIn of the actual hiring manager when available</span></li>
        </ul>
      </div>
      <div className="step-visual reveal">
        <div className="visual-frame">
          <div className="frame-header">
            <span className="frame-title">Live discovery feed</span>
            <span className="pill pill-accent"><span className="pill-dot"></span>RUNNING</span>
          </div>
          <div className="discovery-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input value="React + remote + EU TZ + long-term" readOnly />
            <span className="tag">14,802 hits</span>
          </div>
          <div className="discovery-source-grid">
            <div className="source-card">
              <div className="source-card-head"><span className="name">LinkedIn posts</span><span className="live"><span className="pill-dot"></span>LIVE</span></div>
              <div className="count">8,241<span className="delta">+312 today</span></div>
            </div>
            <div className="source-card">
              <div className="source-card-head"><span className="name">Career pages</span><span className="live"><span className="pill-dot"></span>LIVE</span></div>
              <div className="count">5,601<span className="delta">+147 today</span></div>
            </div>
          </div>
          <div className="discovery-results">
            <div className="discovery-result">
              <div className="logo" style={{background:'#FF6B6B'}}>L</div>
              <div>
                <div className="title">Senior React Developer — Linear</div>
                <div className="meta">linkedin.com/posts/sarah-chen · remote, EU TZ</div>
              </div>
              <span className="age">2m</span>
            </div>
            <div className="discovery-result">
              <div className="logo" style={{background:'#A8E024'}}>V</div>
              <div>
                <div className="title">Full-Stack Engineer — Vercel</div>
                <div className="meta">vercel.com/careers · contract · 6h ahead of LinkedIn</div>
              </div>
              <span className="age">12m</span>
            </div>
            <div className="discovery-result">
              <div className="logo" style={{background:'#6EE7FF'}}>S</div>
              <div>
                <div className="title">Brand Designer — Stripe</div>
                <div className="meta">linkedin.com/posts/marcus-d · 3-month sprint</div>
              </div>
              <span className="age">34m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* STEP 2 — Smart matching */}
<section className="step-section" id="match">
  <div className="container">
    <div className="step-grid reverse">
      <div className="step-copy reveal">
        <div className="step-num"><span className="step-bar"></span> Step 02 — Smart matching</div>
        <h2>Filter <span className="accent">in</span> what you want.<br/>Filter <span className="accent">out</span> the rest.</h2>
        <p>Auto-apply runs on rules you set once. Stack, rate, role, location, language, deal-breaker keywords. Freelanly only applies when every condition matches — so you never wake up to 200 applications for jobs you&apos;d never take.</p>
        <ul className="bullet-list">
          <li><Chk /> <span><strong>Positive &amp; negative filters</strong> — keywords, tech stack, company type, location</span></li>
          <li><Chk /> <span><strong>Daily caps</strong> so you don&apos;t blast your inbox reputation</span></li>
          <li><Chk /> <span><strong>Review mode</strong> — every draft waits for your OK before sending</span></li>
        </ul>
      </div>
      <div className="step-visual reveal">
        <div className="visual-frame" style={{padding: '24px'}}>
          <div className="frame-header">
            <span className="frame-title">Match rules</span>
            <span className="pill"><span style={{color: 'var(--accent)'}}>●</span> Active</span>
          </div>

          <div style={{display:'flex', flexDirection: 'column', gap: '18px', padding: '4px'}}>
            <div>
              <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '10px'}}>Must include</div>
              <div style={{display:'flex', gap: '6px', flexWrap: 'wrap'}}>
                <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>+ React</span>
                <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>+ TypeScript</span>
                <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>+ Remote</span>
                <span className="tag" style={{borderColor: 'rgba(199,249,74,0.3)', color: 'var(--accent)'}}>+ EU timezone</span>
              </div>
            </div>
            <div>
              <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '10px'}}>Must NOT include</div>
              <div style={{display:'flex', gap: '6px', flexWrap: 'wrap'}}>
                <span className="tag" style={{borderColor: 'rgba(248,113,113,0.3)', color: 'var(--bad)'}}>− &quot;Web3&quot;</span>
                <span className="tag" style={{borderColor: 'rgba(248,113,113,0.3)', color: 'var(--bad)'}}>− &quot;rockstar&quot;</span>
                <span className="tag" style={{borderColor: 'rgba(248,113,113,0.3)', color: 'var(--bad)'}}>− &quot;unpaid&quot;</span>
                <span className="tag" style={{borderColor: 'rgba(248,113,113,0.3)', color: 'var(--bad)'}}>− on-site</span>
              </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
              <div style={{border: '1px solid var(--line-2)', padding: '14px', borderRadius: '10px'}}>
                <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '6px'}}>Send window</div>
                <div style={{fontSize: '22px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.02em'}}>9–17<span style={{fontSize: '13px', color: 'var(--ink-3)', fontWeight: 400}}> Mon–Fri</span></div>
              </div>
              <div style={{border: '1px solid var(--line-2)', padding: '14px', borderRadius: '10px'}}>
                <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '6px'}}>Daily cap</div>
                <div style={{fontSize: '22px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.02em'}}>25<span style={{fontSize: '13px', color: 'var(--ink-3)', fontWeight: 400}}> apps</span></div>
              </div>
            </div>
            <div style={{display:'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: '10px', background: 'rgba(199,249,74,0.04)'}}>
              <div>
                <div style={{fontSize: '13px', color: 'var(--ink)', fontWeight: 500}}>Send mode</div>
                <div style={{fontSize: '11.5px', color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", marginTop: '2px'}}>Auto · drafts go out at 09:00 your TZ</div>
              </div>
              <div style={{width: '36px', height: '20px', background: 'var(--accent)', borderRadius: '999px', position: 'relative'}}><div style={{position:'absolute', right:'2px', top:'2px', width:'16px', height:'16px', background: '#000', borderRadius: '999px'}}></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* STEP 3 — AI cover letter */}
<section className="step-section" id="write">
  <div className="container">
    <div className="step-grid">
      <div className="step-copy reveal">
        <div className="step-num"><span className="step-bar"></span> Step 03 — AI cover letter</div>
        <h2>A letter that sounds like <span className="accent">you</span>,<br/>not a template.</h2>
        <p>The AI reads the job post, scrapes public info on the company and (when possible) the hiring manager, then writes a 90-word opener that references specifics from <strong>your portfolio</strong> and <strong>their work</strong>. No &quot;I hope this email finds you well.&quot; No buzzwords.</p>
        <ul className="bullet-list">
          <li><Chk /> <span><strong>Hooks from real specifics</strong> — they mentioned X? Your letter references X.</span></li>
          <li><Chk /> <span><strong>Learns your voice</strong> from 3 sample emails on setup</span></li>
          <li><Chk /> <span><strong>Drafted in &lt;2 seconds</strong>, but always editable</span></li>
        </ul>
      </div>
      <div className="step-visual reveal">
        <div className="visual-frame">
          <div className="frame-header">
            <span className="frame-title">Generated draft</span>
            <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: 'var(--ink-4)'}}>~92 words · 1.8s</span>
          </div>
          <div className="letter-tabs">
            <span className="letter-tab active">Draft</span>
            <span className="letter-tab">Variant B</span>
            <span className="letter-tab">Variant C</span>
            <span className="letter-tab" style={{marginLeft: 'auto'}}>+ Regenerate</span>
          </div>
          <div className="letter-body">
            <div className="from">
              <strong>From:</strong> alex@kowalski.dev<br/>
              <strong>To:</strong> sarah@linear.app<br/>
              <strong>Subject:</strong> Re: hiring a React dev for the mobile sync engine
            </div>
            Hey <mark>Sarah</mark>,<br/><br/>
            Saw your post about hiring a React dev for <mark>Linear&apos;s mobile sync engine</mark>. I shipped a similar offline-first conflict resolver last quarter for <mark>Plain</mark> — happy to walk through how I&apos;d approach the CRDT layer.<br/><br/>
            A couple of pieces from the portfolio that line up: <mark>alex.dev/plain-sync</mark> and <mark>alex.dev/notion-style-resolver</mark>. Both are public.<br/><br/>
            Open to a 20-minute call this week — flexible on your TZ.<br/><br/>
            — Alex
          </div>
          <div className="letter-meta-row">
            <span className="meta-pill">&#10003; References job specifics</span>
            <span className="meta-pill">&#10003; Portfolio links</span>
            <span className="meta-pill">&#10003; Sounds human (97%)</span>
            <span className="meta-pill" style={{color: 'var(--accent)', borderColor: 'rgba(199,249,74,0.3)'}}>&#8627; 11.2% reply rate</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* STEP 4 — Send & inbox */}
<section className="step-section" id="send">
  <div className="container">
    <div className="step-grid reverse">
      <div className="step-copy reveal">
        <div className="step-num"><span className="step-bar"></span> Step 04 — Send &amp; inbox</div>
        <h2>From <span className="accent">your</span> inbox.<br/>Tracked end-to-end.</h2>
        <p>Connect Gmail or Outlook and Freelanly sends as you, not from a bulk-mail domain. Every send is rate-limited to look human (max 25/day, throttled across business hours, randomized timing). Replies land back in a unified inbox.</p>
        <ul className="bullet-list">
          <li><Chk /> <span><strong>Sends from your email</strong> via OAuth — Gmail, Outlook, Fastmail, custom SMTP</span></li>
          <li><Chk /> <span><strong>Human-cadence throttling</strong> protects your sender reputation</span></li>
          <li><Chk /> <span><strong>Unified inbox</strong> — replies route back, labeled by job &amp; status</span></li>
        </ul>
      </div>
      <div className="step-visual reveal">
        <div className="visual-frame">
          <div className="frame-header">
            <span className="frame-title">Inbox · today</span>
            <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: 'var(--ink-3)'}}>Sending as alex@kowalski.dev</span>
          </div>
          <div className="send-status-grid">
            <div className="send-status-card">
              <div className="label">Sent today</div>
              <div className="val accent">22</div>
            </div>
            <div className="send-status-card">
              <div className="label">Replies</div>
              <div className="val">3 <span style={{fontSize: '12px', color: 'var(--ink-3)', fontFamily: "'Geist Mono', monospace", fontWeight: 400}}>/ 13.6%</span></div>
            </div>
          </div>
          <div className="inbox-list">
            <div className="inbox-row unread">
              <span className="indicator"></span>
              <div className="avatar" style={{background:'#FF6B6B'}}>S</div>
              <div>
                <div className="from">Sarah Chen · Linear</div>
                <div className="subject">Re: hiring a React dev — yes, would love to chat</div>
              </div>
              <div className="time">2m</div>
            </div>
            <div className="inbox-row unread">
              <span className="indicator"></span>
              <div className="avatar" style={{background:'#6EE7FF'}}>M</div>
              <div>
                <div className="from">Marcus D. · Stripe</div>
                <div className="subject">Re: brand sprint — got a deck I can share?</div>
              </div>
              <div className="time">1h</div>
            </div>
            <div className="inbox-row read">
              <span className="indicator"></span>
              <div className="avatar" style={{background:'#FFB951'}}>P</div>
              <div>
                <div className="from">Priya R. · Vercel</div>
                <div className="subject">Re: full-stack contract — when can you start?</div>
              </div>
              <div className="time">3h</div>
            </div>
            <div className="inbox-row read">
              <span className="indicator"></span>
              <div className="avatar" style={{background:'#A78BFA'}}>J</div>
              <div>
                <div className="from">Jamie L. · Railway</div>
                <div className="subject">Re: DevOps role — currently on hold, will circle back</div>
              </div>
              <div className="time">Yesterday</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* STEP 5 — Follow-up & tracking */}
<section className="step-section" id="followup" style={{borderBottom: 'none'}}>
  <div className="container">
    <div className="step-grid">
      <div className="step-copy reveal">
        <div className="step-num"><span className="step-bar"></span> Step 05 — Follow-up &amp; tracking</div>
        <h2><span className="accent">80%</span> of replies come<br/>from the follow-up.</h2>
        <p>If they go quiet for 5 days, Freelanly sends one short, polite nudge. If they go quiet again, one more. Then it stops. You see open, reply, and interview rates per template — so you can double down on what&apos;s working.</p>
        <ul className="bullet-list">
          <li><Chk /> <span><strong>2 follow-ups max</strong>, then stops automatically</span></li>
          <li><Chk /> <span><strong>Pauses the moment they reply</strong> — no awkward double-sends</span></li>
          <li><Chk /> <span><strong>Per-template analytics</strong> — see which openers earn replies, which don&apos;t</span></li>
        </ul>
      </div>
      <div className="step-visual reveal">
        <div className="visual-frame">
          <div className="frame-header">
            <span className="frame-title">Thread · Linear application</span>
            <span className="pill pill-accent"><span className="pill-dot"></span>REPLIED &#10003;</span>
          </div>
          <div className="thread">
            <div className="msg">
              <div className="msg-head"><span className="from">Alex → Sarah · Linear</span><span className="when">Mon 09:14</span></div>
              <div className="msg-body" style={{color: 'var(--ink-3)'}}>Hey Sarah, saw your post about hiring a React dev for the mobile sync engine…</div>
            </div>
            <div className="msg followup">
              <div className="msg-head"><span className="from">Auto follow-up sent</span><span className="when">Sat 09:00 (+5d)</span></div>
              <div className="msg-body">Hey Sarah — quick bump on the React role. If timing&apos;s off, totally cool — happy to circle back in a month. — Alex</div>
            </div>
            <div className="msg" style={{borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)'}}>
              <div className="msg-head"><span className="from" style={{color: 'var(--good)'}}>Sarah replied</span><span className="when">Sat 14:22 · 5h later</span></div>
              <div className="msg-body">Sorry for the silence — was heads-down on launch. Yes, would love to chat. Tuesday 3pm CET work?</div>
            </div>
          </div>

          <div className="track-table-mini" style={{marginTop: '20px'}}>
            <div className="header">Template</div>
            <div className="header val">Sent</div>
            <div className="header val">Reply</div>
            <div>Short opener / portfolio-first</div>
            <div className="val">147</div>
            <div className="val accent">12.4%</div>
            <div>Long opener / project recap</div>
            <div className="val">82</div>
            <div className="val">6.1%</div>
            <div style={{borderBottom: 'none'}}>Casual / &quot;saw your post&quot;</div>
            <div className="val" style={{borderBottom: 'none'}}>63</div>
            <div className="val accent" style={{borderBottom: 'none'}}>14.3%</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="final-cta" style={{position: 'relative', padding: '120px 0', overflow:'hidden', borderTop: '1px solid var(--line)'}}>
  <div style={{position:'absolute', width:'900px', height:'600px', background: 'radial-gradient(ellipse, rgba(199,249,74,0.16), transparent 60%)', filter: 'blur(40px)', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents:'none'}}></div>
  <div className="container" style={{position:'relative', textAlign:'center'}}>
    <span className="eyebrow eyebrow-accent">— Try it for free</span>
    <h2 style={{fontSize: 'clamp(40px, 5.5vw, 68px)', letterSpacing: '-0.035em', marginTop: '16px', marginBottom: '22px'}}>Five steps. <span style={{color:'var(--accent)', fontStyle: 'italic', fontWeight: 500}}>Zero busywork.</span></h2>
    <p style={{fontSize: '18px', color: 'var(--ink-3)', maxWidth: '540px', margin: '0 auto 32px'}}>Plug in your inbox, set your filters, and see what comes back this week.</p>
    <div style={{display:'flex', gap: '12px', justifyContent:'center', flexWrap:'wrap'}}>
      <Link href="/auth/signin" className="btn btn-primary btn-lg">Start free
        <svg className="btn-icon btn-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </Link>
      <Link href="/features" className="btn btn-ghost btn-lg">Explore features</Link>
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
