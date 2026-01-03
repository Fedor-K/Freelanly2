import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Check recent import logs
  const logs = await prisma.importLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 15,
    include: { dataSource: { select: { name: true, sourceType: true } } }
  });

  console.log('=== Recent Import Logs ===\n');

  for (const log of logs) {
    const isRunning = !log.completedAt;
    const status = isRunning ? 'RUNNING' : (log.status || 'COMPLETED');
    const startTime = new Date(log.startedAt).getTime();
    const endTime = log.completedAt ? new Date(log.completedAt).getTime() : Date.now();
    const durationSec = Math.round((endTime - startTime) / 1000);
    const durationStr = isRunning ? `${durationSec}s (still running)` : `${durationSec}s`;

    console.log(`Source: ${log.dataSource?.name || 'Unknown'} (${log.dataSource?.sourceType || '?'})`);
    console.log(`Status: ${status} | Duration: ${durationStr}`);
    console.log(`Started: ${log.startedAt.toISOString()}`);
    console.log(`Created: ${log.jobsCreated} | Skipped: ${log.jobsSkipped} | Failed: ${log.jobsFailed}`);
    if (log.error) {
      console.log(`Error: ${log.error}`);
    }
    console.log('---\n');
  }

  // Check if any are stuck (running > 30 min)
  const stuck = logs.filter(l => {
    if (l.completedAt) return false;
    const runningMs = Date.now() - new Date(l.startedAt).getTime();
    return runningMs > 30 * 60 * 1000;
  });

  if (stuck.length > 0) {
    console.log(`\n⚠️ STUCK IMPORTS (running > 30 min): ${stuck.length}`);
    for (const s of stuck) {
      console.log(`  - ${s.dataSource?.name} started at ${s.startedAt}`);
    }
  }

  // Check today's imports
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayLogs = await prisma.importLog.findMany({
    where: { startedAt: { gte: today } },
    include: { dataSource: { select: { name: true, sourceType: true } } }
  });

  console.log(`\n=== Today's Summary ===`);
  console.log(`Total imports attempted: ${todayLogs.length}`);

  const completed = todayLogs.filter(l => l.completedAt);
  const running = todayLogs.filter(l => !l.completedAt);

  console.log(`Completed: ${completed.length}`);
  console.log(`Still running: ${running.length}`);

  const totalCreated = todayLogs.reduce((sum, l) => sum + l.jobsCreated, 0);
  const totalSkipped = todayLogs.reduce((sum, l) => sum + l.jobsSkipped, 0);
  const totalFailed = todayLogs.reduce((sum, l) => sum + l.jobsFailed, 0);

  console.log(`Jobs created today: ${totalCreated}`);
  console.log(`Jobs skipped today: ${totalSkipped}`);
  console.log(`Jobs failed today: ${totalFailed}`);

  await prisma.$disconnect();
}

check().catch(console.error);
