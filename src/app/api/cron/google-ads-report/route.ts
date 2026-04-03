/**
 * Ежедневный отчёт по Google Ads в Telegram + автопауза при высоком CPA.
 * Cron: каждый день в 9:00 UTC
 *
 * Логика:
 * 1. Получаем данные по всем активным кампаниям за вчера
 * 2. Если CPA кампании > €15 (цена подписки) → автопауза
 * 3. Отправляем сводку в Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listCampaigns,
  updateCampaignStatus,
  type CampaignData,
} from '@/lib/google-ads';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_ALERT_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ALERT_CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

// Если CPA > этого порога → автопауза кампании
const MAX_CPA_EUR = 15;

// Если потрачено > этого за день → предупреждение
const DAILY_SPEND_WARN_EUR = 10;

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'MarkdownV2',
        }),
      }
    );
    if (!res.ok) {
      console.error('[GAds Report] Telegram send failed:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[GAds Report] Telegram error:', err);
    return false;
  }
}

function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');
  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'pause-all') {
      const campaigns = await listCampaigns();
      const results = [];
      for (const c of campaigns) {
        if (c.status === 'ENABLED') {
          await updateCampaignStatus(c.id, 'PAUSED');
          results.push({ name: c.name, id: c.id, action: 'PAUSED' });
        } else {
          results.push({ name: c.name, id: c.id, action: `already ${c.status}` });
        }
      }
      return NextResponse.json({ ok: true, results });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');
  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pause all campaigns
  const { searchParams } = new URL(req.url);
  if (searchParams.get('action') === 'pause-all') {
    const campaigns = await listCampaigns();
    const results = [];
    for (const c of campaigns) {
      if (c.status === 'ENABLED') {
        await updateCampaignStatus(c.id, 'PAUSED');
        results.push({ name: c.name, id: c.id, action: 'PAUSED' });
      } else {
        results.push({ name: c.name, id: c.id, action: `already ${c.status}` });
      }
    }
    return NextResponse.json({ ok: true, results });
  }

  try {
    const date = yesterday();
    const campaigns = await listCampaigns({ from: date, to: date });

    // Фильтруем только активные (ENABLED) и с тратами
    const active = campaigns.filter(
      (c: CampaignData) => c.status === 'ENABLED' || c.costMicros > 0
    );

    if (active.length === 0) {
      // Нет активных кампаний — короткое сообщение
      await sendTelegramMessage(
        `📊 *Google Ads — ${escapeMarkdown(date)}*\n\nНет активных кампаний или расходов за вчера\\.`
      );
      return NextResponse.json({ ok: true, campaigns: 0 });
    }

    // Считаем тотал
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;
    const pausedCampaigns: string[] = [];

    // Строим отчёт по каждой кампании
    const lines: string[] = [];

    for (const c of active) {
      const spend = c.cost;
      const cpa = c.conversions > 0 ? spend / c.conversions : Infinity;
      const ctr = (c.ctr * 100).toFixed(1);

      totalSpend += spend;
      totalClicks += c.clicks;
      totalImpressions += c.impressions;
      totalConversions += c.conversions;

      // Автопауза при высоком CPA
      let statusIcon = '✅';
      let autoAction = '';

      if (c.status === 'ENABLED' && spend > 3 && cpa > MAX_CPA_EUR) {
        try {
          await updateCampaignStatus(c.id, 'PAUSED');
          statusIcon = '⛔';
          autoAction = ` \\— *АВТОПАУЗА* \\(CPA ${escapeMarkdown(formatEur(cpa))} \\> ${escapeMarkdown(formatEur(MAX_CPA_EUR))}\\)`;
          pausedCampaigns.push(c.name);
        } catch (err) {
          console.error(`[GAds Report] Failed to pause campaign ${c.id}:`, err);
          statusIcon = '⚠️';
          autoAction = ' \\— не удалось поставить на паузу';
        }
      } else if (c.status === 'PAUSED') {
        statusIcon = '⏸';
      }

      const cpaStr = c.conversions > 0 ? formatEur(cpa) : '—';

      lines.push(
        `${statusIcon} *${escapeMarkdown(c.name)}*${autoAction}\n` +
        `   💰 ${escapeMarkdown(formatEur(spend))} \\| 👆 ${c.clicks} кликов \\| 👁 ${c.impressions} показов\n` +
        `   📈 CTR ${escapeMarkdown(ctr)}% \\| CPC ${escapeMarkdown(formatEur(c.averageCpc))} \\| CPA ${escapeMarkdown(cpaStr)}\n` +
        `   🎯 ${c.conversions} конверсий`
      );
    }

    // Тотал
    const totalCpa = totalConversions > 0 ? formatEur(totalSpend / totalConversions) : '—';
    const totalCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0';

    let header = `📊 *Google Ads — ${escapeMarkdown(date)}*\n\n`;
    header += `💰 Итого: *${escapeMarkdown(formatEur(totalSpend))}* \\| 👆 ${totalClicks} \\| 🎯 ${totalConversions} конв\\. \\| CPA ${escapeMarkdown(totalCpa)}\n`;

    if (totalSpend > DAILY_SPEND_WARN_EUR) {
      header += `⚠️ Расход выше ${escapeMarkdown(formatEur(DAILY_SPEND_WARN_EUR))}\\!\n`;
    }

    if (pausedCampaigns.length > 0) {
      header += `\n⛔ Автопауза: ${pausedCampaigns.map(n => escapeMarkdown(n)).join(', ')}\n`;
    }

    const message = header + '\n' + lines.join('\n\n');

    await sendTelegramMessage(message);

    return NextResponse.json({
      ok: true,
      date,
      campaigns: active.length,
      totalSpend,
      totalClicks,
      totalConversions,
      paused: pausedCampaigns,
    });
  } catch (error) {
    console.error('[GAds Report] Error:', error);

    // Отправим алерт об ошибке
    await sendTelegramMessage(
      `🚨 *Google Ads Report — Ошибка*\n\n${escapeMarkdown(error instanceof Error ? error.message : String(error))}`
    );

    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
