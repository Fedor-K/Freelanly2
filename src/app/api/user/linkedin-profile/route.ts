import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApifyClient } from 'apify-client';

interface LinkedInProfile {
  name: string;
  headline: string;
  about: string;
  skills: string[];
  experience: { title: string; company: string; duration: string }[];
  location: string;
  profileUrl: string;
}

function normalizeLinkedInUrl(url: string): string {
  let normalized = url.split('?')[0].replace(/\/+$/, '');
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }
  normalized = normalized.replace('://linkedin.com', '://www.linkedin.com');
  return normalized;
}

/**
 * POST /api/user/linkedin-profile
 * Scrape LinkedIn profile using Apify
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileUrl } = await request.json();

    if (!profileUrl || !profileUrl.includes('linkedin.com')) {
      return NextResponse.json({ error: 'Please enter a valid LinkedIn profile URL' }, { status: 400 });
    }

    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'LinkedIn integration not configured' }, { status: 500 });
    }

    console.log(`[LinkedIn] Scraping profile for user ${session.user.id}: ${profileUrl}`);

    const apify = new ApifyClient({ token });

    const run = await apify.actor('dev_fusion/linkedin-profile-scraper').call({
      profileUrls: [normalizeLinkedInUrl(profileUrl)],
      proxyConfiguration: { useApifyProxy: true },
    });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Could not fetch LinkedIn profile. Check the URL and try again.' }, { status: 400 });
    }

    const raw = items[0] as Record<string, unknown>;

    const profile: LinkedInProfile = {
      name: (raw.fullName as string) ||
        (((raw.firstName as string) || '') + ' ' + ((raw.lastName as string) || '')).trim() ||
        'Unknown',
      headline: (raw.headline as string) || (raw.title as string) || '',
      about: (raw.about as string) || (raw.summary as string) || '',
      skills: Array.isArray(raw.skills)
        ? (raw.skills as Array<Record<string, unknown>>).map(s => (s.name as string) || String(s)).slice(0, 15)
        : [],
      experience: Array.isArray(raw.experience)
        ? (raw.experience as Array<Record<string, unknown>>).slice(0, 5).map(e => ({
            title: (e.title as string) || '',
            company: (e.companyName as string) || (e.company as string) || '',
            duration: (e.duration as string) || '',
          }))
        : [],
      location: (raw.location as string) || '',
      profileUrl: normalizeLinkedInUrl(profileUrl),
    };

    console.log(`[LinkedIn] Scraped: ${profile.name}, ${profile.skills.length} skills, ${profile.experience.length} experiences`);

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('[API] Error scraping LinkedIn:', error);
    return NextResponse.json({ error: 'Failed to fetch LinkedIn profile' }, { status: 500 });
  }
}
