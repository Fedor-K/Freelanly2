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

async function main() {
  const ds = new Date();
  ds.setUTCHours(0, 0, 0, 0);
  const notSpam = { replyCategory: { not: 'SPAM' } };

  const [
    sentToday, oppsToday, recruiterRepliesToday, regsFullToday,
    newRecruitersToday, recruitersTotal, tgTotal, interviews, offers,
  ] = await Promise.all([
    // 📤 applications actually sent today
    prisma.autoApplication.count({ where: { sentAt: { gte: ds } } }),
    // 📥 new opportunities scraped into the base today
    prisma.opportunity.count({ where: { createdAt: { gte: ds } } }),
    // 💬 real recruiter replies today (any reply except spam/farming)
    prisma.autoApplication.count({ where: { repliedAt: { gte: ds }, ...notSpam } }),
    // 📝 registrations that completed the FULL cycle today (verified email + résumé + LinkedIn)
    prisma.user.count({ where: { createdAt: { gte: ds }, emailVerified: { not: null }, resumeUrl: { not: null }, linkedinUrl: { not: null } } }),
    prisma.recruiter.count({ where: { registeredAt: { gte: ds } } }),
    prisma.recruiter.count(),
    prisma.user.count({ where: { telegramChatId: { not: null } } }),
    prisma.autoApplication.count({ where: { status: 'INTERVIEW' } }),
    prisma.autoApplication.count({ where: { status: 'OFFER' } }),
  ]);

  // 📤 distinct projects those sends went to
  const sentProjects = await prisma.autoApplication.findMany({
    where: { sentAt: { gte: ds }, opportunityId: { not: null } },
    select: { opportunityId: true }, distinct: ['opportunityId'],
  });

  // 👤 distinct users who got a recruiter reply today
  const gotReply = await prisma.autoApplication.findMany({
    where: { repliedAt: { gte: ds }, ...notSpam },
    select: { userId: true }, distinct: ['userId'],
  });

  // ✍️ users who genuinely replied BACK to a recruiter today (outbound message in a thread the
  // recruiter has already replied to — not the initial outreach). Split new vs returning.
  const replyMsgs = await prisma.message.findMany({
    where: { from: 'user', createdAt: { gte: ds }, application: { repliedAt: { not: null } } },
    select: { application: { select: { userId: true } } },
  });
  const replierUsers = [...new Set(replyMsgs.map((m) => m.application.userId))];
  let newReplier = 0, retReplier = 0;
  for (const uid of replierUsers) {
    const earlier = await prisma.message.count({
      where: { from: 'user', createdAt: { lt: ds }, application: { userId: uid, repliedAt: { not: null } } },
    });
    earlier > 0 ? retReplier++ : newReplier++;
  }

  const lines = [
    `📤 ${fmt(sentToday)} откликов отправлено сегодня → на ${fmt(sentProjects.length)} разных проектов`,
    `📥 ${fmt(oppsToday)} новых проектов добавлено в базу сегодня`,
    `💬 ${fmt(recruiterRepliesToday)} ответов от рекрутеров`,
    `👤 ${fmt(gotReply.length)} юзеров получили ответ`,
    `✍️ ${fmt(replierUsers.length)} юзеров ответили рекрутерам (${newReplier} новых + ${retReplier} ret)`,
    `📝 ${fmt(regsFullToday)} прошли полную регистрацию (почта + резюме + LinkedIn)`,
    `📋 ${fmt(newRecruitersToday)} новых рекрутеров (${fmt(recruitersTotal)} всего)`,
    `📱 ${fmt(tgTotal)} в Telegram`,
    `🏆 ${fmt(interviews)} интервью, ${fmt(offers)} офферов`,
  ];
  console.log(lines.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
