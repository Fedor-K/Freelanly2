/**
 * Freelance LinkedIn Posts Discovery Configuration
 *
 * 77 search queries for finding freelance/contract opportunities.
 * Used by n8n workflow via /api/linkedin/next-keyword endpoint.
 *
 * Rotation: every 10 minutes, next keyword in list
 * Full cycle: 77 × 10 min = ~13 hours
 */

// ============================================
// All 77 Freelance Search Queries
// ============================================

export const FREELANCE_SEARCH_QUERIES = [
  // === General Freelance Phrases (17) ===
  '"looking for freelance"',
  '"hiring freelancer"',
  '"need a freelancer"',
  '"seeking freelancer"',
  '"freelance opportunity"',
  '"freelancer needed"',
  '"looking for contractor"',
  '"hiring contractor"',
  '"contract opportunity"',
  '"need contractor"',
  '"project based"',
  '"short term project"',
  '"quick project"',
  '"gig opportunity"',
  '"immediate project"',
  '"hourly rate"',
  '"per project"',

  // === Engineering (8) ===
  '"freelance developer"',
  '"freelance engineer"',
  '"freelance programmer"',
  '"contract developer"',
  '"freelance react"',
  '"freelance node"',
  '"freelance fullstack"',
  '"freelance backend"',

  // === Design (7) ===
  '"freelance designer"',
  '"freelance UX"',
  '"freelance UI"',
  '"freelance product designer"',
  '"contract designer"',
  '"freelance web designer"',
  '"freelance graphic designer"',

  // === Translation & Language (18) ===
  '"freelance translator"',
  '"freelance translation"',
  '"translation project"',
  '"need translator"',
  '"looking for translator"',
  '"hiring translator"',
  '"localization project"',
  '"freelance localization"',
  '"app localization"',
  '"game localization"',
  '"website localization"',
  '"freelance interpreter"',
  '"freelance subtitling"',
  '"freelance transcription"',
  '"freelance proofreader"',
  '"freelance editor" language',
  '"voice over" freelance',
  '"dubbing" freelance',

  // === Writing (8) ===
  '"freelance writer"',
  '"freelance copywriter"',
  '"freelance content writer"',
  '"contract writer"',
  '"freelance editor"',
  '"freelance blogger"',
  '"freelance technical writer"',
  '"freelance ghostwriter"',

  // === Marketing (8) ===
  '"freelance marketing"',
  '"freelance growth"',
  '"contract marketing"',
  '"freelance social media"',
  '"freelance SEO"',
  '"freelance PPC"',
  '"freelance content marketing"',
  '"freelance email marketing"',

  // === Creative (6) ===
  '"freelance video editor"',
  '"freelance motion"',
  '"freelance animator"',
  '"freelance illustrator"',
  '"freelance photographer"',
  '"contract creative"',

  // === Other (5) ===
  '"freelance virtual assistant"',
  '"freelance consultant"',
  '"freelance project manager"',
  '"freelance data analyst"',
  '"freelance VA"',
];

// Total count
export const TOTAL_KEYWORDS = FREELANCE_SEARCH_QUERIES.length; // 77

// ============================================
// Rotation Logic
// ============================================

/**
 * Get current keyword index based on time
 * Rotates every 10 minutes
 *
 * @returns index 0-76
 */
export function getCurrentKeywordIndex(): number {
  const now = new Date();
  const minutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  const tenMinuteSlot = Math.floor(minutesSinceMidnight / 10);
  return tenMinuteSlot % TOTAL_KEYWORDS;
}

/**
 * Get current keyword for this 10-minute slot
 */
export function getCurrentKeyword(): string {
  const index = getCurrentKeywordIndex();
  return FREELANCE_SEARCH_QUERIES[index];
}

/**
 * Get keyword info for API response
 */
export function getKeywordInfo(): {
  keyword: string;
  index: number;
  total: number;
  nextChangeIn: number; // seconds until next keyword
} {
  const index = getCurrentKeywordIndex();
  const keyword = FREELANCE_SEARCH_QUERIES[index];

  // Calculate seconds until next 10-minute slot
  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  const currentSecond = now.getUTCSeconds();
  const minutesInSlot = currentMinute % 10;
  const secondsUntilNext = (10 - minutesInSlot) * 60 - currentSecond;

  return {
    keyword,
    index,
    total: TOTAL_KEYWORDS,
    nextChangeIn: secondsUntilNext,
  };
}

/**
 * Get all keywords (for debugging/admin)
 */
export function getAllKeywords(): string[] {
  return [...FREELANCE_SEARCH_QUERIES];
}
