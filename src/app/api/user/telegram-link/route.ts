import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

/**
 * POST /api/user/telegram-link — Generate a deep link for connecting Telegram
 * Returns: { url: "https://t.me/FLalarmbot?start={token}" }
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = randomBytes(16).toString('hex');

    // Store token → userId mapping (expires in 10 min)
    await prisma.settings.upsert({
      where: { key: `tg_link_${token}` },
      create: { key: `tg_link_${token}`, value: session.user.id },
      update: { value: session.user.id },
    });

    // Clean up old tokens (async, non-blocking)
    prisma.$executeRaw`DELETE FROM "Settings" WHERE key LIKE 'tg_link_%' AND "updatedAt" < NOW() - INTERVAL '10 minutes'`.catch(() => {});

    return NextResponse.json({
      url: `https://t.me/FLalarmbot?start=${token}`,
      token,
    });
  } catch (error) {
    console.error('[TelegramLink] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
