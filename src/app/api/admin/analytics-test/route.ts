/**
 * API endpoint для тестирования подключений к аналитике
 * GET /api/admin/analytics-test
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    connections: {},
    rawResponses: {},
    data: {},
  };

  const token = process.env.YANDEX_METRIKA_TOKEN;
  const counterId = process.env.YANDEX_METRIKA_COUNTER_ID;
  const resendKey = process.env.RESEND_API_KEY;

  // Test Yandex.Metrika - Statistics API (not Management API)
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const metrikaUrl = `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits,ym:s:users,ym:s:pageviews&date1=${weekAgo}&date2=${today}&oauth_token=${token}`;
    const response = await fetch(metrikaUrl);
    const responseText = await response.text();

    (results.connections as Record<string, unknown>).yandexMetrika = response.ok;
    (results.rawResponses as Record<string, unknown>).yandexMetrika = {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 500), // First 500 chars
    };
  } catch (error) {
    (results.connections as Record<string, unknown>).yandexMetrika = false;
    (results.rawResponses as Record<string, unknown>).yandexMetrikaError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test Resend - check API key is configured
  (results.connections as Record<string, unknown>).resend = !!resendKey;

  // Environment check (без показа полных секретов)
  (results as Record<string, unknown>).envCheck = {
    YANDEX_METRIKA_TOKEN: token ? `${token.substring(0, 10)}...` : 'not set',
    YANDEX_METRIKA_COUNTER_ID: counterId || 'not set',
    RESEND_API_KEY: resendKey ? `${resendKey.substring(0, 10)}...` : 'not set',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'not set (defaults to info@freelanly.com)',
    NEXT_PUBLIC_YANDEX_METRIKA_ID: process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || 'not set',
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'not set',
  };

  return NextResponse.json(results, { status: 200 });
}
