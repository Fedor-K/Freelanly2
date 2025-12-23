import { prisma } from '../src/lib/db';

async function main() {
  // Find the BSM job
  const job = await prisma.job.findFirst({
    where: { slug: 'technical-superintendent-cruise-passenger-vessels-bsm' },
    include: { company: true }
  });

  if (!job) {
    console.log('Job not found');
    return;
  }

  console.log('Found job:', job.title);
  console.log('Company:', job.company.name);

  // Delete the job first
  await prisma.job.delete({ where: { id: job.id } });
  console.log('Job deleted');

  // Check if company has other jobs
  const remainingJobs = await prisma.job.count({
    where: { companyId: job.company.id }
  });

  if (remainingJobs === 0) {
    await prisma.company.delete({ where: { id: job.company.id } });
    console.log('Company BSM deleted (no remaining jobs)');
  } else {
    console.log(`Company BSM kept (has ${remainingJobs} other jobs)`);
  }

  console.log('\nDone! The job will be re-imported with correct company name from email domain.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
