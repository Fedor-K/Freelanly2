import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ApplicationsTable } from '@/components/app/ApplicationsTable';
import './dashboard-design.css';

export const metadata: Metadata = {
  title: 'Dashboard — Freelanly',
};

export const revalidate = 60;

// unused: timeAgo, COLORS (replies sidebar removed)

export default async function DashboardOverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const [user, today, yesterday, month, applications, replies, followUps, dailyActivity, loop] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, plan: true } }),
    prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId, sentAt: { gte: todayStart } },
      _count: true,
    }),
    prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId, sentAt: { gte: yesterdayStart, lt: todayStart } },
      _count: true,
    }),
    prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId, createdAt: { gte: monthAgo } },
      _count: true,
    }),
    // All recent applications (last 30 days) — the main table
    prisma.autoApplication.findMany({
      where: { userId, createdAt: { gte: monthAgo } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, companyName: true, jobTitle: true, status: true, subject: true,
        sentAt: true, createdAt: true, followUpSentAt: true, followUpCount: true,
        replyCategory: true, repliedAt: true, matchScore: true,
      },
    }),
    prisma.autoApplication.findMany({
      where: { userId, status: { in: ['REPLIED', 'INTERVIEW'] }, repliedAt: { not: null } },
      orderBy: { repliedAt: 'desc' },
      take: 5,
      select: { id: true, companyName: true, jobTitle: true, replyText: true, replyCategory: true, repliedAt: true, subject: true },
    }),
    prisma.autoApplication.count({
      where: { userId, followUpSentAt: { gte: weekAgo }, followUpCount: { gt: 0 } },
    }),
    prisma.$queryRaw<Array<{ day: Date; cnt: bigint }>>`
      SELECT DATE("sentAt") as day, COUNT(*) as cnt
      FROM "AutoApplication"
      WHERE "userId" = ${userId} AND "sentAt" >= ${twoWeeksAgo}
      GROUP BY DATE("sentAt")
      ORDER BY day ASC
    `,
    prisma.autoApplyLoop.findFirst({
      where: { userId },
      select: { isActive: true, sentToday: true, dailyLimit: true },
    }),
  ]);

  const countByStatus = (groups: Array<{ status: string; _count: number }>, ...statuses: string[]) =>
    groups.filter(g => statuses.includes(g.status)).reduce((sum, g) => sum + g._count, 0);

  const sentToday = countByStatus(today, 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const sentYesterday = countByStatus(yesterday, 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const repliesToday = countByStatus(today, 'REPLIED', 'INTERVIEW', 'OFFER');
  const openedToday = countByStatus(today, 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');

  const replyRate = sentToday > 0 ? (repliesToday / sentToday * 100).toFixed(1) : '0';
  const openRate = sentToday > 0 ? (openedToday / sentToday * 100).toFixed(1) : '0';

  const sentDelta = sentYesterday > 0 ? Math.round((sentToday - sentYesterday) / sentYesterday * 100) : 0;

  // 30-day funnel
  const mSent = countByStatus(month, 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const mOpened = countByStatus(month, 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
  const mReplied = countByStatus(month, 'REPLIED', 'INTERVIEW', 'OFFER');
  const mInterview = countByStatus(month, 'INTERVIEW', 'OFFER');
  const mOffer = countByStatus(month, 'OFFER');

  // Daily bars
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

  const dateLabel = (daysAgo: number) => {
    const d = new Date(now.getTime() - daysAgo * 86400000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Serialize applications for client component
  const appRows = applications.map(a => ({
    id: a.id,
    jobTitle: a.jobTitle,
    companyName: a.companyName,
    status: a.status,
    subject: a.subject,
    date: (a.sentAt || a.createdAt).toISOString(),
    followUp: a.followUpSentAt ? 'sent' : (a.sentAt && !a.followUpSentAt && ['SENT', 'DELIVERED', 'OPENED'].includes(a.status) ? (() => { const days = Math.floor((now.getTime() - a.sentAt!.getTime()) / 86400000); return days >= 3 ? null : `in ${3 - days}d`; })() : null),
    replyCategory: a.replyCategory,
    matchScore: a.matchScore,
  }));

  return (
    <div className="page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title">
          <h1>{greeting}, {firstName}.</h1>
          <p>
            {loop?.isActive ? (
              <><span className="chip chip-acid-soft" style={{marginRight: '8px'}}><span className="chip-dot live"></span>Auto-apply running</span> {loop.sentToday}/{loop.dailyLimit} sent today</>
            ) : (
              <span className="chip" style={{marginRight: '8px'}}>Auto-apply paused</span>
            )}
            {replies.length > 0 && <> · {replies.length} new {replies.length === 1 ? 'reply' : 'replies'}</>}
          </p>
        </div>
        <div className="page-actions">
          <a href="/dashboard/discovery" className="btn btn-acid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Browse gigs
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid mb-4">
        <div className="kpi">
          <div className="kpi-label">Sent today</div>
          <div className="kpi-value tabular">{sentToday}</div>
          <div className={`kpi-delta ${sentDelta >= 0 ? 'up' : 'down'}`}>{sentYesterday > 0 ? `${sentDelta >= 0 ? '↑' : '↓'} ${Math.abs(sentDelta)}% vs yesterday` : `${sentYesterday} yesterday`}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Replies today</div>
          <div className="kpi-value tabular">{repliesToday} <span className="unit">/ {replyRate}%</span></div>
          <div className="kpi-delta">{mReplied} total this month</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Opened today</div>
          <div className="kpi-value tabular">{openedToday} <span className="unit">/ {openRate}%</span></div>
          <div className="kpi-delta">{mOpened} total this month</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Daily limit</div>
          <div className="kpi-value tabular">{loop?.sentToday || 0} <span className="unit">/ {loop?.dailyLimit || 10}</span></div>
          <div className="kpi-delta up">{(loop?.dailyLimit || 10) - (loop?.sentToday || 0)} remaining</div>
        </div>
      </div>

      {/* Applications table — full width */}
      <div className="card mb-4">
        <div className="card-head">
          <h3>Applications</h3>
          <span className="meta">{mSent} sent · {mReplied} replied · last 30 days</span>
        </div>
        <ApplicationsTable
          rows={appRows}
          sentToday={loop?.sentToday || 0}
          dailyLimit={loop?.dailyLimit || 10}
          isPro={user?.plan === 'PRO'}
        />
      </div>

      {/* Activity + Funnel side by side */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>

        {/* Activity chart */}
        <div className="card card-pad">
          <div className="section-head">
            <h2>Activity, last 14 days</h2>
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
            <span className="muted f-mono" style={{fontSize: '11px'}}>{mSent > 0 ? `${(mReplied / mSent * 100).toFixed(1)}%` : '0%'} reply rate</span>
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
    </div>
  );
}
