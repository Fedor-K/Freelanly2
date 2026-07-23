import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SalaryPrompt } from './SalaryPrompt';
import { GitHubPrompt } from './GitHubPrompt';
import { deriveCategorySlugs } from '@/lib/loop-routing';
import { redirect } from 'next/navigation';
import { ApplicationsTable } from '@/components/app/ApplicationsTable';
import { WelcomeOnboarding } from '@/components/app/WelcomeOnboarding';
import { DashboardQueue } from '@/components/app/DashboardQueue';
import { QueueUpgradeButton } from '@/components/app/QueueUpgradeButton';
import { ProfileBoostNudge } from '@/components/app/ProfileBoostNudge';
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
  if (!onboardCheck?.resumeUrl) redirect('/onboarding');

  const [user, today, yesterday, month, applications, repliesTodayCount, dailyActivity, loop] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, plan: true, telegramChatId: true, parsedProfile: true, salaryExpectation: true, githubUrl: true, videoIntroUrl: true, resumeUrl: true } }),
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
  ]);

  // Today's ready-queue: matcher-prepared applications (status REVIEW; letters draft on open/send since 07-23) from
  // the last 24h (they expire to FAILED after 24h, so this window IS "today"). PRO reviews & sends
  // them one click at a time; FREE sees a teaser with the count.
  // 48h (was 24h): the queue was starving the $5 teaser — only 4 of 55 FREE dashboard visitors had a
  // non-empty queue. Keep in sync with the worker's REVIEW expiry (auto-apply-processor.ts, 48h).
  const queueWindow = new Date(now.getTime() - 48 * 3600000);
  const [queueItems, queueCount, weeklyMatched] = await Promise.all([
    prisma.autoApplication.findMany({
      where: { userId, status: 'REVIEW', createdAt: { gte: queueWindow } },
      orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      select: { id: true, companyName: true, jobTitle: true, matchScore: true, status: true, createdAt: true, coverLetter: true, subject: true },
    }),
    prisma.autoApplication.count({ where: { userId, status: 'REVIEW', createdAt: { gte: queueWindow } } }),
    // Honest supply-check for the upgrade pitch: matcher-vetted matches over the last 7 days —
    // never sell the queue to a profile the matcher can't feed (thin-supply tail = refunds).
    prisma.autoApplication.count({ where: { userId, status: { in: ['REVIEW', 'SENT', 'OPENED', 'REPLIED'] }, createdAt: { gte: weekAgo } } }),
  ]);

  // Dev-titled? — gates the GitHub prompt (a GitHub link is only meaningful evidence for tech roles).
  const pp = user?.parsedProfile as Record<string, unknown> | null;
  const DEV_CATEGORIES = new Set(['engineering', 'devops', 'data', 'qa', 'security']);
  const isDev = deriveCategorySlugs({
    currentTitle: typeof pp?.current_title === 'string' ? pp.current_title : null,
    field: typeof pp?.field === 'string' ? pp.field : null,
    skills: Array.isArray(pp?.skills) ? (pp.skills as unknown[]).map(String) : [],
  }).some(s => DEV_CATEGORIES.has(s));

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
  // Résumé parsed to nothing usable → auto-apply silently sends nothing. Nudge to re-upload.
  const needsResumeReupload =
    ((profile?.skills as unknown[])?.length || 0) === 0 && ((profile?.languages as unknown[])?.length || 0) === 0;
  // Résumé FILE isn't actually stored — legacy "uploaded:<name>" placeholder (the ~1704
  // who uploaded before the Blob store existed). Profile works, but the PDF can't be
  // attached to applications/replies. Re-uploading stores it to Blob.
  const resumeFileMissing = !/\.public\.blob\.vercel-storage\.com\//.test(onboardCheck?.resumeUrl || '');
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
          : new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' });
        const model = p === 'zai' ? 'glm-4-32b-0414-128k' : 'glm-4-32b-0414-128k';
        const r = await client.chat.completions.create({
          model, temperature: 0.3, max_tokens: 80,
          messages: [
            { role: 'system', content: 'Write a 1-2 sentence summary of what kind of jobs this person will see matched. Be specific and encouraging. Address the user as "you". Example: "You\'ll see Senior React Developer and Full-Stack roles. Your 5 years with TypeScript and Node.js are a strong match for remote engineering positions."' },
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
    followUp: a.followUpSentAt ? 'sent' : null, // auto follow-ups killed 2026-07-11 — 'sent' kept for historical threads only
    replyCategory: a.replyCategory,
    matchScore: a.matchScore,
  }));

  return (
    <div className="page">

      {/* Résumé nudge — parse failure (stronger) takes priority over missing-file. */}
      {(needsResumeReupload || resumeFileMissing) && (
        <div style={{ margin: '0 0 16px', padding: '14px 18px', borderRadius: '12px', background: '#FEF3C7', border: '1px solid #FCD34D', color: '#78350F', fontSize: '14px', lineHeight: 1.5 }}>
          {needsResumeReupload ? (
            <><strong>We couldn&apos;t read your résumé.</strong> No skills or languages were detected, so we can&apos;t match you to roles or write your cover letters.{' '}
            <a href="/dashboard/settings#profile" style={{ color: '#92400E', fontWeight: 600, textDecoration: 'underline' }}>Re-upload your résumé (a text-based PDF) →</a></>
          ) : (
            <><strong>Your résumé file isn&apos;t saved.</strong> It was uploaded before a recent update and isn&apos;t stored with us — so we can&apos;t attach it to your applications or replies (recruiters ask for it constantly).{' '}
            <a href="/dashboard/settings#profile" style={{ color: '#92400E', fontWeight: 600, textDecoration: 'underline' }}>Re-upload your résumé so it attaches →</a></>
          )}
        </div>
      )}

      {/* Salary prompt — existing users who never stated a rate (inline step only catches new applicants). */}
      {!user?.salaryExpectation && <SalaryPrompt />}

      {/* GitHub prompt — dev-titled users without a GitHub link (feeds the verification report). */}
      {isDev && !user?.githubUrl && <GitHubPrompt />}

      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title">
          <h1>{greeting}, {firstName}.</h1>
          <p>
            {sentToday > 0
              ? <>{sentToday} {sentToday === 1 ? 'application' : 'applications'} sent today</>
              : <>Browse roles and apply — we pre-write every cover letter.</>}
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
          <div className="kpi-value tabular">{Math.min(sentToday, 20)} <span className="unit">/ 20</span></div>
          <div className="kpi-delta up">{Math.max(0, 20 - sentToday)} remaining</div>
        </div>
      </div>

      {/* Telegram connect banner */}
      {!user?.telegramChatId && (
        <div className="card mb-4" style={{background: 'linear-gradient(135deg, #E8F5E9, #F1F8E9)', borderColor: '#C8E6C9', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'}}>
          <div>
            <div style={{fontWeight: 600, fontSize: '14px'}}>🔔 Never miss an interview invite</div>
            <div style={{fontSize: '13px', color: '#555', marginTop: '2px'}}>Recruiters move fast — get a Telegram ping the second one wants to interview you, so a hot lead doesn&apos;t go cold in your inbox.</div>
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
            <h1>We&apos;re lining up your first matches.</h1>
            <p className="sub">Freelanly is scanning fresh postings against your profile and pre-writing applications for the strongest matches. Open Discovery in a few minutes — review and send in one click.</p>
            <div className="welcome-ai">
              <span className="ai-label">AI &middot; matched from your r&eacute;sum&eacute;</span>
              {aiProfileSummary || `You'll see ${loopTitles.slice(0, 3).join(' and ') || 'matching'} roles matched to your resume and experience.`}
            </div>
          </header>
          <div className="welcome-stats">
            <div className="welcome-stat">
              <div className="label">New opportunities today</div>
              <div className="value">{matchingCount || '—'}</div>
              <div className="hint"><span className="live">scanning &middot; live</span></div>
            </div>
            <div className="welcome-stat">
              <div className="label">Applications / day</div>
              <div className="value">20</div>
              <div className="hint">daily cap &middot; all accounts</div>
            </div>
            <div className="welcome-stat">
              <div className="label">Replies land best from</div>
              <div className="value">Gmail</div>
              <div className="hint">connect yours in one click</div>
            </div>
          </div>
          <div className="welcome-foot">
            <div className="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span><b>First drafts ready within 30 minutes.</b> Review and send in one click — we&apos;ll route every reply to your inbox so nothing slips.</span>
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

      {/* Profile boost: video intro (everyone with a résumé) + GitHub (engineers only) — the two
          artifacts that turn a résumé into a sellable candidate. Shown only when missing. */}
      {user?.resumeUrl && (
        <ProfileBoostNudge askGithub={isDev && !user.githubUrl} />
      )}

      {/* Today's ready-queue: PRO gets the full review-and-send list; FREE sees an honest teaser. */}
      {queueCount > 0 && (user?.plan === 'PRO' ? (
        <div className="mb-4">
          <DashboardQueue
            items={queueItems.map(q => ({
              id: q.id, companyName: q.companyName, jobTitle: q.jobTitle, matchScore: q.matchScore,
              status: q.status, createdAt: q.createdAt.toISOString(), coverLetter: q.coverLetter || '', subject: q.subject || '',
            }))}
            pendingCount={queueCount}
            sentToday={sentToday}
          />
        </div>
      ) : (
        <div className="card mb-4">
          <div className="card-head">
            <div className="row gap-3">
              <h3>Today&apos;s queue</h3>
              <span className="chip chip-acid-soft">PRO</span>
            </div>
            <span className="meta">{queueCount} ready to send</span>
          </div>
          <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: '540px' }}>
              <strong>{queueCount} application{queueCount === 1 ? '' : 's'} queued</strong> for your top matches —
              personalized letter drafted the moment you open one. Upgrade to open the queue and send each one in one click.
              <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--ink-4)' }}>
                Your profile matched {weeklyMatched} role{weeklyMatched === 1 ? '' : 's'} in the last 7 days.
              </div>
            </div>
            <QueueUpgradeButton />
          </div>
        </div>
      ))}

      {/* Applications table — full width */}
      <div className="card mb-4">
        <div className="card-head">
          <h3>Applications</h3>
          <span className="meta">{mSent} sent · {mReplied} replied · last 30 days</span>
        </div>
        <ApplicationsTable
          rows={appRows}
          sentToday={loop?.sentToday || 0}
          dailyLimit={20}
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
