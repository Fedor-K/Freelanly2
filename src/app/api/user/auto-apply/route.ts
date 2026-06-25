import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AutoApplyMode } from '@prisma/client';
import { deriveCategorySlugs } from '@/lib/loop-routing';

// GET /api/user/auto-apply — List user's auto-apply loops with stats
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loops = await prisma.autoApplyLoop.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
        applications: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute stats for each loop
    const result = loops.map((loop) => {
      const stats = {
        total: loop.applications.length,
        sent: loop.applications.filter((a) => a.status === 'SENT').length,
        pending: loop.applications.filter((a) => a.status === 'PENDING').length,
        review: loop.applications.filter((a) => a.status === 'REVIEW').length,
        failed: loop.applications.filter((a) => a.status === 'FAILED').length,
        replied: loop.applications.filter((a) => a.status === 'REPLIED').length,
        interview: loop.applications.filter((a) => a.status === 'INTERVIEW').length,
      };

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { applications, _count, ...loopData } = loop;
      return { ...loopData, stats };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error getting auto-apply loops:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/user/auto-apply — Create a new auto-apply loop
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      jobTitles,
      keywords,
      country,
      level,
      salaryMin,
      salaryMax,
      blacklistCompanies,
      resumeUrl,
      templateId,
      mode,
      dailyLimit,
    } = body as {
      name?: string;
      jobTitles?: string[];
      keywords?: string;
      country?: string;
      level?: string;
      salaryMin?: number;
      salaryMax?: number;
      blacklistCompanies?: string[];
      resumeUrl?: string;
      templateId?: string;
      mode?: string;
      dailyLimit?: number;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!jobTitles || jobTitles.length === 0) {
      return NextResponse.json(
        { error: 'At least one job title is required' },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes: AutoApplyMode[] = ['AUTO', 'SEMI', 'MANUAL'];
    const loopMode = (mode as AutoApplyMode) || 'MANUAL';
    if (!validModes.includes(loopMode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    const cleanTitles = jobTitles.map((t) => t.trim()).filter((t) => t);
    const loop = await prisma.autoApplyLoop.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        jobTitles: cleanTitles,
        categorySlugs: deriveCategorySlugs({ jobTitles: cleanTitles, skills: keywords ? keywords.split(',') : [] }),
        keywords: keywords?.trim() || null,
        country: country || null,
        level: level || null,
        salaryMin: salaryMin || null,
        salaryMax: salaryMax || null,
        blacklistCompanies: blacklistCompanies?.map((c) => c.trim()).filter((c) => c) || [],
        resumeUrl: resumeUrl || null,
        templateId: templateId || null,
        mode: loopMode,
        dailyLimit: Math.min(Math.max(dailyLimit || 20, 1), 50), // FREE: 20, PRO: up to 50
        isActive: true,
      },
    });

    await Promise.all([
      prisma.activityLog.create({
        data: { userId: session.user.id, action: 'LOOP_CREATED', details: { loopId: loop.id, name: loop.name } },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { needsOnboarding: false },
      }),
    ]).catch(() => {});

    return NextResponse.json(loop);
  } catch (error) {
    console.error('[API] Error creating auto-apply loop:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/user/auto-apply — Update an existing loop
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body as {
      id: string;
      name?: string;
      jobTitles?: string[];
      keywords?: string;
      country?: string;
      level?: string;
      salaryMin?: number;
      salaryMax?: number;
      blacklistCompanies?: string[];
      resumeUrl?: string;
      templateId?: string;
      mode?: string;
      dailyLimit?: number;
      isActive?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: 'Loop id is required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.autoApplyLoop.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Loop not found' }, { status: 404 });
    }

    // Build update data — only include provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name.trim();
    if (updates.jobTitles !== undefined) data.jobTitles = updates.jobTitles.map((t) => t.trim()).filter((t) => t);
    if (updates.keywords !== undefined) data.keywords = updates.keywords?.trim() || null;
    // Recompute directions whenever the loop's stated intent changes, so routing stays in sync.
    if (updates.jobTitles !== undefined || updates.keywords !== undefined) {
      const titles = data.jobTitles ?? existing.jobTitles;
      const kw = data.keywords !== undefined ? data.keywords : existing.keywords;
      data.categorySlugs = deriveCategorySlugs({ jobTitles: titles, skills: kw ? kw.split(',') : [] });
    }
    if (updates.country !== undefined) data.country = updates.country || null;
    if (updates.level !== undefined) data.level = updates.level || null;
    if (updates.salaryMin !== undefined) data.salaryMin = updates.salaryMin || null;
    if (updates.salaryMax !== undefined) data.salaryMax = updates.salaryMax || null;
    if (updates.blacklistCompanies !== undefined) data.blacklistCompanies = updates.blacklistCompanies.map((c) => c.trim()).filter((c) => c);
    if (updates.resumeUrl !== undefined) data.resumeUrl = updates.resumeUrl || null;
    if (updates.templateId !== undefined) data.templateId = updates.templateId || null;
    if (updates.mode !== undefined) data.mode = updates.mode;
    if (updates.dailyLimit !== undefined) data.dailyLimit = Math.min(Math.max(updates.dailyLimit, 1), 50);
    if (updates.isActive !== undefined) data.isActive = updates.isActive;

    const loop = await prisma.autoApplyLoop.update({
      where: { id },
      data,
    });

    // Log state changes
    if (updates.isActive !== undefined) {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: updates.isActive ? 'LOOP_RESUMED' : 'LOOP_PAUSED',
          details: { loopId: id, source: 'api' },
        },
      }).catch(() => {});
    } else if (Object.keys(data).length > 0) {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'LOOP_UPDATED',
          details: { loopId: id, fields: Object.keys(data) },
        },
      }).catch(() => {});
    }

    return NextResponse.json(loop);
  } catch (error) {
    console.error('[API] Error updating auto-apply loop:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/user/auto-apply — Delete a loop and its applications
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Loop id is required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.autoApplyLoop.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Loop not found' }, { status: 404 });
    }

    // Cascade delete handles applications
    await prisma.autoApplyLoop.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting auto-apply loop:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
