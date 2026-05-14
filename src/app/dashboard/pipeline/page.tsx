import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { PipelineClient } from '@/components/app/PipelineClient';
import './pipeline-design.css';

export const metadata: Metadata = {
  title: 'Pipeline — Freelanly',
};

export const revalidate = 60;

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const monthAgo = new Date(Date.now() - 30 * 86400000);

  const allApps = await prisma.autoApplication.findMany({
    where: { userId, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, companyName: true, jobTitle: true, matchScore: true,
      replyCategory: true, sentAt: true, createdAt: true, status: true,
    },
  });

  const activeConversations = allApps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length;
  const recentReplied = allApps.filter(a => a.sentAt && a.sentAt >= weekAgo && ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length;
  const totalSent30d = allApps.filter(a => a.sentAt && a.sentAt >= monthAgo).length;
  const totalReplied30d = allApps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status) && a.sentAt && a.sentAt >= monthAgo).length;
  const replyRate = totalSent30d > 0 ? (totalReplied30d / totalSent30d * 100).toFixed(1) : '0';

  const serialized = allApps.map(a => ({
    id: a.id,
    companyName: a.companyName,
    jobTitle: a.jobTitle,
    matchScore: a.matchScore,
    replyCategory: a.replyCategory,
    status: a.status,
    sentAt: a.sentAt?.toISOString() || null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Pipeline</h1>
          <p>Every active conversation, tracked from outreach to signed contract.</p>
        </div>
      </div>

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

      <PipelineClient apps={serialized} />

    </div>
  );
}
