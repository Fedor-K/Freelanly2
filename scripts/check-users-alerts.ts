import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Users with empty alerts
  const userIds = [
    'cmjk6hznq00j1avphzif9ie96',
    'cmjk6hzlo00iyavphq192ssoh',
    'cmjk6hzjg00ivavphvdua7usz',
    'cmjk6hzhe00isavphgibyj2n9',
    'cmjk6fuoq008bt3ajamuiei5a'
  ];

  for (const userId of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, createdAt: true }
    });

    const alerts = await prisma.jobAlert.findMany({
      where: { userId },
      select: { category: true, keywords: true, country: true, isActive: true },
    });

    console.log(user?.email);
    alerts.forEach(a => {
      const hasFilters = a.category || a.keywords || a.country;
      if (hasFilters) {
        console.log("  - " + (a.category ? a.category : "no-cat") + " | active=" + a.isActive);
      } else {
        console.log("  - ПУСТОЙ | active=" + a.isActive);
      }
    });
    console.log("");
  }

  await prisma.$disconnect();
}
check().catch(console.error);
