import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const emptyAlerts = await prisma.jobAlert.findMany({
    where: {
      category: null,
      keywords: null,
      country: null,
      level: null,
      languagePairs: { none: {} }
    },
    select: {
      id: true,
      email: true,
      userId: true,
      frequency: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
  
  console.log("Всего пустых алертов:", emptyAlerts.length);
  console.log("");
  
  const withUser = emptyAlerts.filter(a => a.userId);
  const withoutUser = emptyAlerts.filter(a => !a.userId);
  
  console.log("С привязкой к User (через регистрацию):", withUser.length);
  console.log("Без User (через форму/popup):", withoutUser.length);
  console.log("");
  
  if (withUser.length > 0) {
    console.log("--- С User (регистрация) ---");
    withUser.forEach(a => {
      console.log("  " + a.email + " | userId: " + a.userId + " | " + a.createdAt.toISOString().split("T")[0]);
    });
    console.log("");
  }
  
  console.log("--- Без User (форма/exit popup) ---");
  withoutUser.forEach(a => {
    console.log("  " + a.email + " | " + a.createdAt.toISOString().split("T")[0]);
  });
  
  await prisma.$disconnect();
}
check().catch(console.error);
