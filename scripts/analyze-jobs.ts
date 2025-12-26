import { prisma } from '../src/lib/db';

async function main() {
  // Get job titles grouped by category
  const jobs = await prisma.job.findMany({
    select: {
      title: true,
      locationType: true,
      location: true,
      skills: true,
      category: { select: { slug: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  console.log('=== Recent 100 Jobs Analysis ===\n');

  // Group by category
  const byCategory: Record<string, string[]> = {};
  for (const job of jobs) {
    const cat = job.category?.slug || 'unknown';
    if (!byCategory[cat]) byCategory[cat] = [];
    const skillsStr = job.skills?.slice(0, 3).join(', ') || 'none';
    byCategory[cat].push(`${job.title} | ${job.locationType} | skills: ${skillsStr}`);
  }

  for (const [cat, titles] of Object.entries(byCategory).sort()) {
    console.log(`\n--- ${cat.toUpperCase()} (${titles.length}) ---`);
    titles.slice(0, 5).forEach(t => console.log(`  ${t}`));
    if (titles.length > 5) console.log(`  ... and ${titles.length - 5} more`);
  }

  // Check for potentially non-remote-friendly jobs
  console.log('\n\n=== Potentially Non-Remote-Friendly Jobs ===\n');

  const suspiciousPatterns = [
    /driver/i, /warehouse/i, /delivery/i, /courier/i,
    /field.*collector/i, /retail/i, /store/i, /cashier/i,
    /receptionist/i, /front.?desk/i, /security.?guard/i,
    /janitor/i, /cleaner/i, /cook/i, /chef/i, /waiter/i,
    /nurse/i, /caregiver/i, /mechanic/i, /electrician/i,
    /construction/i, /assembly/i, /manufacturing/i
  ];

  const suspicious = jobs.filter(job =>
    suspiciousPatterns.some(p => p.test(job.title))
  );

  if (suspicious.length === 0) {
    console.log('No suspicious jobs found in recent 100 jobs.');
  } else {
    console.log(`Found ${suspicious.length} potentially non-remote-friendly jobs:`);
    suspicious.forEach(job => {
      console.log(`  - ${job.title} | ${job.locationType} | ${job.location}`);
    });
  }

  // Show location type distribution
  console.log('\n\n=== Location Type Distribution ===\n');
  const locationTypes = await prisma.job.groupBy({
    by: ['locationType'],
    _count: true
  });

  for (const lt of locationTypes) {
    console.log(`  ${lt.locationType}: ${lt._count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
