/**
 * Yandex.Metrika API Integration
 *
 * Автоматический сбор данных из Яндекс.Метрики.
 * Документация: https://yandex.ru/dev/metrika/doc/api2/api_v1/intro.html
 */

// ============================================
// TYPES
// ============================================

export interface MetrikaStats {
  // Трафик
  visits: number;
  visitors: number;
  pageviews: number;

  // Поведение
  bounceRate: number;
  avgVisitDuration: number; // в секундах
  avgPageDepth: number;

  // Источники трафика (%)
  sources: {
    organic: number;
    direct: number;
    social: number;
    referral: number;
    email: number;
    other: number;
  };

  // Цели (конверсии)
  goals: {
    [goalName: string]: number;
  };

  // Топ страницы
  topPages: Array<{
    url: string;
    views: number;
    avgTime: number;
  }>;

  // Топ поисковые запросы
  topSearchPhrases: Array<{
    phrase: string;
    visits: number;
  }>;
}

export interface MetrikaDailyData {
  date: string;
  visits: number;
  visitors: number;
  pageviews: number;
  bounceRate: number;
}

// ============================================
// API CLIENT
// ============================================

const METRIKA_API_BASE = 'https://api-metrika.yandex.net/stat/v1/data';

/**
 * Получает данные из Яндекс.Метрики
 */
