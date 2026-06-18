/**
 * Daily stat — one-shot operational snapshot for "какая стата".
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/daily-stat.js
 *
 * "Сегодня" = the current UTC calendar day (matches the cron schedule, which runs on UTC).
 * Reply-based lines (💬/👤/✍️) accumulate through the day — they read 0 early in the UTC morning.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fmt = (n) => Number(n).toLocaleString('en-US');

// Geo brush-offs ("I need a Canada-based candidate", "only for candidates based in LATAM") are
// rejections, not real engagement — excluded from 💬/👤 (Fedor 2026-06-17). Same pattern the
// categorizer uses. SPAM is already filtered separately.
const GEO_REJECT_RE = /(?:\b(?:need|looking for|require|want|seeking|prefer)\b[^.\n]{0,30}\bbased\b[^.\n]{0,15}\bcandidate)|(?:\bavailable only (?:for|to)\b[^.\n]{0,40}\bcandidate)|(?:\bonly (?:for|to|open to|available (?:for|to))\b[^.\n]{0,30}\bcandidates?\b[^.\n]{0,30}\b(?:based|located|in)\b)|(?:\bcandidates?\b[^.\n]{0,25}\b(?:must|need to|should|have to)\b[^.\n]{0,12}\bbe\b[^.\n]{0,15}\b(?:based|located)\b)/i;
const isGeoReject = (t) => GEO_REJECT_RE.test(t || '');
// Farm form-collectors (Google Form / WhatsApp-channel "recruiters", e.g. Wyreflow) — not real
// engagement; excluded from 💬/👤. Belt-and-suspenders for rows stored before the inbound filter
// caught them. Same pattern the live inbound-server + webhook use.
const FARM_FORM_RE = /forms\.gle\/|docs\.google\.com\/forms|\bgoogle\s+form\b|\b(?:complete|fill\s*(?:out|in)?|submit)\b[^.\n]{0,40}\b(?:internship\s+)?application\s+form\b|whatsapp\.com\/channel\//i;
const isFarmForm = (t) => FARM_FORM_RE.test(t || '');

async function main() {
  const ds = new Date();
  ds.setUTCHours(0, 0, 0, 0);
  const notSpam = { replyCategory: { not: 'SPAM' } };

  const [
    sentToday, oppsToday, repliedRowsToday, fullRegUsers,
    newRecruitersToday, recruitersTotal, interviews, offers,
  ] = await Promise.all([
    // 📤 applications actually sent today
    prisma.autoApplication.count({ where: { sentAt: { gte: ds } } }),
    // 📥 new opportunities scraped into the base today
    prisma.opportunity.count({ where: { createdAt: { gte: ds } } }),
    // 💬 recruiter replies today (non-spam) — fetched with text so geo brush-offs can be filtered out
    prisma.autoApplication.findMany({ where: { repliedAt: { gte: ds }, ...notSpam }, select: { userId: true, replyText: true } }),
    // 📝 registrations that completed the FULL cycle today (verified email + résumé + LinkedIn)
    prisma.user.findMany({ where: { createdAt: { gte: ds }, emailVerified: { not: null }, resumeUrl: { not: null }, linkedinUrl: { not: null } }, select: { id: true } }),
    prisma.recruiter.count({ where: { registeredAt: { gte: ds } } }),
    prisma.recruiter.count(),
    prisma.autoApplication.count({ where: { status: 'INTERVIEW' } }),
    prisma.autoApplication.count({ where: { status: 'OFFER' } }),
  ]);

  // 📝 how many applications actually went out FROM today's full-cycle registrants
  const regsFullToday = fullRegUsers.length;
  const appliesFromFullRegs = await prisma.autoApplication.count({
    where: { userId: { in: fullRegUsers.map((u) => u.id) }, sentAt: { not: null } },
  });

  // 📤 distinct projects those sends went to
  const sentProjects = await prisma.autoApplication.findMany({
    where: { sentAt: { gte: ds }, opportunityId: { not: null } },
    select: { opportunityId: true }, distinct: ['opportunityId'],
  });

  // 💬 real recruiter replies = non-spam minus geo brush-offs ("need a Canada-based candidate")
  // and farm form-collectors (Google Form / WhatsApp-channel mass templates)
  const realReplies = repliedRowsToday.filter((r) => !isGeoReject(r.replyText) && !isFarmForm(r.replyText));
  const recruiterRepliesToday = realReplies.length;
  // 👤 distinct users who got a REAL (non-geo) recruiter reply today
  const gotReply = [...new Set(realReplies.map((r) => r.userId))];

  // ✍️ users who genuinely replied BACK to a recruiter today (outbound message in a thread the
  // recruiter has already replied to — not the initial outreach). Split new vs returning.
  // A from='user' message is the candidate's REPLY only if it was written AFTER the recruiter replied.
  // The initial outreach (cover letter) is ALSO stored as a from='user' message (at send time, BEFORE
  // repliedAt) — counting that as a "reply" is the bug that made this metric fake. So: genuine reply =
  // user message with createdAt > application.repliedAt.
  const isGenuine = (m) => m.application.repliedAt && m.createdAt.getTime() > m.application.repliedAt.getTime() + 1000;
  const replyMsgs = (await prisma.message.findMany({
    where: { from: 'user', createdAt: { gte: ds }, application: { repliedAt: { not: null } } },
    select: { createdAt: true, application: { select: { userId: true, repliedAt: true } } },
  })).filter(isGenuine);
  const replierUsers = [...new Set(replyMsgs.map((m) => m.application.userId))];
  // new vs returning: did this user ever genuinely reply (msg after repliedAt) BEFORE today?
  const priorGenuine = new Set((await prisma.message.findMany({
    where: { from: 'user', createdAt: { lt: ds }, application: { repliedAt: { not: null } } },
    select: { createdAt: true, application: { select: { userId: true, repliedAt: true } } },
  })).filter(isGenuine).map((m) => m.application.userId));
  let newReplier = 0, retReplier = 0;
  for (const uid of replierUsers) priorGenuine.has(uid) ? retReplier++ : newReplier++;

  const lines = [
    `📤 ${fmt(sentToday)} откликов отправлено сегодня → на ${fmt(sentProjects.length)} разных проектов`,
    `📥 ${fmt(oppsToday)} новых проектов добавлено в базу сегодня`,
    `💬 ${fmt(recruiterRepliesToday)} ответов от рекрутеров`,
    `👤 ${fmt(gotReply.length)} юзеров получили ответ`,
    `✍️ ${fmt(replierUsers.length)} юзеров ответили рекрутерам (${newReplier} новых + ${retReplier} ret)`,
    `📝 ${fmt(regsFullToday)} прошли полную регистрацию (почта + резюме + LinkedIn) → от них ушло ${fmt(appliesFromFullRegs)} откликов`,
    `📋 ${fmt(newRecruitersToday)} новых рекрутеров (${fmt(recruitersTotal)} всего)`,
    `🏆 ${fmt(interviews)} интервью, ${fmt(offers)} офферов`,
  ];
  console.log(lines.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
