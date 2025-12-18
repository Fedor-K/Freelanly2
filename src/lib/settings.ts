import { prisma } from './db';

// ============================================
// Apify Actor Settings
// ============================================

export interface ApifyActorSettings {
  maxPosts: number;
  maxReactions: number;
  postedLimit: '24h' | 'week' | 'month';
  scrapeComments: boolean;
  scrapePages: number;
  scrapeReactions: boolean;
  searchQueries: string[];
  sortBy: 'date' | 'relevance';
  startPage: number;
}

export const DEFAULT_APIFY_SETTINGS: ApifyActorSettings = {
  maxPosts: 20,
  maxReactions: 5,
  postedLimit: '24h',
  scrapeComments: false,
  scrapePages: 1,
  scrapeReactions: false,
  searchQueries: ['hiring remote', 'we are hiring remote'],
  sortBy: 'date',
  startPage: 1,
};

const APIFY_SETTINGS_KEY = 'apify_actor_settings';

// Get Apify settings
export async function getApifySettings(): Promise<ApifyActorSettings> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { key: APIFY_SETTINGS_KEY },
    });

    if (!settings) {
      return DEFAULT_APIFY_SETTINGS;
    }

    return {
      ...DEFAULT_APIFY_SETTINGS,
      ...(settings.value as Partial<ApifyActorSettings>),
    };
  } catch (error) {
    console.error('Error fetching Apify settings:', error);
    return DEFAULT_APIFY_SETTINGS;
  }
}

// Save Apify settings
export async function saveApifySettings(settings: Partial<ApifyActorSettings>): Promise<ApifyActorSettings> {
  const current = await getApifySettings();
  const updated = { ...current, ...settings };

  await prisma.settings.upsert({
    where: { key: APIFY_SETTINGS_KEY },
    update: { value: updated },
    create: { key: APIFY_SETTINGS_KEY, value: updated },
  });

  return updated;
}

// ============================================
// Generic Settings Functions
// ============================================

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { key },
    });

    if (!settings) {
      return defaultValue;
    }

    return settings.value as T;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });
}
