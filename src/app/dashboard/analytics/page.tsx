import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import './analytics-design.css';

export const metadata: Metadata = {
  title: 'Analytics — Freelanly',
};

export const revalidate = 60;

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d60 = new Date(now.getTime() - 60 * 86400000);

  // KPIs: this 30d vs prev 30d
  const [this30, prev30] = await Promise.all([
    prisma.autoApplication.groupBy({ by: ['status'], where: { userId, sentAt: { gte: d30 } }, _count: true }),
    prisma.autoApplication.groupBy({ by: ['status'], where: { userId, sentAt: { gte: d60, lt: d30 } }, _count: true }),
  ]);

  const count = (groups: typeof this30, ...statuses: string[]) =>
    groups.filter(g => statuses.includes(g.status)).reduce((s, g) => s + g._count, 0);

  const sent = count(this30, 'SENT','DELIVERED','OPENED','REPLIED','INTERVIEW','OFFER');
  const sentPrev = count(prev30, 'SENT','DELIVERED','OPENED','REPLIED','INTERVIEW','OFFER');
  const replied = count(this30, 'REPLIED','INTERVIEW','OFFER');
  const repliedPrev = count(prev30, 'REPLIED','INTERVIEW','OFFER');
  const interviews = count(this30, 'INTERVIEW','OFFER');
  const interviewsPrev = count(prev30, 'INTERVIEW','OFFER');
  const offers = count(this30, 'OFFER');
  const offersPrev = count(prev30, 'OFFER');

  const replyRate = sent > 0 ? (replied / sent * 100).toFixed(1) : '0';
  const replyRatePrev = sentPrev > 0 ? (repliedPrev / sentPrev * 100) : 0;
  const sentDelta = sentPrev > 0 ? Math.round((sent - sentPrev) / sentPrev * 100) : 0;
  const rrDelta = sent > 0 ? (replied / sent * 100 - replyRatePrev).toFixed(1) : '0';

  // Daily volume last 30 days
  const dailyData = await prisma.$queryRaw<Array<{ day: Date; cnt: bigint }>>`
    SELECT DATE("sentAt") as day, COUNT(*) as cnt
    FROM "AutoApplication"
    WHERE "userId" = ${userId} AND "sentAt" >= ${d30}
    GROUP BY DATE("sentAt") ORDER BY day ASC
  `;
  const dailyMap = new Map<string, number>();
  for (const row of dailyData) dailyMap.set(new Date(row.day).toISOString().slice(0, 10), Number(row.cnt));

  const bars: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    bars.push(dailyMap.get(d) || 0);
  }
  const maxBar = Math.max(...bars, 1);
  const barW = 800 / 30;

  // Date labels
  const dl = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Template performance
  const templates = await prisma.coverLetterTemplate.findMany({
    where: { userId },
    orderBy: { replyCount: 'desc' },
    select: { name: true, sentCount: true, replyCount: true, isDefault: true },
  });

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Analytics</h1>
          <p>What&apos;s working, what&apos;s not, where to focus next.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button>7d</button>
            <button className="active">30d</button>
            <button>90d</button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid mb-4">
        <div className="kpi">
          <div className="kpi-label">Applications sent</div>
          <div className="kpi-value tabular">{sent}</div>
          <div className={`kpi-delta ${sentDelta >= 0 ? 'up' : 'down'}`}>{sentDelta >= 0 ? '↑' : '↓'} {Math.abs(sentDelta)}% vs prev 30d</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg reply rate</div>
          <div className="kpi-value tabular">{replyRate}%</div>
          <div className={`kpi-delta ${Number(rrDelta) >= 0 ? 'up' : 'down'}`}>{Number(rrDelta) >= 0 ? '↑' : '↓'} {Math.abs(Number(rrDelta))}pp vs prev 30d</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Calls booked</div>
          <div className="kpi-value tabular">{interviews}</div>
          <div className={`kpi-delta ${interviews >= interviewsPrev ? 'up' : 'down'}`}>{interviews >= interviewsPrev ? '↑' : '↓'} {Math.abs(interviews - interviewsPrev)} vs prev 30d</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Projects closed</div>
          <div className="kpi-value tabular">{offers}</div>
          <div className={`kpi-delta ${offers >= offersPrev ? 'up' : 'down'}`}>{offers >= offersPrev ? '↑' : '↓'} {Math.abs(offers - offersPrev)} vs prev 30d</div>
        </div>
      </div>

      {/* Main chart */}
      <div className="card chart-card mb-4">
        <div className="section-head">
          <div className="row gap-3">
            <h2>Volume &amp; reply rate</h2>
          </div>
          <div className="legend">
            <div className="item"><span className="sw" style={{background: 'var(--ink)'}}></span>Sent</div>
            <div className="item"><span className="sw" style={{background: 'var(--acid-deep)'}}></span>Replies</div>
          </div>
        </div>
        <div className="chart-frame">
          <svg viewBox="0 0 800 240" preserveAspectRatio="none">
            <line x1="0" y1="60" x2="800" y2="60" stroke="var(--line)" strokeWidth="1"/>
            <line x1="0" y1="120" x2="800" y2="120" stroke="var(--line)" strokeWidth="1"/>
            <line x1="0" y1="180" x2="800" y2="180" stroke="var(--line)" strokeWidth="1"/>
            {bars.map((v, i) => {
              const x = i * barW + 2;
              const h = maxBar > 0 ? (v / maxBar) * 200 : 0;
              return <rect key={i} x={x} y={240 - h} width={barW - 4} height={h} fill="var(--ink)" rx="2"/>;
            })}
          </svg>
          <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', color: 'var(--ink-5)', marginTop: '8px'}}>
            <span>{dl(29)}</span><span>{dl(22)}</span><span>{dl(15)}</span><span>{dl(7)}</span><span>Today</span>
          </div>
        </div>
      </div>

      {/* Template performance */}
      <div className="card mb-4">
        <div className="card-head"><h3>Template performance</h3><a href="/dashboard/templates" className="muted f-mono" style={{fontSize: '11px'}}>Manage templates →</a></div>
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Template</th>
              <th className="num">Sends</th>
              <th className="num">Replies</th>
              <th className="num">Reply rate</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr><td colSpan={4} style={{textAlign: 'center', color: 'var(--ink-4)', padding: '24px'}}>No templates yet</td></tr>
            ) : templates.map((tpl, i) => {
              const rate = tpl.sentCount > 0 ? (tpl.replyCount / tpl.sentCount * 100).toFixed(1) : '0';
              const rateNum = Number(rate);
              const heatBg = rateNum >= 15 ? 'var(--acid)' : rateNum >= 10 ? 'rgba(199,249,74,0.5)' : rateNum >= 7 ? 'rgba(199,249,74,0.3)' : 'var(--bg-2)';
              const heatColor = rateNum >= 15 ? '#000' : 'inherit';
              const isWinning = i === 0 && tpl.replyCount > 0 && templates.length > 1;
              return (
                <tr key={tpl.name}>
                  <td>
                    <b style={{fontWeight: 500}}>{tpl.name}</b>
                    {isWinning && <span className="chip chip-acid-soft" style={{marginLeft: '6px'}}>winning</span>}
                  </td>
                  <td className="num">{tpl.sentCount}</td>
                  <td className="num">{tpl.replyCount}</td>
                  <td className="num"><span className="heatcell" style={{background: heatBg, color: heatColor}}>{rate}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
