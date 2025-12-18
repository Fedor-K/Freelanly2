import { ApifyClient } from 'apify-client';

const apify = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export interface LinkedInPost {
  id: string;
  text: string;
  authorName: string;
  authorUrl: string;
  authorHeadline: string;
  companyName: string | null;
  companyUrl: string | null;
  postedAt: string;
  url: string;
  likes: number;
  comments: number;
  shares: number;
}

// LinkedIn Posts Scraper Actor
// https://apify.com/curious_coder/linkedin-post-search-scraper
const LINKEDIN_POSTS_ACTOR = 'curious_coder/linkedin-post-search-scraper';

export async function scrapeLinkedInHiringPosts(options: {
  keywords?: string[];
  maxPosts?: number;
}): Promise<LinkedInPost[]> {
  const { keywords = ['hiring', 'we are hiring', 'join our team', 'looking for'], maxPosts = 100 } = options;

  try {
    // Run the actor
    const run = await apify.actor(LINKEDIN_POSTS_ACTOR).call({
      searchQueries: keywords,
      maxPosts,
      sortBy: 'date',
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    });

    // Get results from dataset
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    return items.map((item: any) => ({
      id: item.id || item.urn,
      text: item.text || item.commentary || '',
      authorName: item.authorName || item.author?.name || '',
      authorUrl: item.authorUrl || item.author?.url || '',
      authorHeadline: item.authorHeadline || item.author?.headline || '',
      companyName: item.companyName || item.company?.name || null,
      companyUrl: item.companyUrl || item.company?.url || null,
      postedAt: item.postedAt || item.publishedAt || new Date().toISOString(),
      url: item.url || item.postUrl || '',
      likes: item.likes || item.numLikes || 0,
      comments: item.comments || item.numComments || 0,
      shares: item.shares || item.numShares || 0,
    }));
  } catch (error) {
    console.error('Apify LinkedIn scraping error:', error);
    throw error;
  }
}

// LinkedIn Company Scraper for enrichment
const COMPANY_ACTOR = 'curious_coder/linkedin-company-scraper';

export interface LinkedInCompany {
  name: string;
  url: string;
  logo: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  headquarters: string | null;
  description: string | null;
  foundedYear: number | null;
}

export async function scrapeLinkedInCompany(companyUrl: string): Promise<LinkedInCompany | null> {
  try {
    const run = await apify.actor(COMPANY_ACTOR).call({
      urls: [companyUrl],
      proxy: {
        useApifyProxy: true,
      },
    });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    const company = items[0];

    if (!company) return null;

    return {
      name: company.name || '',
      url: company.url || companyUrl,
      logo: company.logo || company.logoUrl || null,
      website: company.website || null,
      industry: company.industry || null,
      size: company.size || company.companySize || null,
      headquarters: company.headquarters || company.location || null,
      description: company.description || company.about || null,
      foundedYear: company.foundedYear || company.founded || null,
    };
  } catch (error) {
    console.error('Apify company scraping error:', error);
    return null;
  }
}

export { apify };
