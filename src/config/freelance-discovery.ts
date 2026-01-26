/**
 * Freelance LinkedIn Posts Discovery Configuration
 *
 * 149 search queries for finding freelance/contract opportunities.
 * Used by n8n workflow via /api/linkedin/next-keyword endpoint.
 *
 * Rotation: every 10 minutes, next keyword in list (sequential, not random)
 * Full cycle: 149 × 10 min = ~24.8 hours
 *
 * Removed (0% conversion):
 * - "localization project", "contract marketing", "freelance SEO"
 * - "freelance photographer", "freelance illustrator", "LQA", "localization QA"
 * - "freelance bookkeeper", "freelance accountant", "freelance marketing"
 */

// ============================================
// All 149 Freelance Search Queries
// ============================================

export const FREELANCE_SEARCH_QUERIES = [
  // === General Freelance Phrases (17) ===
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

  // === Engineering (7) ===
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

  // === Translation & Language - General (16) ===
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

  // === Translators - By Language (30) ===
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
  '"thai translator"',
  '"indonesian translator"',
  '"malay translator"',
  '"hebrew translator"',
  '"romanian translator"',
  '"hungarian translator"',
  '"norwegian translator"',
  '"danish translator"',
  '"finnish translator"',
  '"bengali translator"',
  '"persian translator"',

  // === Interpreters - By Language (30) ===
  '"french interpreter"',
  '"chinese interpreter"',
  '"spanish interpreter"',
  '"japanese interpreter"',
  '"arabic interpreter"',
  '"portuguese interpreter"',
  '"italian interpreter"',
  '"german interpreter"',
  '"russian interpreter"',
  '"korean interpreter"',
  '"turkish interpreter"',
  '"hindi interpreter"',
  '"polish interpreter"',
  '"dutch interpreter"',
  '"swedish interpreter"',
  '"ukrainian interpreter"',
  '"czech interpreter"',
  '"greek interpreter"',
  '"vietnamese interpreter"',
  '"thai interpreter"',
  '"indonesian interpreter"',
  '"malay interpreter"',
  '"hebrew interpreter"',
  '"romanian interpreter"',
  '"hungarian interpreter"',
  '"norwegian interpreter"',
  '"danish interpreter"',
  '"finnish interpreter"',
  '"bengali interpreter"',
  '"persian interpreter"',

  // === Interpreters - General (6) ===
  '"hiring interpreter"',
  '"need interpreter"',
  '"looking for interpreter"',
  '"medical interpreter"',
  '"simultaneous interpreter"',

  // === Specialized Translation (6) ===
  '"MTPE"',
  '"post-editing"',
  '"subtitle" project',
  '"transcreation"',
  '"linguist" needed',

  // === Writing (8) ===
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

  // === Other (6) ===
  '"freelance consultant"',
  '"freelance project manager"',
  '"freelance data analyst"',
  '"freelance recruiter"',
  '"freelance customer support"',
  '"freelance research"',
];

// Total count
export const TOTAL_KEYWORDS = FREELANCE_SEARCH_QUERIES.length; // 149

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
