import { prisma } from '../src/lib/db';

async function check() {
  // Jobs with French in title or description
  const frenchJobs = await prisma.job.count({
    where: {
      OR: [
        { title: { contains: 'French', mode: 'insensitive' } },
        { description: { contains: 'French', mode: 'insensitive' } },
      ],
      createdAt: { gte: new Date('2025-12-24') }
    }
  });
  
  console.log('Jobs with "French" since Dec 24:', frenchJobs);

  // Show some
  const samples = await prisma.job.findMany({
    where: {
      OR: [
        { title: { contains: 'French', mode: 'insensitive' } },
        { description: { contains: 'French', mode: 'insensitive' } },
      ],
      createdAt: { gte: new Date('2025-12-24') }
    },
    select: { title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('');
  console.log('Samples:');
  for (const j of samples) {
    console.log('-', j.createdAt.toISOString().slice(0,10), '|', j.title);
  }
  
  process.exit(0);
}
check();
