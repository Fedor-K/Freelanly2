import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dayAgo = new Date(Date.now() - 24 * 3600000);
    const opportunities = await prisma.opportunity.findMany({
      where: { isActive: true, createdAt: { gte: dayAgo }, applyEmail: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, clientName: true, location: true, skills: true, company: { select: { name: true } } },
    });

    const matches = opportunities.map((o, i) => ({
      company: o.company?.name || o.clientName || 'Company',
      logo: { ch: (o.company?.name || o.clientName || 'C')[0].toUpperCase(), bg: COLORS[i % COLORS.length] },
      role: o.title,
      meta: o.location || 'Remote',
      score: Math.floor(70 + Math.random() * 25),
      pass: i !== 2,
      reason: i === 2 ? 'below threshold' : undefined,
    }));

    const totalToday = await prisma.opportunity.count({ where: { isActive: true, createdAt: { gte: dayAgo } } });

    return NextResponse.json({ matches, totalToday });
  } catch (error) {
    console.error('[WelcomeMatches] Error:', error);
    return NextResponse.json({ matches: [], totalToday: 0 });
  }
}
