import { prisma } from '../src/lib/db';
import { shouldSkipJob } from '../src/lib/job-filter';

async function main() {
  // Get ALL jobs
  const allJobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      location: true,
      locationType: true,
      source: true,
      company: { select: { name: true } }
    }
  });

  console.log('Total jobs in database:', allJobs.length);

  const toDelete: { id: string; title: string; location: string | null; reason: string; company: string; source: string | null }[] = [];

  for (const job of allJobs) {
    const filterResult = shouldSkipJob({
      title: job.title,
      location: job.location,
      locationType: job.locationType,
    });

    if (filterResult.skip) {
      toDelete.push({
        id: job.id,
        title: job.title,
        location: job.location,
        reason: filterResult.reason || 'unknown',
        company: job.company.name,
        source: job.source
      });
    }
  }

  console.log('\nJobs to delete:', toDelete.length);

  // Group by reason
  const byReason: Record<string, number> = {};
  for (const job of toDelete) {
    byReason[job.reason] = (byReason[job.reason] || 0) + 1;
  }
  console.log('\nBy reason:');
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }

  // Group by source
  const bySource: Record<string, number> = {};
  for (const job of toDelete) {
    const source = job.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  }
  console.log('\nBy source:');
  for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}`);
  }

  console.log('\n=== JOBS TO DELETE (first 50) ===');
  toDelete.slice(0, 50).forEach(j => {
    console.log(`[${j.reason}] [${j.source}] ${j.company}: ${j.title} (${j.location})`);
  });

  if (toDelete.length > 50) {
    console.log(`\n... and ${toDelete.length - 50} more`);
  }

  if (toDelete.length > 0) {
    const deleted = await prisma.job.deleteMany({
      where: { id: { in: toDelete.map(j => j.id) } }
    });
    console.log(`\n✅ Deleted ${deleted.count} jobs`);
  } else {
    console.log('\n✅ No jobs to delete');
  }

  // Final count
  const remaining = await prisma.job.count();
  console.log(`\nRemaining jobs: ${remaining}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
