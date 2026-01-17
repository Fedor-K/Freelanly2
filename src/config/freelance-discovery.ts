/**
 * Freelance LinkedIn Posts Discovery Configuration
 *
 * 120 search queries for finding freelance/contract opportunities.
 * Used by n8n workflow via /api/linkedin/next-keyword endpoint.
 *
 * Rotation: every 10 minutes, next keyword in list (sequential, not random)
 * Full cycle: 120 × 10 min = ~20 hours
 */

// ============================================
// All 120 Freelance Search Queries
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

  // === Translation & Language - General (18) ===
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

  // === Translation - By Language (19) ===
  '"french translator"',
  '"chinese translator"',
  '"spanish translator"',
  '"japanese translator"',
  '"arabic translator"',
  '"portuguese translator"',
  '"italian translator"',
  '"german translator"',
  '"russian translator"',
  '"korean translator"',
  '"turkish translator"',
  '"hindi translator"',
  '"polish translator"',
  '"dutch translator"',
  '"swedish translator"',
  '"ukrainian translator"',
  '"czech translator"',
  '"greek translator"',
  '"vietnamese translator"',

  // === Interpreters (8) ===
  '"hiring interpreter"',
  '"need interpreter"',
  '"looking for interpreter"',
  '"conference interpreter"',
  '"medical interpreter"',
  '"legal interpreter"',
  '"court interpreter"',
  '"simultaneous interpreter"',

  // === Specialized Translation (6) ===
  '"MTPE"',
  '"post-editing"',
  '"machine translation" editor',
  '"subtitle" project',
  '"transcreation"',
  '"linguist" needed',

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

  // === QA & Testing (5) ===
  '"freelance QA"',
  '"freelance tester"',
  '"QA tester" remote',
  '"localization QA"',
  '"LQA"',

  // === Other (10) ===
  '"freelance virtual assistant"',
  '"freelance consultant"',
  '"freelance project manager"',
  '"freelance data analyst"',
  '"freelance VA"',
  '"freelance recruiter"',
  '"freelance bookkeeper"',
  '"freelance accountant"',
  '"freelance customer support"',
  '"freelance research"',
];

// Total count
export const TOTAL_KEYWORDS = FREELANCE_SEARCH_QUERIES.length; // 120

// ============================================
// Rotation Logic (Sequential, time-based)
// ============================================

/**
 * Get current keyword index based on time
 * Uses 10-minute slots to rotate through keywords sequentially
 *
 * @returns index 0 to TOTAL_KEYWORDS-1
 */
export function getCurrentKeywordIndex(): number {
  const now = new Date();
  const minutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  const tenMinuteSlot = Math.floor(minutesSinceMidnight / 10);
  return tenMinuteSlot % TOTAL_KEYWORDS;
}

/**
 * Get current keyword based on time slot
 */
export function getCurrentKeyword(): string {
  const index = getCurrentKeywordIndex();
  return FREELANCE_SEARCH_QUERIES[index];
}

/**
 * Get keyword info for API response (sequential rotation)
 */
export function getKeywordInfo(): {
  keyword: string;
  index: number;
  total: number;
} {
  const index = getCurrentKeywordIndex();
  const keyword = FREELANCE_SEARCH_QUERIES[index];

  return {
    keyword,
    index,
    total: TOTAL_KEYWORDS,
  };
}

// Legacy random functions (kept for backwards compatibility)
export function getRandomKeywordIndex(): number {
  return Math.floor(Math.random() * TOTAL_KEYWORDS);
}

export function getRandomKeyword(): string {
  const index = getRandomKeywordIndex();
  return FREELANCE_SEARCH_QUERIES[index];
}

/**
 * Get all keywords (for debugging/admin)
 */
export function getAllKeywords(): string[] {
  return [...FREELANCE_SEARCH_QUERIES];
}

/**
 * Get next N keywords starting from current position
 * Useful for preview in admin panel
 */
export function getUpcomingKeywords(count: number = 5): string[] {
  const currentIndex = getCurrentKeywordIndex();
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const index = (currentIndex + i) % TOTAL_KEYWORDS;
    result.push(FREELANCE_SEARCH_QUERIES[index]);
  }

  return result;
}
