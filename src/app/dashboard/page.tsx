import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { DashboardQueue } from '@/components/app/DashboardQueue';
import './dashboard-design.css';

export const metadata: Metadata = {
  title: 'Dashboard — Freelanly',
};

export const revalidate = 60;

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

export default async function DashboardOverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [user, thisWeek, lastWeek, month, pending, replies, followUps, dailyActivity] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    // This week stats
    prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId, sentAt: { gte: weekAgo } },
      _count: true,
    }),
    // Last week stats (for delta)
    prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId, sentAt: { gte: twoWeeksAgo, lt: weekAgo } },
      _count: true,
    }),
    // 30-day funnel
    prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId, createdAt: { gte: monthAgo } },
      _count: true,
    }),
    // Pending queue (today)
    prisma.autoApplication.findMany({
      where: { userId, status: { in: ['PENDING', 'REVIEW', 'SENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, companyName: true, jobTitle: true, matchScore: true, status: true, createdAt: true, coverLetter: true, subject: true },
    }),
    // Recent replies
    prisma.autoApplication.findMany({
      where: { userId, status: 'REPLIED', repliedAt: { not: null } },
      orderBy: { repliedAt: 'desc' },
      take: 5,
      select: { id: true, companyName: true, jobTitle: true, replyText: true, replyCategory: true, repliedAt: true, subject: true },
    }),
    // Follow-ups this week
    prisma.autoApplication.count({
      where: { userId, followUpSentAt: { gte: weekAgo }, followUpCount: { gt: 0 } },
    }),
    // Daily activity last 14 days
    prisma.$queryRaw<Array<{ day: Date; cnt: bigint }>>`
      SELECT DATE("sentAt") as day, COUNT(*) as cnt
      FROM "AutoApplication"
      WHERE "userId" = ${userId} AND "sentAt" >= ${twoWeeksAgo}
      GROUP BY DATE("sentAt")
      ORDER BY day ASC
    `,
  ]);

  // Parse stats
  const countByStatus = (groups: Array<{ status: string; _count: number }>, ...statuses: string[]) =>
    groups.filter(g => statuses.includes(g.status)).reduce((sum, g) => sum + g._count, 0);

  const sentThisWeek = countByStatus(thisWeek, 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const sentLastWeek = countByStatus(lastWeek, 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const repliesThisWeek = countByStatus(thisWeek, 'REPLIED', 'INTERVIEW', 'OFFER');
  const repliesLastWeek = countByStatus(lastWeek, 'REPLIED', 'INTERVIEW', 'OFFER');
  const openedThisWeek = countByStatus(thisWeek, 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const openedLastWeek = countByStatus(lastWeek, 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');

  const replyRate = sentThisWeek > 0 ? (repliesThisWeek / sentThisWeek * 100).toFixed(1) : '0';
  const openRate = sentThisWeek > 0 ? (openedThisWeek / sentThisWeek * 100).toFixed(1) : '0';
  const lastReplyRate = sentLastWeek > 0 ? (repliesLastWeek / sentLastWeek * 100) : 0;
  const lastOpenRate = sentLastWeek > 0 ? (openedLastWeek / sentLastWeek * 100) : 0;

  const sentDelta = sentLastWeek > 0 ? Math.round((sentThisWeek - sentLastWeek) / sentLastWeek * 100) : 0;
  const replyDelta = sentLastWeek > 0 ? (repliesThisWeek / sentThisWeek * 100 - lastReplyRate).toFixed(1) : '0';
  const openDelta = sentLastWeek > 0 ? (openedThisWeek / sentThisWeek * 100 - lastOpenRate).toFixed(1) : '0';

  // 30-day funnel
  const mSent = countByStatus(month, 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const mOpened = countByStatus(month, 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const mReplied = countByStatus(month, 'REPLIED', 'INTERVIEW', 'OFFER');
  const mInterview = countByStatus(month, 'INTERVIEW', 'OFFER');
  const mOffer = countByStatus(month, 'OFFER');

  // Daily bars for sparkline
  const dailyMap = new Map<string, number>();
  for (const row of dailyActivity) {
    dailyMap.set(new Date(row.day).toISOString().slice(0, 10), Number(row.cnt));
  }
  const activityBars: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    activityBars.push(dailyMap.get(d) || 0);
  }
  const maxBar = Math.max(...activityBars, 1);

  // Date labels for activity
  const dateLabel = (daysAgo: number) => {
    const d = new Date(now.getTime() - daysAgo * 86400000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const pendingCount = await prisma.autoApplication.count({
    where: { userId, status: { in: ['PENDING', 'REVIEW', 'SENDING'] } },
  });
  const sentToday = await prisma.autoApplication.count({
    where: { userId, sentAt: { gte: todayStart }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } },
  });

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title">
          <h1>{greeting}, {firstName}.</h1>
          <p>It&apos;s {dayName} — {pendingCount} applications queued. {replies.length > 0 ? `${replies.length} new repl${replies.length === 1 ? 'y' : 'ies'} waiting.` : 'No new replies yet.'}</p>
        </div>
        <div className="page-actions">
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
          <div className="kpi-value tabular">{sentThisWeek}</div>
          <div className={`kpi-delta ${sentDelta >= 0 ? 'up' : 'down'}`}>{sentDelta >= 0 ? '↑' : '↓'} {Math.abs(sentDelta)}% vs last week</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Replies</div>
          <div className="kpi-value tabular">{repliesThisWeek} <span className="unit">/ {replyRate}%</span></div>
          <div className={`kpi-delta ${Number(replyDelta) >= 0 ? 'up' : 'down'}`}>{Number(replyDelta) >= 0 ? '↑' : '↓'} {Math.abs(Number(replyDelta))}pp vs last week</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Opened</div>
          <div className="kpi-value tabular">{openedThisWeek} <span className="unit">/ {openRate}%</span></div>
          <div className={`kpi-delta ${Number(openDelta) >= 0 ? 'up' : 'down'}`}>{Number(openDelta) >= 0 ? '↑' : '↓'} {Math.abs(Number(openDelta))}pp vs last week</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Follow-ups sent</div>
          <div className="kpi-value tabular">{followUps}</div>
          <div className="kpi-delta up">this week</div>
        </div>
      </div>

      <div className="dash-grid">

        {/* LEFT COL */}
        <div className="col gap-4">

          {/* Today's queue */}
          <DashboardQueue
            items={pending.map(app => ({
              id: app.id,
              companyName: app.companyName,
              jobTitle: app.jobTitle,
              matchScore: app.matchScore,
              status: app.status,
              createdAt: app.createdAt.toISOString(),
              coverLetter: app.coverLetter,
              subject: app.subject,
            }))}
            pendingCount={pendingCount}
            sentToday={sentToday}
          />

          {/* Activity, last 14 days */}
          <div className="card card-pad">
            <div className="section-head">
              <div className="row gap-3">
                <h2>Activity, last 14 days</h2>
                <span className="chip"><span className="chip-dot" style={{background: 'var(--acid-deep)'}}></span>Applications</span>
              </div>
            </div>
            <div className="spark-strip mt-3">
              {activityBars.map((v, i) => (
                <div key={i} className="bar" style={{height: `${(v / maxBar) * 100}%`, opacity: i === activityBars.length - 1 ? 1 : 0.85}} title={`${v} sent`}></div>
              ))}
            </div>
            <div className="row mt-3" style={{justifyContent: 'space-between', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', color: 'var(--ink-4)', letterSpacing: '0.04em'}}>
              <span>{dateLabel(13)}</span><span>{dateLabel(10)}</span><span>{dateLabel(7)}</span><span>{dateLabel(3)}</span><span>Today</span>
            </div>
          </div>

          {/* Funnel */}
          <div className="card card-pad">
            <div className="section-head">
              <h2>Funnel · last 30 days</h2>
              <span className="muted f-mono" style={{fontSize: '11px'}}>{mSent > 0 ? `${(mOffer / mSent * 100).toFixed(1)}%` : '0%'} sent → offer</span>
            </div>
            {[
              { label: 'Sent', count: mSent, pct: 100, bg: 'var(--ink)', textColor: '#fff', dotColor: 'var(--s-sent)' },
              { label: 'Opened', count: mOpened, pct: mSent > 0 ? Math.round(mOpened / mSent * 100) : 0, bg: '#DCE9FE', textColor: 'var(--info)', dotColor: 'var(--s-opened)' },
              { label: 'Replied', count: mReplied, pct: mSent > 0 ? Math.round(mReplied / mSent * 100) : 0, bg: 'var(--acid)', textColor: '#000', dotColor: 'var(--s-replied)' },
              { label: 'Interview', count: mInterview, pct: mSent > 0 ? Math.round(mInterview / mSent * 100) : 0, bg: '#D8C7F9', textColor: 'var(--s-booked)', dotColor: 'var(--s-booked)' },
              { label: 'Offer', count: mOffer, pct: mSent > 0 ? Math.round(mOffer / mSent * 100) : 0, bg: '#BBF7D0', textColor: 'var(--s-offer)', dotColor: 'var(--s-offer)' },
            ].map(f => (
              <div key={f.label} className="funnel-row">
                <div className="name"><span className="chip-dot" style={{background: f.dotColor, width:'8px', height:'8px'}}></span>{f.label}</div>
                <div className="bar"><div className="fill" style={{width: `${Math.max(f.pct, 2)}%`, background: f.bg}}><span style={{color: f.textColor}}>{f.count}</span></div></div>
                <div className="pct">{f.pct}%</div>
              </div>
            ))}
          </div>

        </div>

        {/* RIGHT COL */}
        <div className="col gap-4">

          {/* New replies */}
          <div className="card">
            <div className="card-head">
              <h3>New replies</h3>
              <a href="/dashboard/auto-apply?tab=inbox" className="muted f-mono" style={{fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase'}}>Inbox →</a>
            </div>
            {replies.length === 0 ? (
              <div style={{padding: '24px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>No replies yet. Keep sending!</div>
            ) : replies.map((r, i) => (
              <a key={r.id} href="/dashboard/auto-apply?tab=inbox" className="reply-row">
                <div className="avatar av-sm" style={{background: COLORS[i % COLORS.length]}}>{r.companyName.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="row between">
                    <span className="name">{r.companyName}</span>
                    {r.replyCategory && <span className="chip chip-acid-soft" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>{r.replyCategory.toLowerCase()}</span>}
                  </div>
                  <div className="preview"><b>Re: {r.jobTitle}</b> — {r.replyText?.slice(0, 80) || 'Reply received'}{(r.replyText?.length || 0) > 80 ? '…' : ''}</div>
                </div>
                <span className="time">{r.repliedAt ? timeAgo(r.repliedAt) : ''}</span>
              </a>
            ))}
          </div>

          {/* Stats summary */}
          <div className="card card-pad" style={{background: 'linear-gradient(180deg, #FCFBEE, #FFFFFF)', borderColor: 'rgba(199,249,74,0.4)'}}>
            <div className="row gap-2 mb-2">
              <span className="chip chip-acid">★ SUMMARY</span>
              <span className="eyebrow">All time</span>
            </div>
            <div style={{fontSize: '14.5px', lineHeight: 1.5, color: 'var(--ink)', letterSpacing: '-0.005em'}}>
              You&apos;ve sent <b>{mSent}</b> applications in the last 30 days{mReplied > 0 ? <> and received <b style={{color: 'var(--acid-deep)'}}>{mReplied} replies</b> ({mSent > 0 ? (mReplied / mSent * 100).toFixed(1) : 0}% rate)</> : null}. {mInterview > 0 ? <><b>{mInterview}</b> led to interviews.</> : 'Keep going!'}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
