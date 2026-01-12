import { prisma } from '../src/lib/db';

async function check() {
  // Find the job or opportunity
  const searchTitle = process.argv[2] || 'English-Dutch';
  const job = await prisma.job.findFirst({
    where: { title: { contains: searchTitle } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      category: { select: { slug: true, name: true } },
      sourceLanguages: true,
      targetLanguages: true,
      translationTypes: true,
      createdAt: true,
    }
  });

  const opp = await prisma.opportunity.findFirst({
    where: { title: { contains: searchTitle } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      category: { select: { slug: true, name: true } },
      sourceLanguages: true,
      targetLanguages: true,
      translationTypes: true,
      createdAt: true,
    }
  });

  const item = job || opp;
  const itemType = job ? 'JOB' : 'OPPORTUNITY';

  if (!item) {
    console.log('Not found:', searchTitle);
    return;
  }

  console.log(`Found ${itemType}:`);
  console.log(JSON.stringify(item, null, 2));

  // Find matching alerts
  const alerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      frequency: 'INSTANT',
      user: { emailVerified: { not: null } }
    },
    include: {
      languagePairs: true,
      user: { select: { email: true } }
    }
  });

  console.log('\n--- Alerts that would match ---');
  let matchCount = 0;

  for (const alert of alerts) {
    // Check category match
    if (alert.category && alert.category !== item.category.slug) continue;

    // Check language pairs (smart matching: ANY for multilingual, ALL for specific pairs)
    if (alert.languagePairs.length > 0) {
      if (item.category.slug !== 'translation') continue;

      // Collect all languages from job
      const jobLanguages = new Set([...item.sourceLanguages, ...item.targetLanguages]);
      if (jobLanguages.size === 0) continue;
      if (!jobLanguages.has('EN')) jobLanguages.add('EN');

      // Collect non-EN languages from the job
      const jobNonEnLanguages = new Set<string>();
      for (const lang of item.sourceLanguages) {
        if (lang !== 'EN') jobNonEnLanguages.add(lang);
      }
      for (const lang of item.targetLanguages) {
        if (lang !== 'EN') jobNonEnLanguages.add(lang);
      }

      // Extract user's languages (excluding EN)
      const userLanguages = new Set<string>();
      for (const lp of alert.languagePairs) {
        if (lp.sourceLanguage !== 'EN') userLanguages.add(lp.sourceLanguage);
        if (lp.targetLanguage !== 'EN') userLanguages.add(lp.targetLanguage);
      }

      // Determine matching strategy
      const hasNonEnSource = item.sourceLanguages.some(l => l !== 'EN');
      const isSpecificPairJob = hasNonEnSource;

      let hasMatch = false;
      if (isSpecificPairJob) {
        // User must have ALL non-EN languages
        hasMatch = Array.from(jobNonEnLanguages).every(lang => userLanguages.has(lang));
      } else {
        // User needs ANY non-EN language
        hasMatch = Array.from(jobNonEnLanguages).some(lang => userLanguages.has(lang));
      }
      if (!hasMatch) continue;
    }

    matchCount++;
    const email = alert.email || alert.user?.email;
    const pairs = alert.languagePairs.map(lp => `${lp.sourceLanguage}->${lp.targetLanguage}`).join(', ');
    console.log(`Email: ${email} | Category: ${alert.category || 'any'} | Pairs: ${pairs || 'none'}`);
  }

  console.log(`\nTotal matching alerts: ${matchCount}`);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
