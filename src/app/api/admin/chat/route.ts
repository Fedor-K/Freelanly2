import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/chat
 * Returns all chat messages, newest first.
 */
export async function GET() {
  try {
    const messages = await prisma.activityLog.findMany({
      where: { action: 'CHAT_MESSAGE' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[Admin/Chat] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 });
  }
}
