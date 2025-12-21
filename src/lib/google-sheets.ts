/**
 * Google Sheets Integration
 *
 * Забираем данные аналитики из Google Sheets.
 * Таблица должна быть опубликована как CSV.
 */

// ============================================
// TYPES
// ============================================

export interface AnalyticsData {
  project: {
    domain: string;
    launchDate: string;
    currentMRR: number;
    currentUsers: number;
    paidUsers: number;
  };

  accounts: {
    linkedinPersonal: SocialAccount;
    linkedinCompany: SocialAccount;
    tiktok: SocialAccount;
    instagram: SocialAccount;
    twitter: SocialAccount;
    telegram: SocialAccount;
  };

  traffic: {
    last30Days: {
      totalVisitors: number;
      uniqueVisitors: number;
      pageViews: number;
      avgSessionDuration: string;
      bounceRate: number;
    };
    sources: {
      organicSearch: number;
      direct: number;
      social: number;
      referral: number;
      email: number;
    };
  };

  seo: {
    impressions: number;
    clicks: number;
    avgPosition: number;
    indexedPages: number;
  };

  email: {
    totalSubscribers: number;
    activeSubscribers: number;
    jobAlertSubscribers: number;
    lastCampaign: {
      openRate: number;
      clickRate: number;
    };
  };

  content: {
    totalJobs: number;
    activeJobs: number;
    totalCompanies: number;
  };

  resources: {
    hoursPerWeek: number;
    monthlyBudget: number;
  };

  priorities: {
    getFirstPayingUsers: number;
    growTraffic: number;
    buildEmailList: number;
    createContent: number;
    improveProduct: number;
  };

  weeklyMetrics: WeeklyMetric[];
}

interface SocialAccount {
  url: string;
  followers: number;
  exists: boolean;
}

interface WeeklyMetric {
  week: string; // "2024-W52"
  visitors: number;
  signups: number;
  jobViews: number;
  applications: number;
  emailSubs: number;
  linkedinFollowers: number;
  tiktokFollowers: number;
}

// ============================================
// GOOGLE SHEETS URL PARSER
// ============================================

/**
 * Конвертирует обычную ссылку на Google Sheet в CSV URL
 *
 * Input: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 * Output: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
 */
export function getSheetCSVUrl(sheetUrl: string, gid: string = '0'): string {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Invalid Google Sheets URL');
  }
  const sheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

// ============================================
// CSV PARSER
// ============================================

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// ============================================
// FETCH & PARSE DATA
// ============================================

/**
 * Получает данные из листа "Config" (ключ-значение)
 */
async function fetchConfigSheet(sheetId: string): Promise<Record<string, string>> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

  try {
    const response = await fetch(url, { next: { revalidate: 300 } }); // Cache 5 min
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const csv = await response.text();
    const rows = parseCSV(csv);

    const config: Record<string, string> = {};
    rows.forEach(row => {
      const key = row['key'] || row['Key'] || row['Ключ'];
      const value = row['value'] || row['Value'] || row['Значение'];
      if (key) {
        config[key] = value || '';
      }
    });

    return config;
  } catch (error) {
    console.error('Error fetching config sheet:', error);
    return {};
  }
}

/**
 * Получает еженедельные метрики из листа "Weekly"
 */