async function fetchMetrika(
  endpoint: string,
  params: Record<string, string>
): Promise<unknown> {
  const token = process.env.YANDEX_METRIKA_TOKEN;
  const counterId = process.env.YANDEX_METRIKA_COUNTER_ID;

  if (!token || !counterId) {
    throw new Error('Yandex Metrika credentials not configured');
  }

  const url = new URL(`${METRIKA_API_BASE}${endpoint}`);
  url.searchParams.set('id', counterId);
  url.searchParams.set('oauth_token', token);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
    next: { revalidate: 300 }, // Cache 5 min
  });

  if (!response.ok) {
    throw new Error(`Metrika API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// DATA FETCHERS
// ============================================

/**
 * Получает основные метрики за период
 */
export async function getMetrikaStats(
  startDate: string, // 'YYYY-MM-DD'
  endDate: string
): Promise<MetrikaStats> {
  // Основные метрики
  const mainStats = await fetchMetrika('', {
    date1: startDate,
    date2: endDate,
    metrics: 'ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds,ym:s:pageDepth',
  }) as {
    totals: number[];
  };

  // Источники трафика
  const sourcesData = await fetchMetrika('/bytime', {
    date1: startDate,
    date2: endDate,
    metrics: 'ym:s:visits',
    dimensions: 'ym:s:lastTrafficSource',
    group: 'all',
  }) as {
    data: Array<{ dimensions: Array<{ name: string }>; metrics: number[] }>;
    totals: number[];
  };

  // Парсим источники
  const sources = {
    organic: 0,
    direct: 0,
    social: 0,
    referral: 0,
    email: 0,
    other: 0,
  };

  const totalVisits = sourcesData.totals?.[0] || 1;

  sourcesData.data?.forEach((item) => {
    const sourceName = item.dimensions?.[0]?.name?.toLowerCase() || '';
    const visits = item.metrics?.[0] || 0;
    const percentage = (visits / totalVisits) * 100;

    if (sourceName.includes('organic') || sourceName.includes('search')) {
      sources.organic += percentage;
    } else if (sourceName.includes('direct')) {
      sources.direct += percentage;
    } else if (sourceName.includes('social')) {
      sources.social += percentage;
    } else if (sourceName.includes('referral') || sourceName.includes('link')) {
      sources.referral += percentage;
    } else if (sourceName.includes('email') || sourceName.includes('mail')) {
      sources.email += percentage;
    } else {
      sources.other += percentage;
    }
  });

  // Топ страницы
  const pagesData = await fetchMetrika('', {
    date1: startDate,
    date2: endDate,
    metrics: 'ym:pv:pageviews,ym:pv:avgTimeOnPage',
    dimensions: 'ym:pv:URLPath',
    sort: '-ym:pv:pageviews',
    limit: '10',
  }) as {
    data: Array<{ dimensions: Array<{ name: string }>; metrics: number[] }>;
  };

  const topPages = pagesData.data?.map((item) => ({
    url: item.dimensions?.[0]?.name || '',
    views: item.metrics?.[0] || 0,
    avgTime: item.metrics?.[1] || 0,
  })) || [];

  return {
    visits: mainStats.totals?.[0] || 0,
    visitors: mainStats.totals?.[1] || 0,
    pageviews: mainStats.totals?.[2] || 0,
    bounceRate: mainStats.totals?.[3] || 0,
    avgVisitDuration: mainStats.totals?.[4] || 0,
    avgPageDepth: mainStats.totals?.[5] || 0,
    sources,
    goals: {}, // Нужно отдельно запрашивать по ID целей
    topPages,
    topSearchPhrases: [],
  };
}

/**
 * Получает данные по дням
 */
export async function getMetrikaDailyData(
  startDate: string,
  endDate: string
): Promise<MetrikaDailyData[]> {
  const data = await fetchMetrika('/bytime', {
    date1: startDate,
    date2: endDate,
    metrics: 'ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate',
    group: 'day',
  }) as {
    time_intervals: Array<[string, string]>;
    data: Array<{ metrics: number[][] }>;
  };

  return data.time_intervals?.map((interval, index) => ({
    date: interval[0],
    visits: data.data?.[0]?.metrics?.[index]?.[0] || 0,
    visitors: data.data?.[0]?.metrics?.[index]?.[1] || 0,
    pageviews: data.data?.[0]?.metrics?.[index]?.[2] || 0,
    bounceRate: data.data?.[0]?.metrics?.[index]?.[3] || 0,
  })) || [];
}

/**
 * Получает достижения целей
 */
export async function getMetrikaGoals(
  startDate: string,
  endDate: string,
  goalIds: string[] // ID целей из Метрики
): Promise<Record<string, number>> {
  if (goalIds.length === 0) return {};

  const goals: Record<string, number> = {};

  for (const goalId of goalIds) {
    try {
      const data = await fetchMetrika('', {
        date1: startDate,
        date2: endDate,
        metrics: `ym:s:goal${goalId}reaches`,
      }) as { totals: number[] };

      goals[goalId] = data.totals?.[0] || 0;
    } catch {
      goals[goalId] = 0;
    }
  }

  return goals;
}

/**
 * Получает данные по периодам (день/неделя/месяц)
 */
export async function getMetrikaByPeriod(
  period: 'day' | 'week' | 'month',
  periodsBack: number = 30
): Promise<Array<{ date: string; visits: number; visitors: number }>> {
  const token = process.env.YANDEX_METRIKA_TOKEN;
  const counterId = process.env.YANDEX_METRIKA_COUNTER_ID || process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;

  if (!token || !counterId) {
    return [];
  }

  const endDate = new Date().toISOString().slice(0, 10);
  let daysBack: number;
  if (period === 'day') daysBack = periodsBack;
  else if (period === 'week') daysBack = periodsBack * 7;
  else daysBack = periodsBack * 31;

  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const url = new URL(METRIKA_API_BASE);
    url.searchParams.set('ids', counterId);
    url.searchParams.set('metrics', 'ym:s:visits,ym:s:users');
    url.searchParams.set('dimensions', 'ym:s:date');
    url.searchParams.set('date1', startDate);
    url.searchParams.set('date2', endDate);
    url.searchParams.set('group', period);
    url.searchParams.set('sort', 'ym:s:date');
    url.searchParams.set('limit', '10000');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: 'application/json',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(`[MetrikaByPeriod] API error: ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      data: Array<{
        dimensions: Array<{ name: string }>;
        metrics: number[];
      }>;
    };

    if (!data.data) return [];

    return data.data.map((row) => {
      const rawDate = row.dimensions?.[0]?.name || '';
      let date = rawDate;

      if (period === 'week') {
        // Convert date to ISO week format YYYY-Wxx
        const d = new Date(rawDate);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        date = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else if (period === 'month') {
        date = rawDate.slice(0, 7); // YYYY-MM
      }

      return {
        date,
        visits: row.metrics?.[0] || 0,
        visitors: row.metrics?.[1] || 0,
      };
    });
  } catch (error) {
    console.error('[MetrikaByPeriod] Error:', error);
    return [];
  }
}

/**
 * Получает данные за последние N дней
 */
export async function getMetrikaLastNDays(days: number = 30): Promise<MetrikaStats> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return getMetrikaStats(startDate, endDate);
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Проверяет подключение к API
 */
export async function testMetrikaConnection(): Promise<boolean> {
  try {
    const token = process.env.YANDEX_METRIKA_TOKEN;
    const counterId = process.env.YANDEX_METRIKA_COUNTER_ID;

    if (!token || !counterId) return false;

    const response = await fetch(
      `https://api-metrika.yandex.net/management/v1/counter/${counterId}?oauth_token=${token}`
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Получает список целей из счётчика
 */
export async function getMetrikaGoalsList(): Promise<Array<{ id: number; name: string }>> {
  const token = process.env.YANDEX_METRIKA_TOKEN;
  const counterId = process.env.YANDEX_METRIKA_COUNTER_ID;

  if (!token || !counterId) return [];

  try {
    const response = await fetch(
      `https://api-metrika.yandex.net/management/v1/counter/${counterId}/goals?oauth_token=${token}`
    );

    if (!response.ok) return [];

    const data = await response.json() as { goals: Array<{ id: number; name: string }> };
    return data.goals || [];
  } catch {
    return [];
  }
}
