import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AutoApplyStatus } from '@prisma/client';

/**
 * POST /api/user/discovery/apply-all
 * Queue auto-apply for all filtered discovery results.
 * Body: { filters: { skills?, source?, level?, country?, excludeKeywords? }, limit? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const { filters, limit = 50 } = await request.json();

    // Get user's active loop
    const loop = await prisma.autoApplyLoop.findFirst({
      where: { userId, isActive: true },
    });

    if (!loop) {
      return NextResponse.json({ error: 'No active auto-apply loop. Create one first.' }, { status: 400 });
    }

    // Build opportunity query from filters
    const where: Record<string, unknown> = {
      applyEmail: { not: null },
      createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
    };

    if (filters?.source) {
      where.source = filters.source;
    }
    if (filters?.level) {
      where.level = filters.level;
    }
    if (filters?.country) {
      where.country = filters.country;
    }

    const opportunities = await prisma.opportunity.findMany({
      where: where as any,
      select: { id: true, title: true, clientName: true, company: { select: { name: true } }, applyEmail: true, skills: true },
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
    });

    // Filter by skills if provided
    let filtered = opportunities;
    if (filters?.skills && Array.isArray(filters.skills) && filters.skills.length > 0) {
      const skillsLower = filters.skills.map((s: string) => s.toLowerCase());
      filtered = opportunities.filter(opp => {
        const oppSkills = (opp.skills || []).map(s => s.toLowerCase());
        return skillsLower.some((s: string) => oppSkills.some(os => os.includes(s) || s.includes(os)));
      });
    }

    // Exclude already applied
    const existingApps = await prisma.autoApplication.findMany({
      where: { userId, opportunityId: { in: filtered.map(o => o.id) } },
      select: { opportunityId: true },
    });
    const appliedIds = new Set(existingApps.map(a => a.opportunityId));
    const toApply = filtered.filter(o => !appliedIds.has(o.id));

    // Create PENDING applications
    let queued = 0;
    for (const opp of toApply) {
      try {
        await prisma.autoApplication.create({
          data: {
            origin: 'SELF', // user clicked apply-all in discovery
            userId,
            loopId: loop.id,
            opportunityId: opp.id,
            companyName: opp.company?.name || opp.clientName,
            jobTitle: opp.title,
            appliedToEmail: opp.applyEmail!,
            coverLetter: '',
            subject: '',
            status: AutoApplyStatus.PENDING,
          },
        });
        queued++;
      } catch {
        // Skip duplicates
      }
    }

    return NextResponse.json({
      ok: true,
      queued,
      skipped: toApply.length - queued,
      alreadyApplied: appliedIds.size,
      total: filtered.length,
    });
  } catch (error) {
    console.error('[ApplyAll] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
