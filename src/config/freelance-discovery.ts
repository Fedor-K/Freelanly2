/**
 * Freelance LinkedIn Posts Discovery Configuration
 *
 * 150 search queries for finding freelance/contract opportunities.
 * Used by n8n workflow via /api/linkedin/next-keyword endpoint.
 *
 * Rotation: every 10 minutes, next keyword in list (sequential, not random)
 * Full cycle: 150 × 10 min = ~25 hours
 *
 * Principle: specific skill + role (like "french translator", not "freelance translator")
 *
 * Updated 2026-03-28: full overhaul — skill-based keywords for all categories
 */

// ============================================
// All Freelance Search Queries
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

  // === Translation & Language - General (10) ===
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

  // === Translators - Top 20 Languages (20) ===
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

  // === Interpreters - Top 20 Languages (20) ===
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

  // === Specialized Translation (3) ===
  '"MTPE"',
  '"post-editing"',
  '"linguist" needed',

  // === Engineering (15) ===
  '"react developer"',
  '"python developer"',
  '"node developer"',
  '"java developer"',
  '"golang developer"',
  '"ruby developer"',
  '"PHP developer"',
  '"flutter developer"',
  '"iOS developer"',
  '"android developer"',
  '"fullstack developer"',
  '"backend developer"',
  '"frontend developer"',
  '"DevOps engineer"',
  '"cloud engineer"',

  // === Design (8) ===
  '"UX designer"',
  '"UI designer"',
  '"Figma designer"',
  '"brand designer"',
  '"graphic designer" freelance',
  '"product designer"',
  '"web designer" freelance',
  '"motion designer"',

  // === Writing (8) ===
  '"copywriter"',
  '"content writer"',
  '"technical writer"',
  '"blog writer"',
  '"ghostwriter"',
  '"UX writer"',
  '"grant writer"',
  '"freelance editor"',

  // === Marketing (8) ===
  '"Google Ads" specialist',
  '"Facebook Ads" specialist',
  '"SEO specialist"',
  '"email marketing" freelance',
  '"social media manager" freelance',
  '"content marketing" freelance',
  '"PPC specialist"',
  '"growth marketer"',

  // === Data (8) ===
  '"data analyst" freelance',
  '"data engineer" freelance',
  '"data scientist" freelance',
  '"Power BI" freelance',
  '"Tableau" freelance',
  '"SQL analyst"',
  '"machine learning"',
  '"business analyst"',

  // === Creative (6) ===
  '"video editor"',
  '"motion graphics"',
  '"3D artist"',
  '"animator" freelance',
  '"sound designer"',
  '"illustrator"',

  // === QA & Testing (4) ===
  '"QA engineer"',
  '"QA tester" remote',
  '"automation tester"',
  '"manual tester" freelance',

  // === DevOps (4) ===
  '"AWS engineer"',
  '"Azure engineer"',
  '"Kubernetes engineer"',
  '"SRE engineer"',

  // === Security (3) ===
  '"cybersecurity" freelance',
  '"penetration tester"',
  '"security engineer" freelance',

  // === HR (3) ===
  '"freelance recruiter"',
  '"talent acquisition" freelance',
  '"HR consultant"',

  // === Project Management (3) ===
  '"project manager" freelance',
  '"scrum master" freelance',
  '"product manager" freelance',

  // === Sales (2) ===
  '"sales consultant" freelance',
  '"business development" freelance',

  // === Other (4) ===
  '"freelance consultant"',
  '"freelance research"',
  '"customer support"',
  '"virtual assistant" freelance',
];

// Total count
export const TOTAL_KEYWORDS = FREELANCE_SEARCH_QUERIES.length;

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
