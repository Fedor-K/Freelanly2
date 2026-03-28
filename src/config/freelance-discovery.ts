/**
 * Freelance LinkedIn Posts Discovery Configuration
 *
 * 112 search queries for finding freelance/contract opportunities.
 * Used by n8n workflow via /api/linkedin/next-keyword endpoint.
 *
 * Rotation: every 10 minutes, next keyword in list (sequential, not random)
 * Full cycle: 112 × 10 min = ~18.7 hours
 *
 * Removed (low conversion <5%):
 * - "localization project", "contract marketing", "freelance SEO"
 * - "freelance photographer", "freelance illustrator", "LQA", "localization QA"
 * - "freelance bookkeeper", "freelance accountant", "freelance marketing"
 * - "freelancer needed" (1%), "transcreation" (3%) — removed 2026-02-05
 *
 * Removed (0-2 opportunities total) — 2026-03-28:
 * - Dead (0 opps): "hungarian translator", "czech translator", "freelance customer support",
 *   "norwegian interpreter", "swedish interpreter", "hungarian interpreter"
 * - Near-dead (1-2 opps): "danish translator", "italian translator", "turkish translator",
 *   "italian interpreter", "malay interpreter", "hebrew translator", "hebrew interpreter",
 *   "polish translator", "romanian translator", "freelance illustrator"
 */

// ============================================
// All 112 Freelance Search Queries
// ============================================

export const FREELANCE_SEARCH_QUERIES = [
  // === General Freelance Phrases (15) ===
  '"looking for freelance"',
  '"hiring freelancer"',
  '"need a freelancer"',
  '"seeking freelancer"',
  '"freelance opportunity"',
  '"looking for contractor"',
  '"hiring contractor"',
  '"contract opportunity"',
  '"need contractor"',
  '"project based"',
  '"short term project"',
  '"quick project"',
  '"immediate project"',
  '"hourly rate"',
  '"per project"',

  // === Engineering (6) ===
  '"freelance developer"',
  '"freelance engineer"',
  '"contract developer"',
  '"freelance react"',
  '"freelance fullstack"',
  '"freelance backend"',

  // === Design (6) ===
  '"freelance designer"',
  '"freelance UX"',
  '"freelance product designer"',
  '"contract designer"',
  '"freelance web designer"',
  '"freelance graphic designer"',

  // === Translation & Language - General (12) ===
  '"freelance translator"',
  '"freelance translation"',
  '"translation project"',
  '"need translator"',
  '"looking for translator"',
  '"hiring translator"',
  '"freelance localization"',
  '"app localization"',
  '"freelance interpreter"',
  '"freelance subtitling"',
  '"voice over" freelance',
  '"dubbing" freelance',

  // === Translators - By Language (20) ===
  '"french translator"',
  '"chinese translator"',
  '"spanish translator"',
  '"japanese translator"',
  '"arabic translator"',
  '"portuguese translator"',
  '"german translator"',
  '"russian translator"',
  '"korean translator"',
  '"hindi translator"',
  '"dutch translator"',
  '"swedish translator"',
  '"ukrainian translator"',
  '"greek translator"',
  '"vietnamese translator"',
  '"thai translator"',
  '"indonesian translator"',
  '"malay translator"',
  '"norwegian translator"',
  '"finnish translator"',
  '"bengali translator"',
  '"persian translator"',

  // === Interpreters - By Language (20) ===
  '"french interpreter"',
  '"chinese interpreter"',
  '"spanish interpreter"',
  '"japanese interpreter"',
  '"arabic interpreter"',
  '"portuguese interpreter"',
  '"german interpreter"',
  '"russian interpreter"',
  '"korean interpreter"',
  '"turkish interpreter"',
  '"hindi interpreter"',
  '"polish interpreter"',
  '"dutch interpreter"',
  '"ukrainian interpreter"',
  '"greek interpreter"',
  '"vietnamese interpreter"',
  '"thai interpreter"',
  '"indonesian interpreter"',
  '"bengali interpreter"',
  '"persian interpreter"',
  '"romanian interpreter"',
  '"finnish interpreter"',

  // === Interpreters - General (5) ===
  '"hiring interpreter"',
  '"need interpreter"',
  '"looking for interpreter"',
  '"medical interpreter"',
  '"simultaneous interpreter"',

  // === Specialized Translation (4) ===
  '"MTPE"',
  '"post-editing"',
  '"subtitle" project',
  '"linguist" needed',

  // === Writing (6) ===
  '"freelance writer"',
  '"freelance copywriter"',
  '"freelance content writer"',
  '"contract writer"',
  '"freelance editor"',
  '"freelance technical writer"',

  // === Marketing (2) ===
  '"freelance growth"',
  '"freelance social media"',

  // === Creative (4) ===
  '"freelance video editor"',
  '"freelance motion"',
  '"freelance animator"',
  '"contract creative"',

  // === QA & Testing (3) ===
  '"freelance QA"',
  '"freelance tester"',
  '"QA tester" remote',

  // === Other (5) ===
  '"freelance consultant"',
  '"freelance project manager"',
  '"freelance data analyst"',
  '"freelance recruiter"',
  '"freelance research"',
];

// Total count
export const TOTAL_KEYWORDS = FREELANCE_SEARCH_QUERIES.length; // 112

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
