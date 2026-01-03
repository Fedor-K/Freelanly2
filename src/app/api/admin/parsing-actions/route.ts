import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const STUCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Admin actions for parsing management
 *
 * POST /api/admin/parsing-actions
 * Body: { action: 'reset-stuck' | 'start-parsing' | 'reset-all' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'reset-stuck': {
        // Reset tasks stuck in PROCESSING for more than 30 minutes
        const stuckThreshold = new Date(Date.now() - STUCK_TIMEOUT);

        const result = await prisma.importTask.updateMany({
          where: {
            status: 'PROCESSING',
            startedAt: { lt: stuckThreshold },
          },
          data: {
            status: 'PENDING',
            startedAt: null,
            error: null,
          },
        });

        return NextResponse.json({
          success: true,
          action: 'reset-stuck',
          count: result.count,
          message: `Сброшено ${result.count} зависших задач`,
        });
      }

      case 'reset-all': {
        // Reset ALL processing tasks (force reset)
        const result = await prisma.importTask.updateMany({
          where: { status: 'PROCESSING' },
          data: {
            status: 'PENDING',
            startedAt: null,
            error: null,
          },
        });

        return NextResponse.json({
          success: true,
          action: 'reset-all',
          count: result.count,
          message: `Сброшено ${result.count} задач`,
        });
      }

      case 'start-parsing': {
        // Trigger parsing via internal call to cron endpoint
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          return NextResponse.json({
            success: false,
            error: 'CRON_SECRET not configured',
          }, { status: 500 });
        }

        // Make internal request to fetch-sources
        const baseUrl = process.env.AUTH_URL || 'https://freelanly.com';
        const res = await fetch(`${baseUrl}/api/cron/fetch-sources`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          return NextResponse.json({
            success: false,
            error: `Cron returned ${res.status}: ${text.slice(0, 100)}`,
          }, { status: 500 });
        }

        const data = await res.json();
        return NextResponse.json({
          success: true,
          action: 'start-parsing',
          message: 'Парсинг запущен',
          details: data,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[ParsingActions] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
