/**
 * Freelance LinkedIn Posts Discovery Configuration
 *
 * 126 search queries for finding freelance/contract opportunities.
 * Used by n8n workflow via /api/linkedin/next-keyword endpoint.
 *
 * Rotation: every 10 minutes, next keyword in list (sequential, not random)
 * Full cycle: 126 × 10 min = ~21 hours
 *
 * Updated 2026-03-28:
 * - Standardized translator/interpreter lists to top-20 languages
 * - Added keywords for engineering, design, data, devops, marketing, HR, sales, security
 * - Removed low-performing general keywords ("short term project", "quick project", "need contractor")
 *
 * Previously removed (low conversion):
 * - "localization project", "contract marketing", "freelance SEO"
 * - "freelance photographer", "freelance illustrator", "LQA", "localization QA"
 * - "freelance bookkeeper", "freelance accountant", "freelance marketing"
 * - "freelancer needed" (1%), "transcreation" (3%) — removed 2026-02-05
 * - Dead/near-dead language keywords — removed 2026-03-28
 */

// ============================================
// All 126 Freelance Search Queries
// ============================================

export const FREELANCE_SEARCH_QUERIES = [
  // === General Freelance Phrases (12) ===
  '"looking for freelance"',
  '"hiring freelancer"',
  '"need a freelancer"',
  '"seeking freelancer"',
  '"freelance opportunity"',
  '"looking for contractor"',
  '"hiring contractor"',
  '"contract opportunity"',
  '"project based"',
  '"immediate project"',
  '"hourly rate"',
  '"per project"',

  // === Engineering (12) — 25 paid users ===
  '"freelance developer"',
  '"freelance engineer"',
  '"contract developer"',
  '"freelance react"',
  '"freelance fullstack"',
  '"freelance backend"',
  '"freelance frontend"',
  '"freelance python"',
  '"freelance java"',
  '"freelance mobile developer"',
  '"freelance DevOps"',
  '"freelance cloud engineer"',

  // === Design (8) — 17 paid users ===
  '"freelance designer"',
  '"freelance UX"',
  '"freelance UI designer"',
  '"freelance product designer"',
  '"contract designer"',
  '"freelance graphic designer"',
  '"freelance brand designer"',
  '"freelance Figma"',

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

  // === Translators - Top 20 Languages ===
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
  '"turkish translator"',
  '"polish translator"',
  '"dutch translator"',
  '"italian translator"',
  '"vietnamese translator"',
  '"thai translator"',
  '"indonesian translator"',
  '"ukrainian translator"',
  '"swedish translator"',
  '"greek translator"',

  // === Interpreters - Top 20 Languages ===
  '"french interpreter"',
  '"chinese interpreter"',
  '"spanish interpreter"',
  '"japanese interpreter"',
  '"arabic interpreter"',
  '"portuguese interpreter"',
  '"german interpreter"',
  '"russian interpreter"',
  '"korean interpreter"',
  '"hindi interpreter"',
  '"turkish interpreter"',
  '"polish interpreter"',
  '"dutch interpreter"',
  '"italian interpreter"',
  '"vietnamese interpreter"',
  '"thai interpreter"',
  '"indonesian interpreter"',
  '"ukrainian interpreter"',
  '"swedish interpreter"',
  '"greek interpreter"',

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

  // === Writing (6) — 8 paid users ===
  '"freelance writer"',
  '"freelance copywriter"',
  '"freelance content writer"',
  '"contract writer"',
  '"freelance editor"',
  '"freelance technical writer"',

  // === Marketing (4) — 8 paid users ===
  '"freelance growth"',
  '"freelance social media"',
  '"freelance PPC"',
  '"freelance email marketing"',

  // === Creative (4) — 7 paid users ===
  '"freelance video editor"',
  '"freelance motion"',
  '"freelance animator"',
  '"contract creative"',

  // === Data (4) — 10 paid users ===
  '"freelance data analyst"',
  '"freelance data engineer"',
  '"freelance data scientist"',
  '"freelance BI"',

  // === QA & Testing (3) — 9 paid users ===
  '"freelance QA"',
  '"freelance tester"',
  '"QA tester" remote',

  // === DevOps (2) — 7 paid users ===
  '"contract DevOps"',
  '"freelance SRE"',

  // === HR (2) — 5 paid users ===
  '"freelance HR"',
  '"freelance talent acquisition"',

  // === Project Management (2) — 5 paid users ===
  '"freelance project manager"',
  '"contract project manager"',

  // === Security (1) — 3 paid users ===
  '"freelance cybersecurity"',

  // === Sales (1) — 4 paid users ===
  '"freelance sales"',

  // === Other (4) ===
  '"freelance consultant"',
  '"freelance recruiter"',
  '"freelance research"',
  '"freelance customer support"',
];

// Total count
export const TOTAL_KEYWORDS = FREELANCE_SEARCH_QUERIES.length; // 126

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
