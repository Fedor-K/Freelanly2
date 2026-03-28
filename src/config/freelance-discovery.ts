/**
 * Freelance LinkedIn Posts Discovery Configuration
 *
 * Search queries for finding freelance/contract opportunities.
 * Used by n8n workflow via /api/linkedin/next-keyword endpoint.
 *
 * Rotation: every 10 minutes, next keyword in list (sequential, not random)
 *
 * Updated 2026-03-28: full overhaul — skill-based keywords for all categories
 */

// ============================================
// All Freelance Search Queries
// ============================================

export const FREELANCE_SEARCH_QUERIES = [
  // === General Freelance Phrases ===
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

  // === Translation & Language - General ===
  '"freelance translation"',
  '"translation project"',
  '"need translator"',
  '"looking for translator"',
  '"hiring translator"',
  '"freelance localization"',
  '"freelance interpreter"',
  '"freelance subtitler"',

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

  // === Interpreters - General ===
  '"hiring interpreter"',
  '"need interpreter"',
  '"looking for interpreter"',
  '"medical interpreter"',
  '"simultaneous interpreter"',

  // === Engineering ===
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

  // === Design ===
  '"UX designer"',
  '"UI designer"',
  '"Figma designer"',
  '"brand designer"',
  '"graphic designer"',
  '"product designer"',
  '"web designer"',
  '"motion designer"',

  // === Writing ===
  '"copywriter"',
  '"content writer"',
  '"technical writer"',
  '"blog writer"',
  '"ghostwriter"',
  '"UX writer"',
  '"grant writer"',
  '"freelance editor"',

  // === Marketing ===
  '"Google Ads" specialist',
  '"Facebook Ads" specialist',
  '"SEO specialist"',
  '"email marketing"',
  '"social media manager" freelance',
  '"content marketing"',
  '"PPC specialist"',

  // === Data ===
  '"data analyst" freelance',
  '"data engineer" freelance',
  '"data scientist" freelance',
  '"Power BI" freelance',
  '"Tableau" freelance',
  '"SQL analyst"',
  '"machine learning"',
  '"business analyst"',

  // === Creative ===
  '"video editor"',
  '"motion graphics"',
  '"3D artist"',
  '"animator" freelance',
  '"sound designer"',
  '"illustrator"',

  // === QA & Testing ===
  '"QA engineer"',
  '"QA tester" remote',
  '"automation tester"',
  '"manual tester"',

  // === DevOps ===
  '"AWS engineer"',
  '"Azure engineer"',
  '"Kubernetes engineer"',
  '"SRE engineer"',

  // === Security ===
  '"cybersecurity" freelance',
  '"penetration tester"',
  '"security engineer" freelance',

  // === HR ===
  '"freelance recruiter"',
  '"talent acquisition" freelance',
  '"HR consultant"',

  // === Project Management ===
  '"project manager" freelance',
  '"scrum master" freelance',
  '"product manager" freelance',

  // === Sales ===
  '"sales consultant" freelance',
  '"business development" freelance',

  // === Other ===
  '"freelance consultant"',
  '"freelance research"',
  '"customer support"',
  '"virtual assistant"',
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
