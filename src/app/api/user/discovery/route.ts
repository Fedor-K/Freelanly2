import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/discovery
 * Returns matching opportunities with filters.
 * Query params: skills, keywords, exclude, country, sort, page
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const skills = params.get('skills')?.split(',').filter(Boolean) || [];
    const keywords = params.get('keywords')?.split(',').filter(Boolean) || [];
    const exclude = params.get('exclude')?.split(',').filter(Boolean) || [];
    const country = params.get('country') || null;
    const sort = params.get('sort') || 'newest'; // newest, match
    const page = parseInt(params.get('page') || '1', 10);
    const limit = 20;

    // Build where clause
    const where: Record<string, unknown> = {
      isActive: true,
      applyEmail: { not: null },
    };

    // Skill filter
    if (skills.length > 0) {
      where.skills = { hasSome: skills };
    }

    // Keyword filter (search in title + description)
    if (keywords.length > 0) {
      where.AND = keywords.map(kw => ({
        OR: [
          { title: { contains: kw.trim(), mode: 'insensitive' } },
          { description: { contains: kw.trim(), mode: 'insensitive' } },
        ],
      }));
    }

    // Exclude keywords
    if (exclude.length > 0) {
      where.NOT = exclude.map(ex => ({
        OR: [
          { title: { contains: ex.trim(), mode: 'insensitive' } },
          { description: { contains: ex.trim(), mode: 'insensitive' } },
        ],
      }));
    }

    // Country filter
    if (country) {
      where.country = country;
    }

    // Get already applied/skipped opportunity IDs
    const applied = await prisma.autoApplication.findMany({
      where: { userId: session.user.id, opportunityId: { not: null } },
      select: { opportunityId: true },
    });
    const appliedIds = applied.map(a => a.opportunityId).filter(Boolean) as string[];
    if (appliedIds.length > 0) {
      where.id = { notIn: appliedIds };
    }

    // Sort
    const orderBy = sort === 'newest'
      ? { createdAt: 'desc' as const }
      : { createdAt: 'desc' as const }; // match sorting done post-query

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where: where as any,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          clientName: true,
          clientLinkedIn: true,
          applyEmail: true,
          skills: true,
          level: true,
          country: true,
          slug: true,
          createdAt: true,
          category: { select: { slug: true, name: true } },
        },
      }),
      prisma.opportunity.count({ where: where as any }),
    ]);

    // Calculate match score for each
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { parsedProfile: true },
    });
    const userSkills = ((user?.parsedProfile as Record<string, unknown>)?.skills as string[]) || [];
    const userSkillsLower = userSkills.map(s => s.toLowerCase());

    const results = opportunities.map(opp => {
      let matchScore = 30; // base
      if (userSkillsLower.length > 0 && opp.skills.length > 0) {
        const oppSkillsLower = opp.skills.map(s => s.toLowerCase());
        const overlap = userSkillsLower.filter(us =>
          oppSkillsLower.some(os => os.includes(us) || us.includes(os))
        ).length;
        matchScore = Math.min(100, 30 + Math.round((overlap / Math.min(userSkills.length, opp.skills.length)) * 70));
      }
      const matchLabel = matchScore >= 80 ? 'Strong' : matchScore >= 50 ? 'Good' : 'Weak';

      return { ...opp, matchScore, matchLabel };
    });

    // Sort by match if requested
    if (sort === 'match') {
      results.sort((a, b) => b.matchScore - a.matchScore);
    }

    return NextResponse.json({
      opportunities: results,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[Discovery] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
