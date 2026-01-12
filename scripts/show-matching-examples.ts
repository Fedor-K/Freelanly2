import { prisma } from '../src/lib/db';

async function showExamples() {
  // Get 15 different translation jobs with languages
  const jobs = await prisma.job.findMany({
    where: {
      category: { slug: 'translation' },
      OR: [
        { sourceLanguages: { isEmpty: false } },
        { targetLanguages: { isEmpty: false } }
      ]
    },
    select: {
      title: true,
      sourceLanguages: true,
      targetLanguages: true,
    },
    take: 15,
    orderBy: { createdAt: 'desc' }
  });

  // Get ALL alerts with language pairs
  const alerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      languagePairs: { some: {} },
      user: { emailVerified: { not: null } }
    },
    include: {
      languagePairs: true,
      user: { select: { email: true } }
    }
  });

  for (const job of jobs) {
    console.log('\n' + '='.repeat(80));
    console.log('JOB:', job.title);
    console.log('Source languages:', job.sourceLanguages.length > 0 ? job.sourceLanguages.join(', ') : '(none)');
    console.log('Target languages:', job.targetLanguages.length > 0 ? job.targetLanguages.join(', ') : '(none)');

    // Collect job languages + implicit EN
    const jobLangs = new Set([...job.sourceLanguages, ...job.targetLanguages]);
    if (!jobLangs.has('EN') && jobLangs.size > 0) jobLangs.add('EN');

    // Collect non-EN languages from the job
    const jobNonEnLangs = new Set<string>();
    for (const lang of job.sourceLanguages) {
      if (lang !== 'EN') jobNonEnLangs.add(lang);
    }
    for (const lang of job.targetLanguages) {
      if (lang !== 'EN') jobNonEnLangs.add(lang);
    }

    // Determine if this is a multilingual job or specific pair job
    const hasNonEnSource = job.sourceLanguages.some(l => l !== 'EN');
    const isSpecificPairJob = hasNonEnSource;

    console.log('All job languages (with implicit EN):', Array.from(jobLangs).join(', '));
    console.log('Non-EN languages:', Array.from(jobNonEnLangs).join(', ') || '(none)');
    console.log('Job type:', isSpecificPairJob ? 'SPECIFIC PAIR (need ALL languages)' : 'MULTILINGUAL (need ANY language)');

    console.log('\nALL matching users:');

    const matches: Array<{email: string; userLangs: string; matchingLangs: string; pairs: string}> = [];
    for (const alert of alerts) {
      // Extract user languages (without EN)
      const userLangs = new Set<string>();
      for (const lp of alert.languagePairs) {
        if (lp.sourceLanguage !== 'EN') userLangs.add(lp.sourceLanguage);
        if (lp.targetLanguage !== 'EN') userLangs.add(lp.targetLanguage);
      }

      // Check matching based on job type
      let isMatch = false;
      if (isSpecificPairJob) {
        // User must have ALL non-EN languages from the job
        isMatch = Array.from(jobNonEnLangs).every(l => userLangs.has(l));
      } else {
        // User needs ANY of the non-EN languages
        isMatch = Array.from(jobNonEnLangs).some(l => userLangs.has(l));
      }

      if (isMatch) {
        const email = alert.user?.email || alert.email;
        const pairs = alert.languagePairs.map(p => p.sourceLanguage + '->' + p.targetLanguage).join(', ');
        const matchingLangs = Array.from(userLangs).filter(l => jobNonEnLangs.has(l));
        matches.push({
          email: email,
          userLangs: Array.from(userLangs).join(', '),
          matchingLangs: matchingLangs.join(', '),
          pairs: pairs
        });
      }
    }

    if (matches.length === 0) {
      console.log('  (no matching users)');
    } else {
      matches.forEach(m => {
        console.log('  Email:', m.email);
        console.log('    User languages:', m.userLangs);
        console.log('    Matching:', m.matchingLangs);
        console.log('    Pairs:', m.pairs);
        console.log('');
      });
      console.log('  Total:', matches.length, 'users');
    }
  }
}

showExamples()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
