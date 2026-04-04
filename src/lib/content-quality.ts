/**
 * Content Quality Assessment for SEO
 *
 * Determines whether a job post should be indexed by search engines.
 * THIN content = noindex (short LinkedIn posts without details)
 * LIGHT/RICH content = index (quality job descriptions)
 */

import { ContentQuality } from '@prisma/client';

interface ContentQualityInput {
  description: string;
  cleanDescription?: string | null;
  salaryMin?: number | null;
  skills?: string[];
  applyEmail?: string | null;
  applyUrl?: string | null;
  // Penalty signals
  isFreeEmail?: boolean; // gmail, yahoo, etc.
  isAnnouncement?: boolean; // "excited to announce", etc.
  apolloValidated?: boolean; // company validated via Apollo
}

interface ContentQualityResult {
  quality: ContentQuality;
  score: number;
  reasons: string[];
}

/**
 * Check if email is from a free provider (gmail, yahoo, etc.)
 */
export function isFreeEmailProvider(email: string | null | undefined): boolean {
  if (!email) return false;

  const freeProviders = [
    'gmail.com',
    'yahoo.com',
    'yahoo.co',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'aol.com',
    'icloud.com',
    'mail.com',
    'protonmail.com',
    'proton.me',
    'yandex.com',
    'yandex.ru',
    'mail.ru',
    'gmx.com',
    'gmx.de',
    'zoho.com',
    'fastmail.com',
  ];

  const domain = email.split('@')[1]?.toLowerCase();
  return freeProviders.some((p) => domain === p || domain?.endsWith(`.${p}`));
}

/**
 * Check if title/content suggests a personal announcement rather than job posting
 */
export function isPersonalAnnouncement(title: string, content?: string): boolean {
  const text = `${title} ${content || ''}`.toLowerCase();

  const announcementPatterns = [
    'excited to share',
    'excited to announce',
    'thrilled to share',
    'thrilled to announce',
    'happy to announce',
    'glad to share',
    'proud to announce',
    'proud to share',
    'delighted to share',
    'pleased to announce',
    'honored to',
    'i just started',
    'i\'m starting',
    'new chapter',
    'new journey',
  ];

  return announcementPatterns.some((pattern) => text.includes(pattern));
}

/**
 * Assess content quality for a job post
 * Returns quality tier (THIN/LIGHT/RICH) and score (0-100)
 */
export function assessContentQuality(input: ContentQualityInput): ContentQualityResult {
  let score = 0;
  const reasons: string[] = [];

  const descLength = (input.cleanDescription || input.description || '').length;

  // Base score from description length
  if (descLength < 300) {
    score += 10;
    reasons.push(`Short description (${descLength} chars): +10`);
  } else if (descLength < 500) {
    score += 25;
    reasons.push(`Medium-short description (${descLength} chars): +25`);
  } else if (descLength < 800) {
    score += 40;
    reasons.push(`Medium description (${descLength} chars): +40`);
  } else if (descLength < 1500) {
    score += 55;
    reasons.push(`Good description (${descLength} chars): +55`);
  } else {
    score += 70;
    reasons.push(`Full description (${descLength} chars): +70`);
  }

  // Bonus: Has salary
  if (input.salaryMin) {
    score += 10;
    reasons.push('Has salary: +10');
  }

  // Bonus: Has skills
  const skillCount = input.skills?.length || 0;
  if (skillCount >= 3) {
    score += 8;
    reasons.push(`Has ${skillCount} skills: +8`);
  }
  if (skillCount >= 5) {
    score += 5;
    reasons.push('Has 5+ skills: +5');
  }

  // Bonus: Has clean description
  if (input.cleanDescription && input.cleanDescription.length > 500) {
    score += 5;
    reasons.push('Has clean description: +5');
  }

  // Bonus: Apollo validated company
  if (input.apolloValidated) {
    score += 10;
    reasons.push('Apollo validated: +10');
  }

  // Penalty: Free email (gmail, yahoo, etc.)
  if (input.isFreeEmail) {
    score -= 15;
    reasons.push('Free email provider: -15');
  }

  // Penalty: Personal announcement style
  if (input.isAnnouncement) {
    score -= 10;
    reasons.push('Announcement style: -10');
  }

  // Penalty: No apply method (email or URL)
  if (!input.applyEmail && !input.applyUrl) {
    score -= 5;
    reasons.push('No direct apply method: -5');
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  // Determine quality tier
  let quality: ContentQuality;
  if (score < 35) {
    quality = 'THIN';
  } else if (score < 55) {
    quality = 'LIGHT';
  } else {
    quality = 'RICH';
  }

  return { quality, score, reasons };
}

/**
 * Quick check if content quality allows indexing
 */
export function shouldIndex(quality: ContentQuality): boolean {
  return quality === 'RICH';
}

/**
 * Get sitemap priority based on content quality
 */
export function getSitemapPriority(quality: ContentQuality): number {
  switch (quality) {
    case 'RICH':
      return 0.8;
    case 'LIGHT':
      return 0.5;
    case 'THIN':
      return 0.3; // Won't be in sitemap anyway
    default:
      return 0.5;
  }
}
