import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/user/connect-telegram — Save Telegram chat ID for notifications
 * Called after user starts the bot and we get their chat_id
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { chatId } = await request.json();
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    await prisma.user.update({
      where: { id: session.user.id },
      data: { telegramChatId: String(chatId) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ConnectTelegram] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/connect-telegram — Disconnect Telegram
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.user.update({
      where: { id: session.user.id },
      data: { telegramChatId: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DisconnectTelegram] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
