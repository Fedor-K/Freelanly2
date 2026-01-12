import { prisma } from '../src/lib/db';

async function check() {
  // Get recent sent notifications
  const sent = await prisma.alertNotification.findMany({
    where: {
      status: 'SENT',
      sentAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } // last 10 min
    },
    include: {
      jobAlert: {
        include: {
          user: { select: { email: true } },
          languagePairs: true
        }
      },
      job: { select: { title: true, sourceLanguages: true, targetLanguages: true, category: { select: { slug: true } } } },
      opportunity: { select: { title: true, clientName: true, category: { select: { slug: true } } } }
    },
    orderBy: { sentAt: 'desc' },
    take: 50
  });

  console.log('=== RECENT SENT NOTIFICATIONS (last 10 min) ===');
  console.log('Total:', sent.length);

  // Group by email
  const byEmail: Record<string, typeof sent> = {};
  for (const n of sent) {
    const email = n.jobAlert?.user?.email || n.jobAlert?.email || 'unknown';
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(n);
  }

  console.log('\nUnique recipients:', Object.keys(byEmail).length);

  // Show first 10 recipients
  let count = 0;
  for (const [email, notifications] of Object.entries(byEmail)) {
    if (count++ >= 10) break;

    console.log('\n---');
    console.log('Email:', email);
    console.log('Notifications:', notifications.length);

    // Show user's languages
    const alert = notifications[0].jobAlert;
    if (alert?.languagePairs && alert.languagePairs.length > 0) {
      const userLangs = new Set<string>();
      for (const p of alert.languagePairs) {
        if (p.sourceLanguage !== 'EN') userLangs.add(p.sourceLanguage);
        if (p.targetLanguage !== 'EN') userLangs.add(p.targetLanguage);
      }
      console.log('User languages:', Array.from(userLangs).join(', ') || 'none');
    } else {
      console.log('User languages: (no language filter)');
    }

    // Show items sent
    for (const n of notifications.slice(0, 3)) {
      const item = n.job || n.opportunity;
      if (n.job) {
        console.log(`  - Job: ${n.job.title}`);
        console.log(`    Category: ${n.job.category?.slug}, Langs: ${n.job.sourceLanguages.join(',')} -> ${n.job.targetLanguages.join(',')}`);
      } else if (n.opportunity) {
        console.log(`  - Opp: ${n.opportunity.title}`);
        console.log(`    Category: ${n.opportunity.category?.slug}`);
      }
    }
    if (notifications.length > 3) {
      console.log(`  ... and ${notifications.length - 3} more`);
    }
  }

  // Check pending notifications
  const pending = await prisma.alertNotification.count({
    where: { status: 'PENDING' }
  });
  console.log('\n=== PENDING NOTIFICATIONS ===');
  console.log('Count:', pending);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
