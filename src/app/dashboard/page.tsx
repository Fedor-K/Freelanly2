import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GitHubPrompt } from './GitHubPrompt';
import { deriveCategorySlugs } from '@/lib/loop-routing';
import { redirect } from 'next/navigation';
import { ApplicationsTable } from '@/components/app/ApplicationsTable';
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
  if (!onboardCheck?.resumeUrl) redirect('/auth/signin');

  const [user, today, yesterday, month, applications, repliesTodayCount, dailyActivity, loop] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, plan: true, telegramChatId: true, parsedProfile: true, salaryExpectation: true, githubUrl: true, videoIntroUrl: true, resumeUrl: true, gmailAuth: { select: { verified: true } }, userSmtp: { select: { verified: true } } } }),
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
      select: { id: true, companyName: true, jobTitle: true, matchScore: true, status: true, createdAt: true, coverLetter: true, subject: true, opportunityId: true },
    }),
    prisma.autoApplication.count({ where: { userId, status: 'REVIEW', createdAt: { gte: queueWindow } } }),
    // Honest supply-check for the upgrade pitch: matcher-vetted matches over the last 7 days —
    // never sell the queue to a profile the matcher can't feed (thin-supply tail = refunds).
    prisma.autoApplication.count({ where: { userId, status: { in: ['REVIEW', 'SENT', 'OPENED', 'REPLIED'] }, createdAt: { gte: weekAgo } } }),
  ]);

  // Job descriptions + original-posting links for the queue rows. The queue previously showed only
  // "title · company" (Rahul: "unable to see JD in queue" → couldn't judge → left 27 to expire). Fetch
  // the ≤8 queued opportunities' description/link/location so each row can show what the job actually is.
  const queueOppIds = queueItems.map((q) => q.opportunityId).filter((x): x is string => !!x);
  const queueOpps = queueOppIds.length
    ? await prisma.opportunity.findMany({ where: { id: { in: queueOppIds } }, select: { id: true, description: true, applyUrl: true, sourceUrl: true, location: true } })
    : [];
  const queueOppMap = new Map(queueOpps.map((o) => [o.id, o]));

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

  const replyRate = sentToday > 0 ? (repliesToday / sentToday * 100).toFixed(1) : '0';
  // openRate/openedToday removed — opens untracked (no live pixel), owner call 2026-07-30 to hide globally.

  // Sends via the user's OWN inbox (Gmail/SMTP) → recruiter replies land in THEIR inbox, never touch
  // our reply+ address, so we track zero reply/interview/offer data. Showing "Replies today", reply
  // rate, or a "we'll ping you about interview invites" promise would be a lie for these users — hide
  // every reply-derived surface for them. (Postal senders reply through us and stay tracked.)
  const ownInbox = !!user?.gmailAuth?.verified || !!user?.userSmtp?.verified;

  // Opens are ALSO untracked on the live send path — the tracking pixel only ever lived in the dead
  // auto-apply worker; quick-apply (every current SELF send) injects none. So "Opened" is legacy noise,
  // and for own-inbox Gmail sends it'd be Google-image-proxy noise anyway. For own-inbox we drop Opens
  // too and show a real volume number instead. (sentThisWeek reuses the daily-activity rows already
  // fetched — no extra query.)
  const sentThisWeek = dailyActivity.filter(r => new Date(r.day) >= weekAgo).reduce((s, r) => s + Number(r.cnt), 0);

  const sentDelta = sentYesterday > 0 ? Math.round((sentToday - sentYesterday) / sentYesterday * 100) : 0;

  // 30-day funnel
  const mSent = countByStatus(month, 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER');
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

  const profile = user?.parsedProfile as Record<string, unknown> | null;
  // Résumé parsed to nothing usable → auto-apply silently sends nothing. Nudge to re-upload.
  const needsResumeReupload =
    ((profile?.skills as unknown[])?.length || 0) === 0 && ((profile?.languages as unknown[])?.length || 0) === 0;
  // Résumé FILE isn't actually stored — legacy "uploaded:<name>" placeholder (the ~1704
  // who uploaded before the Blob store existed). Profile works, but the PDF can't be
  // attached to applications/replies. Re-uploading stores it to Blob.
  const resumeFileMissing = !/\.public\.blob\.vercel-storage\.com\//.test(onboardCheck?.resumeUrl || '');

  // (New-user welcome-card compute removed with the card — it made an LLM call + extra queries on
  // every new-user dashboard load, all to feed an overpromising card.)

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

      {/* KPIs — volume + (Postal only) replies. No "Daily limit" card: the cap still runs server-side
          but the owner asked to keep it out of the UI (2026-07-30). Opens dropped globally (untracked). */}
      <div className="kpi-grid mb-4">
        <div className="kpi">
          <div className="kpi-label">Sent today</div>
          <div className="kpi-value tabular">{sentToday}</div>
          <div className={`kpi-delta ${sentDelta >= 0 ? 'up' : 'down'}`}>{sentYesterday > 0 ? `${sentDelta >= 0 ? '↑' : '↓'} ${Math.abs(sentDelta)}% vs yesterday` : `${sentYesterday} yesterday`}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sent this week</div>
          <div className="kpi-value tabular">{sentThisWeek}</div>
          <div className="kpi-delta">last 7 days</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sent this month</div>
          <div className="kpi-value tabular">{mSent}</div>
          <div className="kpi-delta">last 30 days</div>
        </div>
        {/* Replies only for Postal senders — own-inbox replies land in the user's own inbox, untracked. */}
        {!ownInbox && (
          <div className="kpi">
            <div className="kpi-label">Replies today</div>
            <div className="kpi-value tabular">{repliesToday} <span className="unit">/ {replyRate}%</span></div>
            <div className="kpi-delta">{mReplied} total this month</div>
          </div>
        )}
      </div>

      {/* Telegram connect banner — only for Postal senders; own-inbox replies never reach us, so we
          can't ping them about an interview invite we never see. */}
      {!user?.telegramChatId && !ownInbox && (
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

      {/* Welcome card for new users removed 2026-07-30 (owner) — it overpromised (AI-hallucinated
          "excellent matches for Principal Engineer in fintech" from the résumé alone, plus stale
          "pre-writing applications" copy). */}

      {/* Profile boost: video intro (everyone with a résumé) + GitHub (engineers only) — the two
          artifacts that turn a résumé into a sellable candidate. Shown only when missing. */}
      {user?.resumeUrl && (
        <ProfileBoostNudge askGithub={isDev && !user.githubUrl} />
      )}

      {/* Today's ready-queue: PRO gets the full review-and-send list; FREE sees an honest teaser. */}
      {queueCount > 0 && (user?.plan === 'PRO' ? (
        <div className="mb-4">
          <DashboardQueue
            items={queueItems.map(q => {
              const opp = q.opportunityId ? queueOppMap.get(q.opportunityId) : undefined;
              return {
                id: q.id, companyName: q.companyName, jobTitle: q.jobTitle, matchScore: q.matchScore,
                status: q.status, createdAt: q.createdAt.toISOString(), coverLetter: q.coverLetter || '', subject: q.subject || '',
                description: opp?.description || '', location: opp?.location || '', jobUrl: opp?.applyUrl || opp?.sourceUrl || '',
              };
            })}
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
          <span className="meta">{mSent} sent{ownInbox ? '' : ` · ${mReplied} replied`} · last 30 days</span>
        </div>
        <ApplicationsTable
          rows={appRows}
          sentToday={loop?.sentToday || 0}
          dailyLimit={20}
          isPro={user?.plan === 'PRO'}
        />
      </div>

      {/* Activity + Funnel side by side (stacks on phones — see dash-two-col). Own-inbox: the funnel
          has only one tracked stage (Sent — opens/replies untracked), so drop it and let Activity go
          full-width. */}
      <div className={ownInbox ? undefined : 'dash-two-col'}>

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

        {/* Funnel — hidden for own-inbox: only "Sent" is tracked there (opens + replies aren't), so a
            funnel would be a single bar. */}
        {!ownInbox && (
        <div className="card card-pad">
          <div className="section-head">
            <h2>Funnel · last 30 days</h2>
            <span className="muted f-mono" style={{fontSize: '11px'}}>{mSent > 0 ? `${(mReplied / mSent * 100).toFixed(1)}%` : '0%'} reply rate</span>
          </div>
          {/* Opened stage dropped — opens are untracked (no live pixel). This funnel only renders for
              Postal senders, whose Replied/Interview/Offer we DO track. */}
          {[
            { label: 'Sent', count: mSent, pct: 100, bg: 'var(--ink)', textColor: '#fff', dotColor: 'var(--s-sent)' },
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
        )}

      </div>
    </div>
  );
}
