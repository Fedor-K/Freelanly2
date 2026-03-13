/**
 * Test: send job alert email to specific user using new pull model
 * Usage: npx tsx scripts/test-send-alert.ts post.alexeyh@gmail.com
 */
import { PrismaClient } from '@prisma/client';
import { sendOpportunityAlertNotification } from '@/services/alert-notifications';

const prisma = new PrismaClient();
const targetEmail = process.argv[2] || 'post.alexeyh@gmail.com';

async function main() {
  console.log(`Sending test alert to: ${targetEmail}\n`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, plan: true }
  });
  if (!user) { console.error('User not found'); return; }

  const alert = await prisma.jobAlert.findFirst({
    where: { userId: user.id, isActive: true },
    include: { languagePairs: true }
  });
  if (!alert) { console.error('No active alert'); return; }

  console.log(`Alert: category=${alert.category}, lastSentAt=${alert.lastSentAt}`);

  const since = new Date('2026-03-13T00:00:00Z'); // начиная с сегодня
  const opps = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      postedAt: { gte: since },
      ...(alert.category ? { category: { slug: alert.category } } : {}),
    },
    include: { category: { select: { slug: true } } },
    orderBy: { postedAt: 'desc' },
    take: 50,
  });

  console.log(`Found ${opps.length} opportunities since ${since}`);

  if (opps.length === 0) { console.log('Nothing to send'); return; }

  const result = await sendOpportunityAlertNotification({
    alertId: alert.id,
    email: targetEmail,
    userPlan: user.plan,
    category: alert.category,
    opportunities: opps.map(o => ({
      id: o.id,
      title: o.title,
      slug: o.slug,
      description: o.description,
      clientName: o.clientName,
      clientAvatar: o.clientAvatar,
      country: o.country,
      level: o.level,
      salaryMin: o.salaryMin,
      salaryMax: o.salaryMax,
      salaryCurrency: o.salaryCurrency,
      postedAt: o.postedAt,
    })),
  });

  console.log('Result:', result);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
