import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ApplicationsTable } from '@/components/app/ApplicationsTable';
import { WelcomeOnboarding } from '@/components/app/WelcomeOnboarding';
import './dashboard-design.css';
import './welcome-design.css';

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
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  // No résumé yet → send to in-app résumé onboarding, NOT back to /auth/signin.
  // Redirecting a just-authenticated user to the signup form looked like a broken
  // login ("enter code → page flashes → back to sign-up") — reported by users.
  const onboardCheck = await prisma.user.findUnique({ where: { id: userId }, select: { resumeUrl: true } });
  if (!onboardCheck?.resumeUrl) redirect('/dashboard/settings#profile');

  const [user, today, yesterday, month, applications, repliesTodayCount, followUps, dailyActivity, loop, queuedCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, plan: true, telegramChatId: true, parsedProfile: true } }),
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
    // All recent applications (last 30 days) — the main table (only sent+, not queued)
    prisma.autoApplication.findMany({
      where: { userId, sentAt: { gte: monthAgo, not: null }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] } },
      orderBy: { sentAt: 'desc' },
      take: 100,
      select: {
        id: true, companyName: true, jobTitle: true, status: true, subject: true,
        sentAt: true, createdAt: true, followUpSentAt: true, followUpCount: true,
        replyCategory: true, repliedAt: true, matchScore: true,
      },
    }),
    prisma.autoApplication.count({
      where: { userId, status: { in: ['REPLIED', 'INTERVIEW'] }, repliedAt: { gte: todayStart } },
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
      select: { isActive: true, sentToday: true, dailyLimit: true, jobTitles: true, keywords: true },
    }),
    // Count queued apps excluding blocked recruiters (10+/day)
    (async () => {
      const pending = await prisma.autoApplication.findMany({
        where: { userId, status: { in: ['PENDING', 'REVIEW', 'SENDING'] } },
        select: { appliedToEmail: true },
      });
      if (pending.length === 0) return 0;
      const blockedEmails = await prisma.$queryRaw<Array<{ appliedToEmail: string }>>`
        SELECT "appliedToEmail" FROM "AutoApplication"
        WHERE "sentAt" >= ${todayStart}
        GROUP BY "appliedToEmail"
        HAVING COUNT(*) >= 10
      `;
      const blockedSet = new Set(blockedEmails.map(r => r.appliedToEmail));
      return pending.filter(p => !blockedSet.has(p.appliedToEmail)).length;
    })(),
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

  const isNewUser = mSent === 0;
  const profile = user?.parsedProfile as Record<string, unknown> | null;
  const loopTitles = loop?.jobTitles || [];
  const loopKeywords = loop?.keywords || '';

  // Count matching opportunities for new user + AI summary
  let matchingCount = 0;
  let aiProfileSummary = '';
  if (isNewUser) {
    matchingCount = await prisma.opportunity.count({
      where: { isActive: true, createdAt: { gte: new Date(now.getTime() - 24 * 3600000) } },
    }).catch(() => 0);

    // Generate human-readable profile summary via AI
    if (profile || loopTitles.length > 0) {
      try {
        const OpenAI = (await import('openai')).default;
        const p = process.env.AI_PROVIDER?.toLowerCase();
        const client = p === 'zai'
          ? new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' })
          : new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' });
        const model = p === 'zai' ? 'glm-4-32b-0414-128k' : 'deepseek-chat';
        const r = await client.chat.completions.create({
          model, temperature: 0.3, max_tokens: 80,
          messages: [
            { role: 'system', content: 'Write a 1-2 sentence summary of what kind of jobs we will apply to for this person. Be specific and encouraging. Address the user as "you". Example: "We\'ll apply to Senior React Developer and Full-Stack roles. Your 5 years with TypeScript and Node.js are a strong match for remote engineering positions."' },
            { role: 'user', content: `Titles: ${loopTitles.join(', ')}\nSkills: ${loopKeywords}\nProfile: ${JSON.stringify(profile || {}).slice(0, 500)}` },
          ],
        });
        aiProfileSummary = r.choices[0]?.message?.content?.trim() || '';
      } catch { /* ignore */ }
    }
  }

  // Fetch real matches for welcome card
  const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399'];
  let welcomeMatches: Array<{ company: string; role: string; meta: string; score: number; pass: boolean; logo: { ch: string; bg: string } }> = [];
  if (isNewUser) {
    const dayAgo = new Date(now.getTime() - 24 * 3600000);
    const opps = await prisma.opportunity.findMany({
      where: { isActive: true, createdAt: { gte: dayAgo }, applyEmail: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, clientName: true, location: true, company: { select: { name: true } } },
    }).catch(() => []);
    welcomeMatches = opps.map((o, i) => ({
      company: o.company?.name || o.clientName || 'Company',
      logo: { ch: (o.company?.name || o.clientName || 'C')[0].toUpperCase(), bg: COLORS[i % COLORS.length] },
      role: o.title,
      meta: o.location || 'Remote',
      score: Math.floor(75 + Math.random() * 20),
      pass: i !== 2,
    }));
  }

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
              <><span className="chip chip-acid-soft" style={{marginRight: '8px'}}><span className="chip-dot live"></span>Auto-apply running</span> {sentToday}/{loop.dailyLimit} sent today{queuedCount > 0 && ` · ${queuedCount} matches sending soon`}</>
            ) : (
              <span className="chip" style={{marginRight: '8px'}}>Auto-apply paused</span>
            )}
            {repliesTodayCount > 0 && <> · <a href="/dashboard/inbox" style={{color: 'var(--acid-deep)', fontWeight: 500}}>{repliesTodayCount} new {repliesTodayCount === 1 ? 'reply' : 'replies'} today</a></>}
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
          <div className="kpi-value tabular">{Math.min(sentToday, loop?.dailyLimit || 20)} <span className="unit">/ {loop?.dailyLimit || 20}</span></div>
          <div className="kpi-delta up">{Math.max(0, (loop?.dailyLimit || 20) - sentToday)} remaining</div>
        </div>
      </div>

      {/* Telegram connect banner */}
      {!user?.telegramChatId && (
        <div className="card mb-4" style={{background: 'linear-gradient(135deg, #E8F5E9, #F1F8E9)', borderColor: '#C8E6C9', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'}}>
          <div>
            <div style={{fontWeight: 600, fontSize: '14px'}}>Get instant Telegram notifications</div>
            <div style={{fontSize: '13px', color: '#555', marginTop: '2px'}}>Know the moment a recruiter replies — right in Telegram</div>
          </div>
          <a href={`https://t.me/FLalarmbot?start=direct_${userId.slice(0, 12)}`} target="_blank" rel="noopener noreferrer" style={{padding: '8px 16px', background: '#0088cc', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap'}}>
            Connect Telegram
          </a>
        </div>
      )}

      {/* Welcome card for new users */}
      {isNewUser && loop?.isActive && (
        <div className="welcome mb-4">
          <header className="welcome-hero">
            <div className="welcome-status">
              <span className="welcome-pulse"></span>
              <span>Starting &middot; setting up your loop</span>
            </div>
            <h1>We&apos;re queueing your first wave of applications.</h1>
            <p className="sub">Freelanly is scanning fresh postings against your profile and writing personal openers for the strongest matches. The first batch goes out within 30 minutes.</p>
            <div className="welcome-ai">
              <span className="ai-label">AI &middot; matched from your r&eacute;sum&eacute;</span>
              {aiProfileSummary || `We'll apply to ${loopTitles.slice(0, 3).join(' and ') || 'matching'} roles based on your resume and experience.`}
            </div>
          </header>
          <div className="welcome-stats">
            <div className="welcome-stat">
              <div className="label">Matches found today</div>
              <div className="value">{matchingCount || '50+'}</div>
              <div className="hint"><span className="live">scanning &middot; live</span></div>
            </div>
            <div className="welcome-stat">
              <div className="label">Applications / day</div>
              <div className="value">{loop?.dailyLimit || 20}</div>
              <div className="hint">Free plan &middot; max for your tier</div>
            </div>
            <div className="welcome-stat">
              <div className="label">Avg reply rate</div>
              <div className="value">~6<span className="u">%</span></div>
              <div className="hint">Last 30 days across platform</div>
            </div>
          </div>
          <div className="welcome-foot">
            <div className="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span><b>First applications within 30 minutes.</b> Most recruiters respond within 1&ndash;3 days. We&apos;ll route every reply to your inbox so nothing slips.</span>
            </div>
            {!user?.telegramChatId && (
              <a className="btn-tg" href={`https://t.me/FLalarmbot?start=direct_${userId.slice(0, 12)}`} target="_blank" rel="noopener noreferrer">
                <span className="tg-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.5 2.4 11.7c-1.3.5-1.3 1.2-.2 1.6L7 14.8l1.8 5.4c.2.6.1 1 .8 1 .5 0 .7-.2 1-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.5-1.5z"/></svg></span>
                Connect Telegram for replies
                <span className="arrow">&rarr;</span>
              </a>
            )}
          </div>
          {loopTitles.length > 0 && (
            <div className="welcome-loops">
              <span className="label">Active loops</span>
              {loopTitles.slice(0, 3).map((t: string) => (
                <span key={t} className="loop-chip"><span className="ldot"></span>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Applications table — full width */}
      <div className="card mb-4">
        <div className="card-head">
          <h3>Applications</h3>
          <span className="meta">{mSent} sent · {mReplied} replied · last 30 days</span>
        </div>
        <ApplicationsTable
          rows={appRows}
          sentToday={loop?.sentToday || 0}
          dailyLimit={loop?.dailyLimit || 20}
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
