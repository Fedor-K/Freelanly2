/**
 * Daily stat — one-shot operational snapshot for "какая стата", in Fedor's fixed format.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/daily-stat.js
 *
 * "Сегодня" = since 00:00 MSK (UTC+3) — the house convention for "стата". Reply-based lines
 * (⭐/💬/👤/✍️) accumulate through the MSK day. Cumulative lines (👥/🔄/📱/💰/🏢/🏆) are all-time.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fmt = (n) => Number(n).toLocaleString('en-US');

// Geo brush-offs ("I need a Canada-based candidate") and farm form-collectors (Google Form /
// WhatsApp-channel mass templates) are NOT real engagement — excluded from ⭐/💬/👤 (Fedor 2026-06-17).
const GEO_REJECT_RE = /(?:\b(?:need|looking for|require|want|seeking|prefer)\b[^.\n]{0,30}\bbased\b[^.\n]{0,15}\bcandidate)|(?:\bavailable only (?:for|to)\b[^.\n]{0,40}\bcandidate)|(?:\bonly (?:for|to|open to|available (?:for|to))\b[^.\n]{0,30}\bcandidates?\b[^.\n]{0,30}\b(?:based|located|in)\b)|(?:\bcandidates?\b[^.\n]{0,25}\b(?:must|need to|should|have to)\b[^.\n]{0,12}\bbe\b[^.\n]{0,15}\b(?:based|located)\b)/i;
const FARM_FORM_RE = /forms\.gle\/|docs\.google\.com\/forms|\bgoogle\s+form\b|\b(?:complete|fill\s*(?:out|in)?|submit)\b[^.\n]{0,40}\b(?:internship\s+)?application\s+form\b|whatsapp\.com\/channel\//i;
const isReal = (t) => !GEO_REJECT_RE.test(t || '') && !FARM_FORM_RE.test(t || '');
// genuine candidate reply = a from='user' message written AFTER the recruiter replied (the initial
// cover letter is also from='user' but predates repliedAt — counting it was the old fake-metric bug).
const isGenuine = (m) => m.application.repliedAt && m.createdAt.getTime() > m.application.repliedAt.getTime() + 1000;

async function main() {
  // 00:00 MSK as a real UTC instant.
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 3600e3);
  const ds = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate()) - 3 * 3600e3);
  const notSpam = { replyCategory: { not: 'SPAM' } };

  const [
    usersTotal, loopsTotal, tgTotal, rateTotal,
    sentToday, oppsToday, repliedToday, repliedAll,
    fullRegUsers, recruitersTotal, interviews, offers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.autoApplyLoop.count(),
    prisma.user.count({ where: { telegramChatId: { not: null } } }),
    prisma.user.count({ where: { OR: [{ rateFloorHourly: { not: null } }, { currentRate: { not: null } }, { salaryExpectation: { not: null } }] } }),
    prisma.autoApplication.count({ where: { sentAt: { gte: ds } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: ds } } }),
    prisma.autoApplication.findMany({ where: { repliedAt: { gte: ds }, ...notSpam }, select: { userId: true, replyText: true } }),
    prisma.autoApplication.findMany({ where: { repliedAt: { not: null }, ...notSpam }, select: { replyText: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: ds }, emailVerified: { not: null }, resumeUrl: { not: null }, linkedinUrl: { not: null } }, select: { id: true } }),
    prisma.recruiter.count(),
    prisma.autoApplication.count({ where: { status: 'INTERVIEW' } }),
    prisma.autoApplication.count({ where: { status: 'OFFER' } }),
  ]);

  // ⭐ NSM = real recruiter↔candidate connections (non-spam, minus geo brush-offs / farm forms)
  const realToday = repliedToday.filter((r) => isReal(r.replyText));
  const nsmToday = realToday.length;
  const nsmTotal = repliedAll.filter((r) => isReal(r.replyText)).length;

  // 💬 / 👤
  const recruiterReplies = realToday.length;
  const gotReply = new Set(realToday.map((r) => r.userId)).size;

  // 📤 distinct projects today's sends went to
  const sentProjects = (await prisma.autoApplication.findMany({
    where: { sentAt: { gte: ds }, opportunityId: { not: null } }, select: { opportunityId: true }, distinct: ['opportunityId'],
  })).length;

  // 📥 supply today, split by source (LinkedIn posts vs ATS/Lever) — sends are bound by this inflow
  const supply = await prisma.opportunity.groupBy({ by: ['source'], where: { createdAt: { gte: ds } }, _count: { _all: true } });
  const bySrc = Object.fromEntries(supply.map((s) => [s.source, s._count._all]));
  const liToday = bySrc['linkedin'] || 0;
  const atsToday = bySrc['ats_lever'] || 0;

  // 📝 full-cycle regs today + applies that went out from them
  const regs = fullRegUsers.length;
  const appliesFromRegs = await prisma.autoApplication.count({ where: { userId: { in: fullRegUsers.map((u) => u.id) }, sentAt: { not: null } } });

  // ✍️ genuine replies back to recruiters today, split new vs returning
  const replyMsgs = (await prisma.message.findMany({
    where: { from: 'user', createdAt: { gte: ds }, application: { repliedAt: { not: null } } },
    select: { createdAt: true, application: { select: { userId: true, repliedAt: true } } },
  })).filter(isGenuine);
  const repliers = [...new Set(replyMsgs.map((m) => m.application.userId))];
  const priorGenuine = new Set((await prisma.message.findMany({
    where: { from: 'user', createdAt: { lt: ds }, application: { repliedAt: { not: null } } },
    select: { createdAt: true, application: { select: { userId: true, repliedAt: true } } },
  })).filter(isGenuine).map((m) => m.application.userId));
  let newR = 0, retR = 0;
  for (const uid of repliers) priorGenuine.has(uid) ? retR++ : newR++;

  console.log([
    `⭐ ${fmt(nsmToday)} NSM сегодня | ${fmt(nsmTotal)} всего`,
    `👥 ${fmt(usersTotal)} юзеров | 🔄 ${fmt(loopsTotal)} лупов | 📱 ${fmt(tgTotal)} TG`,
    `📤 ${fmt(sentToday)} отправлено → ${fmt(sentProjects)} проектов`,
    `📥 саплай: 🔗 LinkedIn ${fmt(liToday)} · 🏢 ATS ${fmt(atsToday)} (${fmt(oppsToday)} всего)`,
    `💬 ${fmt(recruiterReplies)} ответов рекрутеров`,
    `👤 ${fmt(gotReply)} юзеров получили ответ`,
    `✍️ ${fmt(repliers.length)} ответили рекрутерам (${newR} новых + ${retR} ret)`,
    `📝 ${fmt(regs)} регистраций${regs ? ` → ${fmt(appliesFromRegs)} откликов от них` : ''}`,
    `🏢 ${fmt(recruitersTotal)} рекрутеров на портале`,
    `💰 ${fmt(rateTotal)} юзеров указали rate`,
    `🏆 ${fmt(interviews)} интервью, ${fmt(offers)} офферов`,
  ].join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
