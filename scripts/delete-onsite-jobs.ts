import { prisma } from '../src/lib/db';

async function main() {
  console.log('=== Deleting ONSITE jobs ===\n');

  // Count ONSITE jobs
  const onsiteCount = await prisma.job.count({
    where: { locationType: 'ONSITE' }
  });

  console.log(`Found ${onsiteCount} ONSITE jobs to delete\n`);

  if (onsiteCount === 0) {
    console.log('No ONSITE jobs found. Nothing to delete.');
    return;
  }

  // Get some examples
  const examples = await prisma.job.findMany({
    where: { locationType: 'ONSITE' },
    take: 10,
    include: { company: true },
    orderBy: { createdAt: 'desc' }
  });

  console.log('Examples of jobs to be deleted:');
  for (const job of examples) {
    console.log(`  - ${job.title} at ${job.company.name} (${job.location})`);
  }
  console.log('');

  // Also delete related social queue entries
  const queueDeleted = await prisma.socialPostQueue.deleteMany({
    where: {
      job: { locationType: 'ONSITE' }
    }
  });
  console.log(`Deleted ${queueDeleted.count} social queue entries for ONSITE jobs`);

  // Delete ONSITE jobs
  const deleted = await prisma.job.deleteMany({
    where: { locationType: 'ONSITE' }
  });

  console.log(`\nDeleted ${deleted.count} ONSITE jobs`);

  // Count remaining jobs
  const remaining = await prisma.job.count();
  console.log(`Remaining jobs: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
