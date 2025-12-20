import { ApifyClient } from 'apify-client';
import { getApifySettings, type ApifyActorSettings } from './settings';

// Lazy initialization to avoid build-time errors
let _apify: ApifyClient | null = null;

function getApifyClient(): ApifyClient {
  if (!_apify) {
    _apify = new ApifyClient({
      token: process.env.APIFY_API_TOKEN || 'dummy-token-for-build',
    });
  }
  return _apify;
}

// Re-export settings type
export type { ApifyActorSettings };

// ============================================
// LinkedIn Posts Search Scraper
// Actor ID: buIWk2uOUzTmcLsuB
// https://console.apify.com/actors/buIWk2uOUzTmcLsuB
// ============================================

// Raw data structure from Apify actor
export interface ApifyLinkedInPostRaw {
  type: 'post';
  id: string;
  linkedinUrl: string;
  content: string;
  author: {
    universalName: string | null;
    publicIdentifier: string;
    type: 'profile' | 'company';
    name: string;
    linkedinUrl: string;
    info: string | null; // Headline like "UX Leadership at Amazon | UXMC"
    website: string | null;
    websiteLabel: string | null;
    avatar: {
      url: string;
      width: number;
      height: number;
      expiresAt: number;
    } | null;
  };
  postedAt: {
    timestamp: number;
    date: string; // ISO date
    postedAgoShort: string;
    postedAgoText: string;
  };
  postImages: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  socialContent: {
    hideCommentsCount: boolean;
    hideReactionsCount: boolean;
    hideSocialActivityCounts: boolean;
    hideShareAction: boolean;
    hideSendAction: boolean;
    hideRepostsCount: boolean;
    hideViewsCount: boolean;
    hideReactAction: boolean;
    hideCommentAction: boolean;
    shareUrl: string;
    showContributionExperience: boolean;
    showSocialDetail: boolean;
  };
  // We don't need engagement, reactions, comments - skip them
}

// Our cleaned-up interface for internal use
export interface LinkedInPost {
  id: string;
  url: string;
  content: string;
  authorName: string;
  authorLinkedInUrl: string;
  authorPublicIdentifier: string;
  authorType: 'profile' | 'company';
  authorHeadline: string | null;
  authorAvatar: string | null;
  authorWebsite: string | null;
  postedAt: Date;
  postedAtTimestamp: number;
  images: string[];
}

// Transform raw Apify data to our format
export function transformApifyPost(raw: ApifyLinkedInPostRaw): LinkedInPost {
  return {
    id: raw.id,
    url: raw.linkedinUrl,
    content: raw.content,
    authorName: raw.author.name,
    authorLinkedInUrl: raw.author.linkedinUrl,
    authorPublicIdentifier: raw.author.publicIdentifier,
    authorType: raw.author.type,
    authorHeadline: raw.author.info,
    authorAvatar: raw.author.avatar?.url || null,
    authorWebsite: raw.author.website,
    postedAt: new Date(raw.postedAt.date),
    postedAtTimestamp: raw.postedAt.timestamp,
    images: raw.postImages.map(img => img.url),
  };
}

// Actor ID for LinkedIn Posts Search Scraper
const LINKEDIN_POSTS_ACTOR = 'buIWk2uOUzTmcLsuB';

export interface ScrapeOptions {
  searchQueries?: string[];
  maxPosts?: number;
  postedLimit?: '24h' | 'week' | 'month';
  sortBy?: 'relevance' | 'date';
  scrapePages?: number;
  startPage?: number;
  authorsCompanyPublicIdentifiers?: string[];
  targetUrls?: string[];
}

// Run the actor with settings from DB
export async function scrapeLinkedInPosts(overrides?: Partial<ScrapeOptions>): Promise<LinkedInPost[]> {
  const apify = getApifyClient();

  // Get settings from database
  const settings = await getApifySettings();

  // Build input from settings + overrides
  const input = {
    searchQueries: overrides?.searchQueries || settings.searchQueries,
    maxPosts: overrides?.maxPosts ?? settings.maxPosts,
    postedLimit: overrides?.postedLimit ?? settings.postedLimit,
    sortBy: overrides?.sortBy ?? settings.sortBy,
    scrapePages: overrides?.scrapePages ?? settings.scrapePages,
    startPage: overrides?.startPage ?? settings.startPage,
    scrapeReactions: settings.scrapeReactions,
    scrapeComments: settings.scrapeComments,
    maxReactions: settings.maxReactions,
    ...(overrides?.authorsCompanyPublicIdentifiers && {
      authorsCompanyPublicIdentifiers: overrides.authorsCompanyPublicIdentifiers,
    }),
    ...(overrides?.targetUrls && {
      targetUrls: overrides.targetUrls,
    }),
  };

  try {
    console.log('Starting Apify actor with input:', JSON.stringify(input, null, 2));

    const run = await apify.actor(LINKEDIN_POSTS_ACTOR).call(input);

    console.log(`Actor run completed. Run ID: ${run.id}`);

    // Get results from dataset
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    console.log(`Fetched ${items.length} posts from Apify`);

    // Filter only posts (skip any other types) and transform
    const posts = items
      .filter((item: any) => item.type === 'post')
      .map((item: any) => transformApifyPost(item as ApifyLinkedInPostRaw));

    return posts;
  } catch (error) {
    console.error('Apify LinkedIn scraping error:', error);
    throw error;
  }
}

// Get posts from existing dataset (for webhook or manual fetch)
export async function getPostsFromDataset(datasetId: string): Promise<LinkedInPost[]> {
  const apify = getApifyClient();

  try {
    const { items } = await apify.dataset(datasetId).listItems();

    const posts = items
      .filter((item: any) => item.type === 'post')
      .map((item: any) => transformApifyPost(item as ApifyLinkedInPostRaw));

    return posts;
  } catch (error) {
    console.error('Error fetching from Apify dataset:', error);
    throw error;
  }
}

// Get posts from actor run ID
export async function getPostsFromRun(runId: string): Promise<LinkedInPost[]> {
  const apify = getApifyClient();

  try {
    const run = await apify.run(runId).get();

    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (run.status !== 'SUCCEEDED') {
      throw new Error(`Run ${runId} has status: ${run.status}`);
    }

    return getPostsFromDataset(run.defaultDatasetId);
  } catch (error) {
    console.error('Error fetching from Apify run:', error);
    throw error;
  }
}

// Default hiring search queries (fallback, settings from DB are preferred)
export const HIRING_SEARCH_QUERIES = [
  'hiring remote',
  'we are hiring',
  'join our team remote',
  'looking for remote',
  'hiring software engineer',
  'hiring developer remote',
];

// Scrape hiring posts using settings from DB
export async function scrapeHiringPosts(): Promise<LinkedInPost[]> {
  // Uses settings from database automatically
  return scrapeLinkedInPosts();
}

export { getApifyClient as apify };
