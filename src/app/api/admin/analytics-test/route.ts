/**
 * API endpoint для тестирования подключений к аналитике
 * GET /api/admin/analytics-test
 */

import { NextResponse } from 'next/server';
import { testMetrikaConnection, getMetrikaLastNDays } from '@/lib/yandex-metrika-api';
import { testDashaMailConnection, getEmailMarketingStats } from '@/lib/dashamail';

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    connections: {},
    data: {},
  };

  // Test Yandex.Metrika
  try {
    const metrikaConnected = await testMetrikaConnection();
    (results.connections as Record<string, unknown>).yandexMetrika = metrikaConnected;

    if (metrikaConnected) {
      const metrikaData = await getMetrikaLastNDays(7);
      (results.data as Record<string, unknown>).yandexMetrika = metrikaData;
    }
  } catch (error) {
    (results.connections as Record<string, unknown>).yandexMetrika = false;
    (results.connections as Record<string, unknown>).yandexMetrikaError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test DashaMail
  try {
    const dashamailConnected = await testDashaMailConnection();
    (results.connections as Record<string, unknown>).dashaMail = dashamailConnected;

    if (dashamailConnected) {
      const emailStats = await getEmailMarketingStats();
      (results.data as Record<string, unknown>).dashaMail = emailStats;
    }
  } catch (error) {
    (results.connections as Record<string, unknown>).dashaMail = false;
    (results.connections as Record<string, unknown>).dashaMailError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Environment check (без показа секретов)
  (results as Record<string, unknown>).envCheck = {
    YANDEX_METRIKA_TOKEN: !!process.env.YANDEX_METRIKA_TOKEN,
    YANDEX_METRIKA_COUNTER_ID: process.env.YANDEX_METRIKA_COUNTER_ID || 'not set',
    DASHAMAIL_API_KEY: !!process.env.DASHAMAIL_API_KEY,
    DASHAMAIL_LIST_ID: process.env.DASHAMAIL_LIST_ID || 'not set',
    NEXT_PUBLIC_YANDEX_METRIKA_ID: process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || 'not set',
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'not set',
  };

  return NextResponse.json(results, { status: 200 });
}
