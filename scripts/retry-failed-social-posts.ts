import { prisma } from '../src/lib/db';

async function main() {
  console.log('=== Resetting FAILED social posts to PENDING ===\n');

  const failed = await prisma.socialPostQueue.findMany({
    where: { status: 'FAILED' },
    include: {
      job: {
        include: { company: true }
      }
    }
  });

  console.log(`Found ${failed.length} failed posts\n`);

  for (const item of failed) {
    console.log(`Resetting: ${item.job.title} (${item.job.company.name})`);
    console.log(`  Previous error: ${item.error}`);

    await prisma.socialPostQueue.update({
      where: { id: item.id },
      data: {
        status: 'PENDING',
        error: null,
        postText: null, // Clear cached text so it regenerates with new prompt
      }
    });
  }

  console.log('\nDone! Run the cron endpoint to process them.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
