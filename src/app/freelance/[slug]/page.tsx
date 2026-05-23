import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { ProjectPageClient } from './ProjectPageClient';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const opp = await prisma.opportunity.findUnique({
    where: { slug },
    select: { title: true, description: true, company: { select: { name: true } }, clientName: true },
  });
  if (!opp) return { title: 'Project Not Found — Freelanly' };
  const company = opp.company?.name || opp.clientName || '';
  return {
    title: `${opp.title}${company ? ` at ${company}` : ''} — Freelanly`,
    description: opp.description?.slice(0, 155) || `Apply for ${opp.title} with AI-powered cover letter`,
    alternates: { canonical: `${siteConfig.url}/freelance/${slug}` },
    openGraph: {
      title: `${opp.title}${company ? ` — ${company}` : ''}`,
      description: opp.description?.slice(0, 155) || `Apply for ${opp.title}`,
      url: `${siteConfig.url}/freelance/${slug}`,
      type: 'website',
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;

  const opp = await prisma.opportunity.findUnique({
    where: { slug },
    select: {
      id: true, title: true, slug: true, description: true,
      skills: true, location: true, locationType: true, country: true, level: true,
      clientName: true, clientHeadline: true, clientAvatar: true, clientLinkedIn: true,
      sourceUrl: true, createdAt: true, isActive: true,
      company: { select: { name: true } },
      categoryId: true,
      category: { select: { name: true, slug: true } },
    },
  });

  if (!opp || !opp.isActive) notFound();

  const minutesAgo = Math.floor((Date.now() - opp.createdAt.getTime()) / 60000);
  const postedAgo = minutesAgo < 60 ? `${minutesAgo}m ago`
    : minutesAgo < 1440 ? `${Math.round(minutesAgo / 60)}h ago`
    : `${Math.round(minutesAgo / 1440)}d ago`;

  const [applicationCount, totalProjects, similar] = await Promise.all([
    prisma.autoApplication.count({
      where: { opportunityId: opp.id, status: { in: ['SENT', 'OPENED', 'REPLIED'] } },
    }),
    prisma.opportunity.count({ where: { isActive: true, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } } }),
    prisma.opportunity.findMany({
      where: {
        id: { not: opp.id },
        isActive: true,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        ...(opp.categoryId ? { categoryId: opp.categoryId } : {}),
      },
      select: { id: true, slug: true, title: true, skills: true, company: { select: { name: true } }, clientName: true },
      take: 3, orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <ProjectPageClient
      project={{
        id: opp.id,
        title: opp.title,
        description: opp.description || '',
        companyName: opp.company?.name || opp.clientName || '',
        skills: opp.skills || [],
        location: opp.location,
        locationType: opp.locationType,
        country: opp.country,
        level: opp.level,
        category: opp.category?.name || null,
        postedAgo,
        sourceUrl: opp.sourceUrl,
        poster: opp.clientName ? {
          name: opp.clientName,
          headline: opp.clientHeadline,
          avatar: opp.clientAvatar,
          linkedIn: opp.clientLinkedIn,
        } : null,
      }}
      signals={{
        applicationCount,
        isEarly: applicationCount < 20,
        totalProjects,
      }}
      similar={similar.map(s => ({
        slug: s.slug,
        title: s.title,
        companyName: s.company?.name || s.clientName || '',
        skills: (s.skills || []).slice(0, 3),
      }))}
    />
  );
}
