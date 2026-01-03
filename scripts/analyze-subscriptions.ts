import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyze() {
  // 1. Users by creation date
  console.log("=== User Registration Timeline (last 30 days) ===");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, plan: true, stripeId: true }
  });

  // Group by date
  const byDate: Record<string, { total: number; pro: number; stripe: number }> = {};
  users.forEach(u => {
    const date = u.createdAt.toISOString().slice(0,10);
    if (!byDate[date]) byDate[date] = { total: 0, pro: 0, stripe: 0 };
    byDate[date].total++;
    if (u.plan === "PRO") byDate[date].pro++;
    if (u.stripeId) byDate[date].stripe++;
  });

  console.log("Date       | Total | PRO | Stripe");
  Object.keys(byDate).sort().reverse().forEach(date => {
    const d = byDate[date];
    console.log(`${date} | ${String(d.total).padStart(5)} | ${String(d.pro).padStart(3)} | ${String(d.stripe).padStart(3)}`);
  });

  // 2. All PRO users
  console.log("\n=== All PRO Users ===");
  const proUsers = await prisma.user.findMany({
    where: { plan: "PRO" },
    select: { email: true, createdAt: true, stripeId: true, stripeSubscriptionId: true },
    orderBy: { createdAt: "desc" }
  });
  proUsers.forEach(u => {
    console.log(`${u.createdAt.toISOString().slice(0,10)} | ${u.email} | sub: ${u.stripeSubscriptionId ? "active" : "none"}`);
  });

  // 3. Revenue timeline
  console.log("\n=== Revenue Events ===");
  const events = await prisma.revenueEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 30
  });
  events.forEach(e => {
    console.log(`${e.createdAt.toISOString().slice(0,10)} | ${e.type}`);
  });

  // 4. Conversion funnel
  console.log("\n=== Conversion Funnel ===");
  const totalUsers = await prisma.user.count();
  const usersWithStripe = await prisma.user.count({ where: { stripeId: { not: null } } });
  const usersWithSub = await prisma.user.count({ where: { stripeSubscriptionId: { not: null } } });
  const proUsers2 = await prisma.user.count({ where: { plan: "PRO" } });

  console.log(`Total users: ${totalUsers}`);
  console.log(`Started checkout (has stripeId): ${usersWithStripe} (${(usersWithStripe/totalUsers*100).toFixed(1)}%)`);
  console.log(`Has subscription ID: ${usersWithSub} (${(usersWithSub/totalUsers*100).toFixed(1)}%)`);
  console.log(`Currently PRO: ${proUsers2} (${(proUsers2/totalUsers*100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

analyze().catch(console.error);