async function fetchWeeklySheet(sheetId: string): Promise<WeeklyMetric[]> {
  // gid=1 предполагает что Weekly это второй лист
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=1`;

  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) return [];

    const csv = await response.text();
    const rows = parseCSV(csv);

    return rows.map(row => ({
      week: row['week'] || row['Week'] || row['Неделя'] || '',
      visitors: parseInt(row['visitors'] || row['Visitors'] || '0') || 0,
      signups: parseInt(row['signups'] || row['Signups'] || '0') || 0,
      jobViews: parseInt(row['job_views'] || row['JobViews'] || '0') || 0,
      applications: parseInt(row['applications'] || row['Applications'] || '0') || 0,
      emailSubs: parseInt(row['email_subs'] || row['EmailSubs'] || '0') || 0,
      linkedinFollowers: parseInt(row['linkedin'] || row['LinkedIn'] || '0') || 0,
      tiktokFollowers: parseInt(row['tiktok'] || row['TikTok'] || '0') || 0,
    }));
  } catch (error) {
    console.error('Error fetching weekly sheet:', error);
    return [];
  }
}

/**
 * Главная функция — получает все данные аналитики
 */
export async function fetchAnalyticsFromSheet(sheetId: string): Promise<AnalyticsData | null> {
  try {
    const [config, weekly] = await Promise.all([
      fetchConfigSheet(sheetId),
      fetchWeeklySheet(sheetId),
    ]);

    if (Object.keys(config).length === 0) {
      return null;
    }

    const num = (key: string) => parseInt(config[key] || '0') || 0;
    const str = (key: string) => config[key] || '';

    return {
      project: {
        domain: str('domain'),
        launchDate: str('launch_date'),
        currentMRR: num('current_mrr'),
        currentUsers: num('current_users'),
        paidUsers: num('paid_users'),
      },

      accounts: {
        linkedinPersonal: {
          url: str('linkedin_personal_url'),
          followers: num('linkedin_personal_followers'),
          exists: !!str('linkedin_personal_url'),
        },
        linkedinCompany: {
          url: str('linkedin_company_url'),
          followers: num('linkedin_company_followers'),
          exists: !!str('linkedin_company_url'),
        },
        tiktok: {
          url: str('tiktok_url'),
          followers: num('tiktok_followers'),
          exists: !!str('tiktok_url'),
        },
        instagram: {
          url: str('instagram_url'),
          followers: num('instagram_followers'),
          exists: !!str('instagram_url'),
        },
        twitter: {
          url: str('twitter_url'),
          followers: num('twitter_followers'),
          exists: !!str('twitter_url'),
        },
        telegram: {
          url: str('telegram_url'),
          followers: num('telegram_followers'),
          exists: !!str('telegram_url'),
        },
      },

      traffic: {
        last30Days: {
          totalVisitors: num('traffic_total'),
          uniqueVisitors: num('traffic_unique'),
          pageViews: num('traffic_pageviews'),
          avgSessionDuration: str('traffic_avg_duration'),
          bounceRate: num('traffic_bounce_rate'),
        },
        sources: {
          organicSearch: num('source_organic'),
          direct: num('source_direct'),
          social: num('source_social'),
          referral: num('source_referral'),
          email: num('source_email'),
        },
      },

      seo: {
        impressions: num('seo_impressions'),
        clicks: num('seo_clicks'),
        avgPosition: num('seo_avg_position'),
        indexedPages: num('seo_indexed_pages'),
      },

      email: {
        totalSubscribers: num('email_total'),
        activeSubscribers: num('email_active'),
        jobAlertSubscribers: num('email_job_alerts'),
        lastCampaign: {
          openRate: num('email_open_rate'),
          clickRate: num('email_click_rate'),
        },
      },

      content: {
        totalJobs: num('jobs_total'),
        activeJobs: num('jobs_active'),
        totalCompanies: num('companies_total'),
      },

      resources: {
        hoursPerWeek: num('hours_per_week'),
        monthlyBudget: num('monthly_budget'),
      },

      priorities: {
        getFirstPayingUsers: num('priority_paying_users'),
        growTraffic: num('priority_traffic'),
        buildEmailList: num('priority_email'),
        createContent: num('priority_content'),
        improveProduct: num('priority_product'),
      },

      weeklyMetrics: weekly,
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return null;
  }
}

// ============================================
// HELPER: Get Sheet ID from Settings
// ============================================

import { prisma } from '@/lib/db';

export async function getAnalyticsSheetId(): Promise<string | null> {
  const setting = await prisma.settings.findUnique({
    where: { key: 'analytics_sheet_id' },
  });
  return setting?.value as string | null;
}

export async function setAnalyticsSheetId(sheetId: string): Promise<void> {
  await prisma.settings.upsert({
    where: { key: 'analytics_sheet_id' },
    create: { key: 'analytics_sheet_id', value: sheetId },
    update: { value: sheetId },
  });
}

/**
 * Получает аналитику из сохранённой таблицы
 */
export async function getAnalytics(): Promise<AnalyticsData | null> {
  const sheetId = await getAnalyticsSheetId();
  if (!sheetId) return null;
  return fetchAnalyticsFromSheet(sheetId);
}
