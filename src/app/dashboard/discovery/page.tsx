import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { DiscoveryFeed } from '@/components/app/DiscoveryFeed';
import './discovery-design.css';

export const metadata: Metadata = {
  title: 'Discovery — Freelanly',
};

export const revalidate = 120;

export default async function DiscoveryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const dayAgo = new Date(Date.now() - 24 * 3600000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // Fetch recent opportunities (last 7 days, with apply email)
  const [opportunities, jobs, totalToday] = await Promise.all([
    prisma.opportunity.findMany({
      where: { isActive: true, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true, title: true, clientName: true, posterCompany: true,
        description: true, createdAt: true, skills: true, location: true,
        applyEmail: true, sourceUrl: true,
        company: { select: { name: true } },
      },
    }),
    prisma.job.findMany({
      where: { isActive: true, createdAt: { gte: weekAgo }, applyEmail: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, description: true, createdAt: true,
        skills: true, country: true, applyEmail: true, sourceUrl: true,
        company: { select: { name: true } },
      },
    }),
    prisma.opportunity.count({ where: { isActive: true, createdAt: { gte: dayAgo } } }),
  ]);

  // Merge and sort
  const items = [
    ...opportunities.map(o => ({
      id: o.id,
      type: 'opportunity' as const,
      title: o.title,
      companyName: o.company?.name || o.posterCompany || o.clientName,
      description: o.description.slice(0, 300),
      source: 'linkedin',
      createdAt: o.createdAt.toISOString(),
      skills: o.skills,
      location: o.location,
      applyEmail: o.applyEmail,
    })),
    ...jobs.map(j => ({
      id: j.id,
      type: 'job' as const,
      title: j.title,
      companyName: j.company.name,
      description: j.description.slice(0, 300),
      source: j.sourceUrl?.includes('lever') ? 'Lever' : j.sourceUrl?.includes('linkedin') ? 'linkedin' : 'careers page',
      createdAt: j.createdAt.toISOString(),
      skills: j.skills,
      location: j.country,
      applyEmail: j.applyEmail,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);

  const total = opportunities.length + jobs.length;

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Discovery <span style={{fontSize: '16px', color: 'var(--ink-4)', fontWeight: 400, fontFamily: "'Geist Mono', monospace"}}>· {totalToday} new today</span></h1>
          <p>Live feed across LinkedIn posts, career pages, and freelance boards. Updated every 3 hours.</p>
        </div>
        <div className="page-actions">
          <a href="/dashboard/discovery" className="btn btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Refresh feed
          </a>
        </div>
      </div>

      <DiscoveryFeed items={items} total={total} />

    </div>
  );
}
