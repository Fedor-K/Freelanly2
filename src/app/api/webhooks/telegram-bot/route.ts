import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function reply(chatId: number, text: string, markup?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (markup) body.reply_markup = markup;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * POST /api/webhooks/telegram-bot — Telegram Bot webhook
 * Handles /start with deep link token for account linking
 *
 * Flow:
 * 1. User clicks "Connect Telegram" in dashboard → gets link t.me/FLalarmbot?start={token}
 * 2. User opens bot → Telegram sends /start {token} here
 * 3. We link chatId to userId via token
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Telegram's secret token when configured (set it via setWebhook's
    // secret_token + the TELEGRAM_WEBHOOK_SECRET env). No-op until configured.
    const tgSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (tgSecret && request.headers.get('x-telegram-bot-api-secret-token') !== tgSecret) {
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from?.first_name || '';

    // /start {linkToken} — account linking
    if (text.startsWith('/start')) {
      const token = text.replace('/start', '').trim();

      if (token) {
        // Direct link: direct_{userIdPrefix}
        if (token.startsWith('direct_')) {
          const prefix = token.replace('direct_', '');
          const user = await prisma.user.findFirst({
            where: { id: { startsWith: prefix } },
            select: { id: true, name: true },
          });
          if (user) {
            await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: String(chatId) } });
            await reply(chatId,
              `✅ Connected! Hey ${user.name || firstName}!\n\n`
              + `You'll get instant notifications here when recruiters reply to your applications.\n\n`
              + `💬 Replies\n📨 Applications sent\n🟢 Interview invites`,
            );
            return NextResponse.json({ ok: true });
          }
        }

        // Token link (from telegram-link API)
        const setting = await prisma.settings.findUnique({ where: { key: `tg_link_${token}` } });
        if (setting) {
          const userId = setting.value as string;
          await prisma.user.update({
            where: { id: userId },
            data: { telegramChatId: String(chatId) },
          });
          await prisma.settings.delete({ where: { key: `tg_link_${token}` } });

          const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
          await reply(chatId,
            `👋 Welcome to Freelanly, ${user?.name || firstName}!\n\n`
            + `I'll send you instant notifications when recruiters reply to your applications.\n\n`
            + `Here's what to expect:\n`
            + `💬 Recruiter replies — "Company X is interested!"\n`
            + `🟢 Interview invites — "They want to schedule a call"\n`
            + `📊 Daily summary — sent, opened, replied\n\n`
            + `Your auto-apply is running. I'll ping you the moment a recruiter responds.\n\n`
            + `Dashboard: freelanly.com/dashboard`,
          );
          return NextResponse.json({ ok: true });
        }
      }

      // Generic /start without token — if this chat is ALREADY linked, say so (a bare /start from
      // an already-connected user would otherwise read as "nothing happened" / tell them to connect).
      const linked = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) }, select: { name: true } });
      if (linked) {
        await reply(chatId,
          `✅ You're already connected${linked.name ? `, ${linked.name}` : ''}!\n\n`
          + `I'll ping you here the moment a recruiter replies to your applications.\n\n`
          + `💬 Recruiter replies  🟢 Interview invites  📊 Daily summary\n\n`
          + `Dashboard: freelanly.com/dashboard`,
        );
        return NextResponse.json({ ok: true });
      }
      await reply(chatId,
        `👋 Hey ${firstName}! Welcome to Freelanly.\n\n`
        + `I'll send you instant notifications when recruiters reply to your applications.\n\n`
        + `Here's what to expect:\n`
        + `💬 Recruiter replies — "Company X is interested!"\n`
        + `🟢 Interview invites — "They want to schedule a call"\n`
        + `📊 Daily summary — sent, opened, replied\n\n`
        + `To connect your account:\n`
        + `<b>freelanly.com/dashboard</b> → click "Connect Telegram"\n\n`
        + `Your auto-apply is running. I'll ping you the moment a recruiter responds.`,
      );
      return NextResponse.json({ ok: true });
    }

    // Any other message
    await reply(chatId,
      `I only send notifications — no commands needed! 🤖\n\n`
      + `If you haven't connected yet:\n`
      + `<b>freelanly.com/dashboard</b> → Settings → Connect Telegram`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TelegramBot] Error:', error);
    return NextResponse.json({ ok: true });
  }
}
