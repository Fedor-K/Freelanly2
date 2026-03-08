/**
 * Debug: check import task queue state
 * DELETE after use
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const SETUP_KEY = 'fr33lanly-setup-2026';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== SETUP_KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
  }

  const [
    pendingCount,
    processingCount,
    pendingRetry3Plus,
    samplePending,
    sampleProcessing,
    recentCompleted,
    activeSourcesCount,
    lastImports,
  ] = await Promise.all([
    prisma.importTask.count({ where: { status: 'PENDING' } }),
    prisma.importTask.count({ where: { status: 'PROCESSING' } }),
    prisma.importTask.count({ where: { status: 'PENDING', retryCount: { gte: 3 } } }),
    prisma.importTask.findMany({
      where: { status: 'PENDING' },
      select: { id: true, retryCount: true, maxRetries: true, createdAt: true, error: true, dataSource: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
    prisma.importTask.findMany({
      where: { status: 'PROCESSING' },
      select: { id: true, startedAt: true, dataSource: { select: { name: true } } },
      take: 5,
    }),
    prisma.importLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { startedAt: true, completedAt: true, status: true, totalNew: true, totalSkipped: true, totalFailed: true, error: true },
    }),
    prisma.dataSource.count({ where: { isActive: true } }),
    prisma.importLog.findMany({
      where: { startedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: { startedAt: true, status: true, totalNew: true, totalSkipped: true, totalFailed: true, error: true },
    }),
  ]);

  return NextResponse.json({
    queue: {
      pending: pendingCount,
      processing: processingCount,
      pendingWithRetry3Plus: pendingRetry3Plus,
      note: pendingRetry3Plus === pendingCount ? 'ALL pending tasks have retryCount >= 3 — they will be SKIPPED by fetch-sources!' : 'Some tasks have retryCount < 3',
    },
    samplePending,
    sampleProcessing,
    activeSources: activeSourcesCount,
    recentImportLogs: recentCompleted,
    last3DaysImports: lastImports,
  });
}
