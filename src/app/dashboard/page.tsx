import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import './dashboard-design.css';

export const metadata: Metadata = {
  title: 'Dashboard — Freelanly',
};

export default async function DashboardOverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title">
          <h1>{greeting}, {firstName}.</h1>
          <p>It&apos;s {dayName} — 22 applications queued for today. 3 new replies waiting.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button>Today</button>
            <button className="active">7d</button>
            <button>30d</button>
            <button>All</button>
          </div>
          <a href="/dashboard/auto-apply" className="btn btn-acid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Apply to new gigs
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid mb-4">
        <div className="kpi">
          <div className="kpi-label">Applications sent</div>
          <div className="kpi-value tabular">187</div>
          <div className="kpi-delta up">↑ 12% vs last week</div>
          <svg className="kpi-spark" viewBox="0 0 70 30" preserveAspectRatio="none">
            <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points="0,22 10,18 20,20 30,14 40,16 50,10 60,8 70,5"/>
          </svg>
        </div>
        <div className="kpi">
          <div className="kpi-label">Replies</div>
          <div className="kpi-value tabular">17 <span className="unit">/ 9.1%</span></div>
          <div className="kpi-delta up">↑ 2.4pp vs last week</div>
          <svg className="kpi-spark" viewBox="0 0 70 30" preserveAspectRatio="none">
            <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points="0,20 10,22 20,16 30,18 40,12 50,14 60,8 70,6"/>
          </svg>
        </div>
        <div className="kpi">
          <div className="kpi-label">Opened</div>
          <div className="kpi-value tabular">138 <span className="unit">/ 73.8%</span></div>
          <div className="kpi-delta up">↑ 4.1pp vs last week</div>
          <svg className="kpi-spark" viewBox="0 0 70 30" preserveAspectRatio="none">
            <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points="0,24 10,24 20,22 30,18 40,16 50,14 60,10 70,8"/>
          </svg>
        </div>
        <div className="kpi">
          <div className="kpi-label">Follow-ups sent</div>
          <div className="kpi-value tabular">42</div>
          <div className="kpi-delta up">↑ 9 this week</div>
          <svg className="kpi-spark" viewBox="0 0 70 30" preserveAspectRatio="none">
            <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points="0,26 10,22 20,18 30,20 40,14 50,12 60,8 70,4"/>
          </svg>
        </div>
      </div>

      <div className="dash-grid">

        {/* LEFT COL */}
        <div className="col gap-4">

          {/* Today's queue */}
          <div className="card">
            <div className="card-head">
              <div className="row gap-3">
                <h3>Today&apos;s queue</h3>
                <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Auto-send 09:00 → 17:00</span>
              </div>
              <div className="row gap-2">
                <span className="meta">22 queued · 5 sent</span>
                <button className="btn btn-soft btn-sm">Pause</button>
              </div>
            </div>
            <div>
              <div className="queue-row">
                <span className="indicator" style={{background: 'var(--good)'}}></span>
                <div className="logo" style={{background:'#FF6B6B'}}>L</div>
                <div>
                  <div className="title">Senior React Developer · Linear</div>
                  <div className="meta">remote, EU<span className="sep">·</span>posted 12m ago<span className="sep">·</span>via LinkedIn</div>
                </div>
                <span className="match">96% match</span>
                <div className="actions">
                  <button className="btn btn-ghost btn-sm">Edit draft</button>
                  <button className="btn btn-primary btn-sm">Send now</button>
                </div>
              </div>
              <div className="queue-row">
                <span className="indicator" style={{background: 'var(--good)'}}></span>
                <div className="logo" style={{background:'#A8E024'}}>V</div>
                <div>
                  <div className="title">Full-Stack Engineer · Vercel</div>
                  <div className="meta">contract<span className="sep">·</span>6mo<span className="sep">·</span>3h ahead of LinkedIn</div>
                </div>
                <span className="match">91% match</span>
                <div className="actions">
                  <button className="btn btn-ghost btn-sm">Edit draft</button>
                  <button className="btn btn-primary btn-sm">Send now</button>
                </div>
              </div>
              <div className="queue-row">
                <span className="indicator" style={{background: 'var(--ink-5)'}}></span>
                <div className="logo" style={{background:'#6EE7FF'}}>S</div>
                <div>
                  <div className="title">Brand &amp; Web Designer · Stripe</div>
                  <div className="meta">SF / remote<span className="sep">·</span>posted 34m ago<span className="sep">·</span><span className="warn">outside your stack — review first</span></div>
                </div>
                <span className="match">78% match</span>
                <div className="actions">
                  <button className="btn btn-ghost btn-sm">Skip</button>
                  <button className="btn btn-primary btn-sm">Review</button>
                </div>
              </div>
              <div className="queue-row">
                <span className="indicator" style={{background: 'var(--good)'}}></span>
                <div className="logo" style={{background:'#FFB951'}}>P</div>
                <div>
                  <div className="title">React Native — onboarding refresh · Plain</div>
                  <div className="meta">project<span className="sep">·</span>4–6 weeks<span className="sep">·</span>remote</div>
                </div>
                <span className="match">94% match</span>
                <div className="actions">
                  <button className="btn btn-ghost btn-sm">Edit draft</button>
                  <button className="btn btn-primary btn-sm">Send now</button>
                </div>
              </div>
              <div className="queue-row">
                <span className="indicator" style={{background: 'var(--good)'}}></span>
                <div className="logo" style={{background:'#A78BFA'}}>R</div>
                <div>
                  <div className="title">DevOps engineer · Railway</div>
                  <div className="meta">contract<span className="sep">·</span>remote, async<span className="sep">·</span>EU TZ</div>
                </div>
                <span className="match">87% match</span>
                <div className="actions">
                  <button className="btn btn-ghost btn-sm">Edit draft</button>
                  <button className="btn btn-primary btn-sm">Send now</button>
                </div>
              </div>
              <div className="queue-row">
                <span className="indicator" style={{background: 'var(--ink-5)'}}></span>
                <div className="logo" style={{background:'#34D399'}}>N</div>
                <div>
                  <div className="title">+17 more queued for today</div>
                  <div className="meta">avg match 88%<span className="sep">·</span>will auto-send between 11:00–16:30 your TZ</div>
                </div>
                <span></span>
                <div className="actions">
                  <a href="/dashboard/auto-apply" className="btn btn-ghost btn-sm">View all</a>
                </div>
              </div>
            </div>
          </div>

          {/* Activity, last 14 days */}
          <div className="card card-pad">
            <div className="section-head">
              <div className="row gap-3">
                <h2>Activity, last 14 days</h2>
                <span className="chip"><span className="chip-dot" style={{background: 'var(--acid-deep)'}}></span>Applications</span>
                <span className="chip"><span className="chip-dot" style={{background: 'var(--info)'}}></span>Replies</span>
              </div>
              <a href="/dashboard/analytics" className="muted f-mono" style={{fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase'}}>Full analytics →</a>
            </div>
            <div className="spark-strip mt-3">
              {[12,18,9,22,16,28,21,19,32,24,18,29,33,38].map((v, i, arr) => (
                <div key={i} className="bar" style={{height: `${(v / Math.max(...arr)) * 100}%`, opacity: i === arr.length - 1 ? 1 : 0.85}} title={`${v} sent`}></div>
              ))}
            </div>
            <div className="row mt-3" style={{justifyContent: 'space-between', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', color: 'var(--ink-4)', letterSpacing: '0.04em'}}>
              <span>Oct 24</span><span>Oct 28</span><span>Nov 1</span><span>Nov 4</span><span>Today</span>
            </div>
          </div>

          {/* Funnel */}
          <div className="card card-pad">
            <div className="section-head">
              <h2>Funnel · last 30 days</h2>
              <span className="muted f-mono" style={{fontSize: '11px'}}>3.2% sent → offer</span>
            </div>
            <div className="funnel-row">
              <div className="name"><span className="chip-dot" style={{background: 'var(--s-sent)', width:'8px', height:'8px'}}></span>Sent</div>
              <div className="bar"><div className="fill" style={{width: '100%', background: 'var(--ink)'}}><span style={{color:'#fff'}}>643</span></div></div>
              <div className="pct">100%</div>
            </div>
            <div className="funnel-row">
              <div className="name"><span className="chip-dot" style={{background: 'var(--s-opened)', width:'8px', height:'8px'}}></span>Opened</div>
              <div className="bar"><div className="fill" style={{width: '74%', background: '#DCE9FE'}}><span style={{color: 'var(--info)'}}>476</span></div></div>
              <div className="pct">74%</div>
            </div>
            <div className="funnel-row">
              <div className="name"><span className="chip-dot" style={{background: 'var(--s-replied)', width:'8px', height:'8px'}}></span>Replied</div>
              <div className="bar"><div className="fill" style={{width: '8.1%', background: 'var(--acid)'}}><span>52</span></div></div>
              <div className="pct">8.1%</div>
            </div>
            <div className="funnel-row">
              <div className="name"><span className="chip-dot" style={{background: 'var(--s-booked)', width:'8px', height:'8px'}}></span>Booked</div>
              <div className="bar"><div className="fill" style={{width: '4.2%', background: '#D8C7F9'}}><span style={{color: 'var(--s-booked)'}}>27</span></div></div>
              <div className="pct">4.2%</div>
            </div>
            <div className="funnel-row">
              <div className="name"><span className="chip-dot" style={{background: 'var(--s-offer)', width:'8px', height:'8px'}}></span>Offer</div>
              <div className="bar"><div className="fill" style={{width: '3.2%', background: '#BBF7D0'}}><span style={{color: 'var(--s-offer)'}}>21</span></div></div>
              <div className="pct">3.2%</div>
            </div>
          </div>

        </div>

        {/* RIGHT COL */}
        <div className="col gap-4">

          {/* New replies */}
          <div className="card">
            <div className="card-head">
              <h3>New replies</h3>
              <a href="/dashboard/inbox" className="muted f-mono" style={{fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase'}}>Inbox →</a>
            </div>
            <a href="/dashboard/inbox" className="reply-row">
              <div className="avatar av-sm" style={{background:'#FF6B6B'}}>SC</div>
              <div>
                <div className="row between">
                  <span className="name">Sarah Chen · Linear</span>
                  <span className="chip chip-acid-soft" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>interested</span>
                </div>
                <div className="preview"><b>Re: hiring a React dev</b> — yes, would love to chat. Tuesday 3pm CET work?</div>
              </div>
              <span className="time">2m</span>
            </a>
            <a href="/dashboard/inbox" className="reply-row">
              <div className="avatar av-sm" style={{background:'#6EE7FF'}}>MD</div>
              <div>
                <div className="row between">
                  <span className="name">Marcus D. · Stripe</span>
                  <span className="chip" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>info-req</span>
                </div>
                <div className="preview"><b>Re: brand sprint</b> — got a deck I can share with the team?</div>
              </div>
              <span className="time">1h</span>
            </a>
            <a href="/dashboard/inbox" className="reply-row">
              <div className="avatar av-sm" style={{background:'#FFB951'}}>PR</div>
              <div>
                <div className="row between">
                  <span className="name">Priya R. · Vercel</span>
                  <span className="chip chip-good" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>booked</span>
                </div>
                <div className="preview"><b>Re: full-stack contract</b> — when can you start? Calendly tomorrow 10am.</div>
              </div>
              <span className="time">3h</span>
            </a>
          </div>

          {/* AI tip */}
          <div className="card card-pad" style={{background: 'linear-gradient(180deg, #FCFBEE, #FFFFFF)', borderColor: 'rgba(199,249,74,0.4)'}}>
            <div className="row gap-2 mb-2">
              <span className="chip chip-acid">★ TIP</span>
              <span className="eyebrow">From your data</span>
            </div>
            <div style={{fontSize: '14.5px', lineHeight: 1.5, color: 'var(--ink)', letterSpacing: '-0.005em'}}>
              Your <b>&quot;Short opener / portfolio-first&quot;</b> template has a <b style={{color: 'var(--acid-deep)'}}>14.3% reply rate</b> — 2× your account average. Want to make it the default for design roles?
            </div>
            <div className="row gap-2 mt-3">
              <button className="btn btn-primary btn-sm">Make default</button>
              <button className="btn btn-ghost btn-sm">Not now</button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
