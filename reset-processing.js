const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  let total = 0;
  while(true) {
    const batch = await prisma.alertNotification.findMany({
      where: { status: 'PROCESSING' },
      select: { id: true },
      take: 5000
    });
    if (batch.length === 0) break;
    await prisma.alertNotification.updateMany({
      where: { id: { in: batch.map(b => b.id) } },
      data: { status: 'PENDING' }
    });
    total += batch.length;
    console.log('Reset batch, total:', total);
  }
  console.log('DONE, total reset:', total);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
