import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/saved-feeds — list user's saved feeds
 * POST /api/user/saved-feeds — create new feed
 * PATCH /api/user/saved-feeds — update feed
 * DELETE /api/user/saved-feeds?id=xxx — delete feed
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const feeds = await prisma.savedFeed.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Count matching opportunities for each feed
    const feedsWithCounts = await Promise.all(feeds.map(async (feed) => {
      const where: Record<string, unknown> = { isActive: true, applyEmail: { not: null } };

      if (feed.skills.length > 0) {
        where.skills = { hasSome: feed.skills };
      }
      if (feed.keywords) {
        where.OR = feed.keywords.split(',').map(k => ({
          OR: [
            { title: { contains: k.trim(), mode: 'insensitive' } },
            { description: { contains: k.trim(), mode: 'insensitive' } },
          ],
        }));
      }
      if (feed.country) {
        where.country = feed.country;
      }

      const count = await prisma.opportunity.count({ where: where as any });
      return { ...feed, matchCount: count };
    }));

    return NextResponse.json(feedsWithCounts);
  } catch (error) {
    console.error('[SavedFeeds] GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, skills, keywords, excludeKeywords, country, level, minRate, color } = await request.json();

    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const feed = await prisma.savedFeed.create({
      data: {
        userId: session.user.id,
        name,
        skills: skills || [],
        keywords: keywords || null,
        excludeKeywords: excludeKeywords || null,
        country: country || null,
        level: level || null,
        minRate: minRate || null,
        color: color || null,
      },
    });

    return NextResponse.json(feed);
  } catch (error) {
    console.error('[SavedFeeds] POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, ...data } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const feed = await prisma.savedFeed.update({
      where: { id },
      data,
    });

    return NextResponse.json(feed);
  } catch (error) {
    console.error('[SavedFeeds] PATCH error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await prisma.savedFeed.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SavedFeeds] DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
