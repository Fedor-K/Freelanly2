const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export async function sendTelegramNotification(chatId: string, text: string, replyMarkup?: object): Promise<boolean> {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[TelegramNotify] Failed:', data.description);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[TelegramNotify] Error:', e);
    return false;
  }
}

export function formatReplyNotification(params: {
  userName: string;
  companyName: string;
  jobTitle: string;
  replyPreview: string;
  category: string;
}): { text: string; markup: object } {
  const emoji = params.category === 'INTERVIEW' ? '🟢' : params.category === 'REJECTED' ? '🔴' : '💬';
  const categoryLabel = params.category === 'INTERVIEW' ? 'Wants interview!'
    : params.category === 'REJECTED' ? 'Not a fit'
    : 'Interested';

  const text = `${emoji} <b>${params.companyName}</b> replied!\n\n`
    + `<b>${params.jobTitle}</b>\n`
    + `<i>${categoryLabel}</i>\n\n`
    + `"${params.replyPreview.slice(0, 200)}${params.replyPreview.length > 200 ? '...' : ''}"\n\n`
    + `<a href="https://freelanly.com/dashboard/inbox">View & Reply →</a>`;

  const markup = {
    inline_keyboard: [[
      { text: '💬 View & Reply', url: 'https://freelanly.com/dashboard/inbox' },
    ]],
  };

  return { text, markup };
}

/**
 * Day+1 "new matched roles" Telegram duplicate (2026-07-17) — sent right after the email of the
 * same name (service: src/services/day1-matches.ts), only to users with a linked bot chat.
 * Telegram HTML is stricter than email HTML — escape everything scraped.
 */
export function formatDay1MatchesTG(params: {
  totalMatches: number;
  roles: Array<{ title: string; company: string; url: string }>; // top 3, utm_medium=telegram
  feedUrl: string;
}): { text: string; markup: object } {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = params.roles
    .map((r, i) => `${i + 1}. <a href="${r.url}">${esc(r.title)}</a> — ${esc(r.company)}`)
    .join('\n');
  const text = `🎯 <b>${params.totalMatches} new roles match your profile</b>\n\n${lines}`;
  const markup = { inline_keyboard: [[{ text: 'Open your feed →', url: params.feedUrl }]] };
  return { text, markup };
}
