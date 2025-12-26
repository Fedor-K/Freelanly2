import { prisma } from '../src/lib/db';

async function main() {
  console.log('=== Social Post Queue Status ===\n');

  // Get stats
  const [pending, posted, failed] = await Promise.all([
    prisma.socialPostQueue.count({ where: { status: 'PENDING' } }),
    prisma.socialPostQueue.count({ where: { status: 'POSTED' } }),
    prisma.socialPostQueue.count({ where: { status: 'FAILED' } }),
  ]);

  console.log(`Pending: ${pending}`);
  console.log(`Posted: ${posted}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  // Show recent items
  const recent = await prisma.socialPostQueue.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      job: {
        include: {
          company: true
        }
      }
    }
  });

  console.log('=== Recent Queue Items ===\n');
  for (const item of recent) {
    console.log(`ID: ${item.id}`);
    console.log(`Status: ${item.status}`);
    console.log(`Job: ${item.job.title}`);
    console.log(`Company: ${item.job.company.name} (slug: ${item.job.company.slug})`);
    console.log(`Job slug: ${item.job.slug}`);
    console.log(`PostText: ${item.postText ? item.postText.substring(0, 100) + '...' : 'NULL'}`);
    console.log(`Error: ${item.error || 'none'}`);
    console.log(`Created: ${item.createdAt}`);
    console.log(`Posted: ${item.postedAt || 'not posted'}`);
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
