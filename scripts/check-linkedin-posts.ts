import { prisma } from '../src/lib/db';
import { isJobPosting } from '../src/lib/ai';

async function checkPosts() {
  // Get recent LinkedIn jobs with their original content
  const jobs = await prisma.job.findMany({
    where: {
      source: 'LINKEDIN',
      originalContent: { not: null },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      originalContent: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  console.log('Found', jobs.length, 'LinkedIn jobs with original content\n');

  const notJobs: Array<{
    id: string;
    title: string;
    slug: string;
    reason: string;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    console.log(`[${i + 1}/${jobs.length}] Checking: ${job.title.substring(0, 50)}...`);

    const result = await isJobPosting(job.originalContent!);

    if (!result.isJob) {
      notJobs.push({
        id: job.id,
        title: job.title,
        slug: job.slug,
        reason: result.reason,
        createdAt: job.createdAt,
      });
      console.log(`   ❌ NOT_JOB: ${result.reason}`);
    }
  }

  console.log('\n========================================');
  console.log('Total checked:', jobs.length);
  console.log('Not job posts:', notJobs.length);

  if (notJobs.length > 0) {
    console.log('\n--- Posts to delete ---');
    for (const item of notJobs) {
      console.log(`ID: ${item.id}`);
      console.log(`Title: ${item.title}`);
      console.log(`Reason: ${item.reason}`);
      console.log(`Created: ${item.createdAt.toISOString()}`);
      console.log('');
    }
  }

  return notJobs;
}

checkPosts()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
