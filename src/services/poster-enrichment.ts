import { prisma } from '@/lib/db';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';

interface LinkedInProfile {
  name?: string;
  headline?: string;
  company?: string;
  followers?: number;
  location?: string;
  about?: string;
}

/**
 * Scrape a LinkedIn profile using Apify LinkedIn Profile Scraper
 */
async function scrapeLinkedInProfile(profileUrl: string): Promise<LinkedInProfile | null> {
  if (!APIFY_TOKEN || !profileUrl.includes('linkedin.com')) return null;

  try {
    // Use Apify LinkedIn Profile Scraper actor
    const runResp = await fetch('https://api.apify.com/v2/acts/anchor~linkedin-profile-scraper/runs?token=' + APIFY_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: profileUrl }],
        maxItems: 1,
        proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!runResp.ok) {
      console.error('[PosterEnrich] Apify run failed:', runResp.status);
      return null;
    }

    const run = await runResp.json();
    const runId = run.data?.id;
    if (!runId) return null;

    // Wait for completion (poll every 5s, max 60s)
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      const status = await statusResp.json();
      if (status.data?.status === 'SUCCEEDED') break;
      if (status.data?.status === 'FAILED' || status.data?.status === 'ABORTED') return null;
    }

    // Get results
    const dataResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`);
    const items = await dataResp.json();
    const profile = items[0];

    if (!profile) return null;

    return {
      name: profile.fullName || profile.name,
      headline: profile.headline || profile.title,
      company: profile.company?.name || profile.companyName,
      followers: profile.followersCount || profile.followers,
      location: profile.location || profile.addressLocality,
      about: profile.about?.slice(0, 300),
    };
  } catch (e) {
    console.error('[PosterEnrich] Scrape error:', e);
    return null;
  }
}

/**
 * Enrich poster data for opportunities that have LinkedIn URL but missing profile details.
 * Run periodically (e.g., daily) to fill in poster info.
 */
export async function enrichPosterProfiles(limit = 10): Promise<number> {
  // Find opportunities with LinkedIn URL but no enriched data
  const opportunities = await prisma.opportunity.findMany({
    where: {
      clientLinkedIn: { not: '' },
      posterTitle: null,
      createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, // Only recent
    },
    select: { id: true, clientLinkedIn: true, clientName: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  if (opportunities.length === 0) {
    console.log('[PosterEnrich] No opportunities to enrich');
    return 0;
  }

  let enriched = 0;

  for (const opp of opportunities) {
    try {
      const profile = await scrapeLinkedInProfile(opp.clientLinkedIn);
      if (profile) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            authorName: profile.name || opp.clientName,
            posterTitle: profile.headline,
            posterCompany: profile.company,
            posterFollowers: profile.followers,
            
          },
        });
        enriched++;
        console.log(`[PosterEnrich] Enriched ${opp.clientName}: ${profile.headline} (${profile.followers} followers)`);
      }

      // Rate limit: 3s between scrapes
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error(`[PosterEnrich] Failed for ${opp.id}:`, e);
    }
  }

  return enriched;
}
