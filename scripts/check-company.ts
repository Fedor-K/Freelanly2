import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check(slug: string) {
  const company = await prisma.company.findFirst({
    where: { slug },
    include: { _count: { select: { jobs: true } } }
  });

  if (company === null) {
    console.log('Company not found');
    return;
  }

  console.log('Company:', company.name, '| Total jobs:', company._count.jobs);

  const maxAgeDate = new Date();
  maxAgeDate.setDate(maxAgeDate.getDate() - 7);

  const jobs = await prisma.job.findMany({
    where: { companyId: company.id },
    select: { title: true, postedAt: true, isActive: true },
    orderBy: { postedAt: 'desc' },
    take: 10
  });

  console.log('\nMax age date (7 days ago):', maxAgeDate.toISOString().split('T')[0]);
  console.log('\nJobs:');
  for (const job of jobs) {
    const fresh = job.postedAt >= maxAgeDate;
    console.log(
      (fresh ? 'FRESH' : 'OLD  ') + ' | ' +
      job.postedAt.toISOString().split('T')[0] + ' | ' +
      'active:' + job.isActive + ' | ' +
      job.title.slice(0, 40)
    );
  }
}

const slug = process.argv[2] || 'yuno';
check(slug);
