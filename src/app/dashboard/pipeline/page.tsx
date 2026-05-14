import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import './pipeline-design.css';

export const metadata: Metadata = {
  title: 'Pipeline — Freelanly',
};

export const revalidate = 60;

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

function timeAgo(date: Date | null): string {
  if (!date) return '';
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return '1d';
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

type DealApp = {
  id: string;
  companyName: string;
  jobTitle: string;
  matchScore: number | null;
  replyCategory: string | null;
  sentAt: Date | null;
  repliedAt: Date | null;
  createdAt: Date;
};

const STAGES = [
  { key: 'sent', label: 'Outreach sent', statuses: ['SENT', 'DELIVERED'], dotColor: 'var(--s-sent)' },
  { key: 'opened', label: 'Opened', statuses: ['OPENED'], dotColor: 'var(--s-opened)' },
  { key: 'replied', label: 'Replied', statuses: ['REPLIED'], dotColor: 'var(--s-replied)' },
  { key: 'interview', label: 'Interview', statuses: ['INTERVIEW'], dotColor: 'var(--s-booked)' },
  { key: 'offer', label: 'Offer', statuses: ['OFFER'], dotColor: 'var(--s-offer)' },
] as const;

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // Fetch all applications grouped by status
  const allApps = await prisma.autoApplication.findMany({
    where: { userId, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, companyName: true, jobTitle: true, matchScore: true,
      replyCategory: true, sentAt: true, repliedAt: true, createdAt: true, status: true,
    },
  });

  // Group by stage
  const stageApps: Record<string, DealApp[]> = {};
  const stageCounts: Record<string, number> = {};
  for (const stage of STAGES) {
    const apps = allApps.filter(a => stage.statuses.includes(a.status));
    stageApps[stage.key] = apps.slice(0, 4);
    stageCounts[stage.key] = apps.length;
  }

  // KPIs
  const activeConversations = allApps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length;
  const recentReplied = allApps.filter(a => a.repliedAt && a.repliedAt >= weekAgo).length;
  const totalSent30d = allApps.filter(a => a.sentAt && a.sentAt >= monthAgo).length;
  const totalReplied30d = allApps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status) && a.sentAt && a.sentAt >= monthAgo).length;
  const replyRate = totalSent30d > 0 ? (totalReplied30d / totalSent30d * 100).toFixed(1) : '0';

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Pipeline</h1>
          <p>Every active conversation, tracked from outreach to signed contract.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className="active">Board</button>
            <button>List</button>
          </div>
          <button className="btn btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter
          </button>
        </div>
      </div>

      {/* Stage summary */}
      <div className="kpi-grid mb-4">
        <div className="kpi">
          <div className="kpi-label">Active conversations</div>
          <div className="kpi-value tabular">{activeConversations}</div>
          <div className="kpi-delta up">↑ {recentReplied} this week</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Reply rate (30d)</div>
          <div className="kpi-value tabular">{replyRate}%</div>
        </div>
      </div>

      {/* Board */}
      <div className="kanban">

        {STAGES.map((stage, stageIdx) => (
          <div key={stage.key} className="column">
            <div className="column-head">
              <div className="name"><span className="dot" style={{background: stage.dotColor}}></span>{stage.label}</div>
              <span className="count">{stageCounts[stage.key]}</span>
            </div>
            <div className="column-body">
              {stageApps[stage.key].length === 0 ? (
                <div style={{textAlign: 'center', padding: '20px 8px', fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)'}}>No items</div>
              ) : stageApps[stage.key].map((app, i) => (
                <div key={app.id} className="deal-card" style={stage.key === 'offer' ? {background: 'linear-gradient(180deg, rgba(199,249,74,0.08), var(--bg-0))', borderColor: 'var(--acid-deep)'} : stage.key === 'replied' && app.replyCategory === 'INTERESTED' ? {borderColor: 'var(--acid-deep)'} : undefined}>
                  <div className="top">
                    <div className="logo" style={{background: COLORS[(stageIdx * 4 + i) % COLORS.length]}}>{app.companyName[0]}</div>
                    <div>
                      <div className="role">{app.jobTitle}</div>
                      <div className="co">{app.companyName}</div>
                    </div>
                  </div>
                  {app.replyCategory && (
                    <div className="tags">
                      <span className={`tag ${['INTERESTED','INTERVIEW'].includes(app.replyCategory) ? 'tag-acid' : ''}`}>{app.replyCategory.toLowerCase()}</span>
                    </div>
                  )}
                  <div className="meta">
                    <span className="value">{app.matchScore ? `${app.matchScore}%` : ''}</span>
                    <span className="age">{timeAgo(app.sentAt || app.createdAt)}</span>
                  </div>
                </div>
              ))}
              {stageCounts[stage.key] > 4 && (
                <div style={{textAlign: 'center', padding: '8px', fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)'}}>+ {stageCounts[stage.key] - 4} more</div>
              )}
            </div>
            {(stage.key === 'replied' || stage.key === 'interview') && stageCounts[stage.key] > 0 && (
              <div className="col-stat">
                <span>Count</span>
                <span style={{color: 'var(--acid-deep)'}}>{stageCounts[stage.key]}</span>
              </div>
            )}
          </div>
        ))}

      </div>

    </div>
  );
}
