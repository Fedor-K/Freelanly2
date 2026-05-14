import { Metadata } from 'next';
import './inbox-design.css';

export const metadata: Metadata = {
  title: 'Inbox — Freelanly',
};

export default function InboxPage() {
  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Inbox <span style={{fontSize: '16px', color: 'var(--ink-4)', fontWeight: 400, fontFamily: "'Geist Mono', monospace"}}>· 3 new</span></h1>
          <p>All replies routed to one place. Calls auto-booked when prospects pick a time.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className="active">All</button>
            <button>Unread (3)</button>
            <button>Interested</button>
            <button>Booked</button>
            <button>Snoozed</button>
          </div>
        </div>
      </div>

      <div className="inbox-grid">

        {/* THREAD LIST */}
        <div className="card" style={{overflow: 'hidden'}}>
          <div className="thread-list">
            <div className="thread-item unread active">
              <div className="avatar av-sm" style={{background:'#FF6B6B'}}>SC</div>
              <div>
                <div className="row between" style={{marginBottom: '2px'}}>
                  <span className="name" style={{fontSize: '13.5px'}}>Sarah Chen</span>
                  <span className="meta" style={{fontSize: '10.5px'}}>2m</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Linear · Senior React Dev</div>
                <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>yes, would love to chat. Tuesday 3pm CET work? happy to send a calendly...</div>
                <div className="row gap-1 mt-2"><span className="chip chip-acid-soft" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>interested</span></div>
              </div>
            </div>

            <div className="thread-item unread">
              <div className="avatar av-sm" style={{background:'#FFB951'}}>PR</div>
              <div>
                <div className="row between" style={{marginBottom: '2px'}}>
                  <span className="name" style={{fontSize: '13.5px'}}>Priya R.</span>
                  <span className="meta" style={{fontSize: '10.5px'}}>3h</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Vercel · Full-Stack Contract</div>
                <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>when can you start? booked you in for tomorrow 10am via Calendly...</div>
                <div className="row gap-1 mt-2"><span className="chip chip-good" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>booked</span></div>
              </div>
            </div>

            <div className="thread-item unread">
              <div className="avatar av-sm" style={{background:'#6EE7FF'}}>MD</div>
              <div>
                <div className="row between" style={{marginBottom: '2px'}}>
                  <span className="name" style={{fontSize: '13.5px'}}>Marcus Davies</span>
                  <span className="meta" style={{fontSize: '10.5px'}}>1h</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Stripe · Brand sprint</div>
                <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>got a deck I can share with the team? would love to see process work...</div>
                <div className="row gap-1 mt-2"><span className="chip" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>info-req</span></div>
              </div>
            </div>

            <div className="thread-item">
              <div className="avatar av-sm" style={{background:'#A78BFA'}}>JL</div>
              <div>
                <div className="row between" style={{marginBottom: '2px'}}>
                  <span className="name" style={{fontSize: '13.5px'}}>Jamie L.</span>
                  <span className="meta" style={{fontSize: '10.5px'}}>Yesterday</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Notion · Frontend retainer</div>
                <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>interesting — could you share scope &amp; timeline? we&apos;d want to start in 2 weeks if it&apos;s a fit</div>
                <div className="row gap-1 mt-2"><span className="chip" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>negotiating</span></div>
              </div>
            </div>

            <div className="thread-item">
              <div className="avatar av-sm" style={{background:'#34D399'}}>RT</div>
              <div>
                <div className="row between" style={{marginBottom: '2px'}}>
                  <span className="name" style={{fontSize: '13.5px'}}>Riley Tanaka</span>
                  <span className="meta" style={{fontSize: '10.5px'}}>Mon</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Cron · React Native</div>
                <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>we went with someone in-house — but appreciate the thoughtful pitch...</div>
                <div className="row gap-1 mt-2"><span className="chip chip-bad" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>passed</span></div>
              </div>
            </div>

            <div className="thread-item">
              <div className="avatar av-sm" style={{background:'#FF6B6B'}}>AK</div>
              <div>
                <div className="row between" style={{marginBottom: '2px'}}>
                  <span className="name" style={{fontSize: '13.5px'}}>Anna Klimt</span>
                  <span className="meta" style={{fontSize: '10.5px'}}>Mon</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Plain · Onboarding rebuild</div>
                <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>contract signed, sending kickoff invite for next monday</div>
                <div className="row gap-1 mt-2"><span className="chip chip-good" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>contract signed</span></div>
              </div>
            </div>

            <div className="thread-item">
              <div className="avatar av-sm" style={{background:'#A8E024'}}>VC</div>
              <div>
                <div className="row between" style={{marginBottom: '2px'}}>
                  <span className="name" style={{fontSize: '13.5px'}}>Vlad C.</span>
                  <span className="meta" style={{fontSize: '10.5px'}}>Last week</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Railway · DevOps</div>
                <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>circling back in jan — bandwidth issues on our end this quarter</div>
                <div className="row gap-1 mt-2"><span className="chip" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>snoozed</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVE THREAD */}
        <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
          <div className="card-head" style={{padding: '14px 24px'}}>
            <div className="row gap-3" style={{alignItems: 'center'}}>
              <div className="avatar" style={{background:'#FF6B6B', width: '36px', height: '36px', fontSize: '12px'}}>SC</div>
              <div>
                <div style={{fontSize: '14px', fontWeight: 500}}>Sarah Chen</div>
                <div className="meta" style={{marginTop: '2px'}}>Engineering Manager · Linear · sarah@linear.app</div>
              </div>
              <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Interested</span>
            </div>
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm">Book call</button>
              <button className="btn btn-ghost btn-sm">Move to Pipeline</button>
              <button className="btn btn-ghost btn-sm">&#x22EF;</button>
            </div>
          </div>

          <div className="message-list" style={{flex: 1}}>
            <div className="msg you">
              <div className="msg-head"><span className="msg-from">You · sent via Freelanly</span><span className="msg-time">Today, 10:14 AM</span></div>
              <div className="msg-body">Hi Sarah,<br/><br/>Saw your post — I&apos;ve shipped offline-first sync at Notion (2022-23) using a CRDT-flavored merge layer, and it&apos;s the work I&apos;m proudest of. Architecture write-up here: chen.studio/notion-sync.<br/><br/>I&apos;m EU-based (Berlin), available ~30 hrs/week starting mid-November. Last 3 references all from senior eng leaders — happy to share.<br/><br/>Quick call this week?<br/><br/>— Alex</div>
            </div>

            <div className="msg them">
              <div className="msg-head"><span className="msg-from">Sarah Chen</span><span className="msg-time">Today, 11:42 AM</span></div>
              <div className="msg-body">Hi Alex — yes, would love to chat. Tuesday 3pm CET work? Read your Notion writeup last night, this is exactly the experience we need. Happy to send a calendly if Tue doesn&apos;t work.<br/><br/>One thing I should mention upfront: the role is full-time, not contract. Hope that&apos;s still a fit.</div>
            </div>
          </div>

          <div className="reply-cta">
            <div className="note">
              <b>Reply directly from your email.</b> Sarah&apos;s message is in your inbox at <span className="f-mono">alex@chen.studio</span> — reply there and Freelanly will track the thread automatically.
            </div>
            <a href="#" className="btn btn-acid btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              Open in Gmail
            </a>
          </div>
        </div>

      </div>

    </div>
  );
}
