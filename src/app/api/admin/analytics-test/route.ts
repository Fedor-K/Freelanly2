/**
 * API endpoint для тестирования подключений к аналитике
 * GET /api/admin/analytics-test
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    connections: {},
    rawResponses: {},
    data: {},
  };

  const token = process.env.YANDEX_METRIKA_TOKEN;
  const counterId = process.env.YANDEX_METRIKA_COUNTER_ID;
  const dashamailKey = process.env.DASHAMAIL_API_KEY;

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

  // Test DashaMail - raw request
  try {
    const dashamailUrl = `https://api.dashamail.com/?method=lists.get&api_key=${dashamailKey}`;
    const response = await fetch(dashamailUrl);
    const responseText = await response.text();

    (results.connections as Record<string, unknown>).dashaMail = response.ok;
    (results.rawResponses as Record<string, unknown>).dashaMail = {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 500),
    };
  } catch (error) {
    (results.connections as Record<string, unknown>).dashaMail = false;
    (results.rawResponses as Record<string, unknown>).dashaMailError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Environment check (без показа полных секретов)
  (results as Record<string, unknown>).envCheck = {
    YANDEX_METRIKA_TOKEN: token ? `${token.substring(0, 10)}...` : 'not set',
    YANDEX_METRIKA_COUNTER_ID: counterId || 'not set',
    DASHAMAIL_API_KEY: dashamailKey ? `${dashamailKey.substring(0, 10)}...` : 'not set',
    DASHAMAIL_LIST_ID: process.env.DASHAMAIL_LIST_ID || 'not set',
    NEXT_PUBLIC_YANDEX_METRIKA_ID: process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || 'not set',
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'not set',
  };

  return NextResponse.json(results, { status: 200 });
}
