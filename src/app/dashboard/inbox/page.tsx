import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import './inbox-design.css';

export const metadata: Metadata = {
  title: 'Inbox — Freelanly',
};

export const revalidate = 60;

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return 'Last week';
}

function chipClass(category: string | null): string {
  if (!category) return 'chip';
  const c = category.toLowerCase();
  if (['interested','interview'].includes(c)) return 'chip chip-acid-soft';
  if (['booked','offer','contract'].includes(c)) return 'chip chip-good';
  if (['rejected','not_interested','passed'].includes(c)) return 'chip chip-bad';
  return 'chip';
}

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;

  // Fetch all replied applications
  const replies = await prisma.autoApplication.findMany({
    where: { userId, status: { in: ['REPLIED', 'INTERVIEW', 'OFFER'] }, repliedAt: { not: null } },
    orderBy: { repliedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      companyName: true,
      jobTitle: true,
      coverLetter: true,
      subject: true,
      replyText: true,
      replyCategory: true,
      replySignal: true,
      repliedAt: true,
      sentAt: true,
      appliedToEmail: true,
      user: { select: { name: true, email: true } },
    },
  });

  const unreadCount = replies.filter(r => !r.replyCategory || ['INTERESTED','INTERVIEW'].includes(r.replyCategory)).length;
  const firstReply = replies[0] || null;

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Inbox <span style={{fontSize: '16px', color: 'var(--ink-4)', fontWeight: 400, fontFamily: "'Geist Mono', monospace"}}>· {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span></h1>
          <p>All replies routed to one place. Calls auto-booked when prospects pick a time.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className="active">All</button>
            <button>Unread ({unreadCount})</button>
            <button>Interested</button>
            <button>Booked</button>
          </div>
        </div>
      </div>

      <div className="inbox-grid">

        {/* THREAD LIST */}
        <div className="card" style={{overflow: 'hidden'}}>
          <div className="thread-list">
            {replies.length === 0 ? (
              <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
                No replies yet. Applications are being sent — replies will appear here.
              </div>
            ) : replies.map((r, i) => (
              <div key={r.id} className={`thread-item${i === 0 ? ' active' : ''}`}>
                <div className="avatar av-sm" style={{background: COLORS[i % COLORS.length]}}>{r.companyName.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="row between" style={{marginBottom: '2px'}}>
                    <span className="name" style={{fontSize: '13.5px'}}>{r.companyName}</span>
                    <span className="meta" style={{fontSize: '10.5px'}}>{r.repliedAt ? timeAgo(r.repliedAt) : ''}</span>
                  </div>
                  <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>{r.jobTitle}</div>
                  <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden'}}>{r.replyText?.slice(0, 120) || 'Reply received'}</div>
                  {r.replyCategory && (
                    <div className="row gap-1 mt-2">
                      <span className={chipClass(r.replyCategory)} style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>{r.replyCategory.toLowerCase()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIVE THREAD */}
        <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
          {firstReply ? (
            <>
              <div className="card-head" style={{padding: '14px 24px'}}>
                <div className="row gap-3" style={{alignItems: 'center'}}>
                  <div className="avatar" style={{background: COLORS[0], width: '36px', height: '36px', fontSize: '12px'}}>{firstReply.companyName.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{fontSize: '14px', fontWeight: 500}}>{firstReply.companyName}</div>
                    <div className="meta" style={{marginTop: '2px'}}>{firstReply.jobTitle} · {firstReply.appliedToEmail}</div>
                  </div>
                  {firstReply.replyCategory && (
                    <span className={chipClass(firstReply.replyCategory)}>
                      <span className="chip-dot live"></span>
                      {firstReply.replyCategory.toLowerCase()}
                    </span>
                  )}
                </div>
                <div className="row gap-2">
                  <button className="btn btn-ghost btn-sm">Move to Pipeline</button>
                  <button className="btn btn-ghost btn-sm">&#x22EF;</button>
                </div>
              </div>

              <div className="message-list" style={{flex: 1}}>
                {/* Sent message */}
                {firstReply.coverLetter && (
                  <div className="msg you">
                    <div className="msg-head">
                      <span className="msg-from">{firstReply.user.name || 'You'} · sent via Freelanly</span>
                      <span className="msg-time">{firstReply.sentAt ? firstReply.sentAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                    </div>
                    <div className="msg-body" dangerouslySetInnerHTML={{ __html: firstReply.coverLetter.replace(/\n/g, '<br/>') }} />
                  </div>
                )}

                {/* Reply */}
                <div className="msg them">
                  <div className="msg-head">
                    <span className="msg-from">{firstReply.companyName}</span>
                    <span className="msg-time">{firstReply.repliedAt ? firstReply.repliedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <div className="msg-body" dangerouslySetInnerHTML={{ __html: (firstReply.replyText || 'Reply received').replace(/\n/g, '<br/>') }} />
                </div>

                {firstReply.replySignal && (
                  <div style={{padding: '12px 16px', background: 'var(--acid-tint)', borderRadius: '10px', fontSize: '13px', color: 'var(--acid-deep)', marginBottom: '14px'}}>
                    <strong>AI Signal:</strong> {firstReply.replySignal}
                  </div>
                )}
              </div>

              <div className="reply-cta">
                <div className="note">
                  <b>Reply directly from your email.</b> This message is in your inbox at <span className="f-mono">{firstReply.user.email}</span> — reply there and Freelanly will track the thread automatically.
                </div>
                <a href={`mailto:${firstReply.appliedToEmail}?subject=Re: ${firstReply.subject || firstReply.jobTitle}`} className="btn btn-acid btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Reply
                </a>
              </div>
            </>
          ) : (
            <div style={{padding: '60px 24px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '14px'}}>
              Select a thread to view the conversation.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
