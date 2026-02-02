/**
 * Greenhouse Company Discovery Configuration
 *
 * Search queries for finding new companies on Greenhouse via Google Search.
 * Organized by 21 job categories matching site.ts categories.
 *
 * ~510 US queries + ~20 international queries = ~530 total
 *
 * Run weekly via Apify → /api/cron/discover-greenhouse
 */

const SITE = 'site:boards.greenhouse.io';

// Search queries organized by category (21 categories)
export const GREENHOUSE_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  // ── Tech (6 categories) ──────────────────────────────────────────────────

  engineering: [
    // Core roles
    `"software engineer" ${SITE}`,
    `"developer" ${SITE}`,
    `"frontend engineer" ${SITE}`,
    `"backend engineer" ${SITE}`,
    `"fullstack" ${SITE}`,
    `"mobile engineer" ${SITE}`,
    // Seniority levels
    `"staff engineer" ${SITE}`,
    `"principal engineer" ${SITE}`,
    `"senior software engineer" ${SITE}`,
    `"engineering manager" ${SITE}`,
    `"VP engineering" ${SITE}`,
    `"technical lead" ${SITE}`,
    `"CTO" ${SITE}`,
    // Technologies
    `"react" "engineer" ${SITE}`,
    `"python" "engineer" ${SITE}`,
    `"golang" "engineer" ${SITE}`,
    `"rust" "engineer" ${SITE}`,
    `"java" "engineer" ${SITE}`,
    `"ruby on rails" ${SITE}`,
    `"node.js" "engineer" ${SITE}`,
    `"typescript" "engineer" ${SITE}`,
    `"swift" "developer" ${SITE}`,
    `"flutter" "developer" ${SITE}`,
    `"angular" "developer" ${SITE}`,
    `"vue.js" "developer" ${SITE}`,
    `"c++" "engineer" ${SITE}`,
    `"scala" "engineer" ${SITE}`,
    // More technologies
    `"kotlin" "developer" ${SITE}`,
    `"elixir" "engineer" ${SITE}`,
    `"php" "developer" ${SITE}`,
    `"django" "developer" ${SITE}`,
    `"embedded" "engineer" ${SITE}`,
    `"firmware" "engineer" ${SITE}`,
    `"DBA" ${SITE}`,
    // Industries
    `"software engineer" "fintech" ${SITE}`,
    `"software engineer" "healthtech" ${SITE}`,
    `"software engineer" "AI startup" ${SITE}`,
    `"software engineer" "blockchain" ${SITE}`,
    `"software engineer" "climate tech" ${SITE}`,
    `"software engineer" "edtech" ${SITE}`,
    `"software engineer" "cybersecurity" ${SITE}`,
    `"software engineer" "Web3" ${SITE}`,
    `"software engineer" "SaaS" ${SITE}`,
    `"software engineer" "B2B" ${SITE}`,
    `"software engineer" "remote" ${SITE}`,
  ],

  design: [
    `"product designer" ${SITE}`,
    `"ux designer" ${SITE}`,
    `"ui designer" ${SITE}`,
    `"visual designer" ${SITE}`,
    `"design lead" ${SITE}`,
    `"senior product designer" ${SITE}`,
    `"staff designer" ${SITE}`,
    `"head of design" ${SITE}`,
    `"design manager" ${SITE}`,
    `"interaction designer" ${SITE}`,
    `"design systems" ${SITE}`,
    `"brand designer" ${SITE}`,
    `"graphic designer" ${SITE}`,
    `"ux/ui designer" ${SITE}`,
    `"design director" ${SITE}`,
    `"web designer" ${SITE}`,
    `"design" "figma" ${SITE}`,
    `"design" "SaaS" ${SITE}`,
    `"design" "fintech" ${SITE}`,
    `"design" "healthtech" ${SITE}`,
    `"design" "AI startup" ${SITE}`,
    `"design" "remote" ${SITE}`,
    `"design" "B2B" ${SITE}`,
    `"design" "edtech" ${SITE}`,
  ],

  data: [
    `"data scientist" ${SITE}`,
    `"data engineer" ${SITE}`,
    `"data analyst" ${SITE}`,
    `"machine learning" ${SITE}`,
    `"ai engineer" ${SITE}`,
    `"senior data scientist" ${SITE}`,
    `"staff data engineer" ${SITE}`,
    `"analytics engineer" ${SITE}`,
    `"ml engineer" ${SITE}`,
    `"deep learning" ${SITE}`,
    `"nlp engineer" ${SITE}`,
    `"computer vision" ${SITE}`,
    `"data platform" ${SITE}`,
    `"business intelligence" ${SITE}`,
    `"Snowflake" "engineer" ${SITE}`,
    `"dbt" "analytics" ${SITE}`,
    `"Databricks" ${SITE}`,
    `"data" "AI startup" ${SITE}`,
    `"mlops" ${SITE}`,
    `"head of data" ${SITE}`,
    `"data science manager" ${SITE}`,
    `"LLM" "engineer" ${SITE}`,
    `"generative AI" ${SITE}`,
    `"data" "fintech" ${SITE}`,
    `"data" "healthtech" ${SITE}`,
    `"data" "remote" ${SITE}`,
    `"data warehouse" ${SITE}`,
    `"ETL" "engineer" ${SITE}`,
  ],

  devops: [
    `"devops engineer" ${SITE}`,
    `"sre" ${SITE}`,
    `"platform engineer" ${SITE}`,
    `"cloud engineer" ${SITE}`,
    `"infrastructure engineer" ${SITE}`,
    `"senior devops" ${SITE}`,
    `"site reliability" ${SITE}`,
    `"kubernetes" "engineer" ${SITE}`,
    `"aws" "engineer" ${SITE}`,
    `"terraform" "engineer" ${SITE}`,
    `"docker" "engineer" ${SITE}`,
    `"cloud architect" ${SITE}`,
    `"devsecops" ${SITE}`,
    `"release engineer" ${SITE}`,
    `"build engineer" ${SITE}`,
    `"systems engineer" ${SITE}`,
    `"platform" "SaaS" ${SITE}`,
    `"GCP" "engineer" ${SITE}`,
    `"Azure" "engineer" ${SITE}`,
    `"infrastructure" "fintech" ${SITE}`,
    `"head of infrastructure" ${SITE}`,
    `"devops" "SaaS" ${SITE}`,
    `"devops" "remote" ${SITE}`,
    `"network engineer" ${SITE}`,
    `"production engineer" ${SITE}`,
    `"infrastructure" "remote" ${SITE}`,
  ],

  qa: [
    `"qa engineer" ${SITE}`,
    `"test engineer" ${SITE}`,
    `"quality assurance" ${SITE}`,
    `"automation engineer" ${SITE}`,
    `"SDET" ${SITE}`,
    `"senior qa engineer" ${SITE}`,
    `"qa lead" ${SITE}`,
    `"qa manager" ${SITE}`,
    `"test automation" ${SITE}`,
    `"quality engineer" ${SITE}`,
    `"performance testing" ${SITE}`,
    `"qa analyst" ${SITE}`,
    `"software tester" ${SITE}`,
    `"manual qa" ${SITE}`,
    `"selenium" "engineer" ${SITE}`,
    `"cypress" "engineer" ${SITE}`,
    `"qa" "SaaS" ${SITE}`,
    `"qa" "fintech" ${SITE}`,
    `"qa" "remote" ${SITE}`,
    `"qa" "mobile" ${SITE}`,
    `"qa" "API" ${SITE}`,
    `"playwright" "engineer" ${SITE}`,
  ],

  security: [
    `"security engineer" ${SITE}`,
    `"cybersecurity" ${SITE}`,
    `"information security" ${SITE}`,
    `"security analyst" ${SITE}`,
    `"application security" ${SITE}`,
    `"security architect" ${SITE}`,
    `"penetration tester" ${SITE}`,
    `"CISO" ${SITE}`,
    `"SOC analyst" ${SITE}`,
    `"cloud security" ${SITE}`,
    `"security operations" ${SITE}`,
    `"head of security" ${SITE}`,
    `"GRC" "analyst" ${SITE}`,
    `"threat intelligence" ${SITE}`,
    `"security" "fintech" ${SITE}`,
    `"security" "Web3" ${SITE}`,
    `"security" "SaaS" ${SITE}`,
    `"security" "remote" ${SITE}`,
    `"security" "crypto" ${SITE}`,
    `"security" "healthtech" ${SITE}`,
    `"vulnerability" "analyst" ${SITE}`,
    `"IAM" "engineer" ${SITE}`,
  ],

  // ── Business (8 categories) ──────────────────────────────────────────────

  product: [
    `"product manager" ${SITE}`,
    `"product owner" ${SITE}`,
    `"product lead" ${SITE}`,
    `"head of product" ${SITE}`,
    `"senior product manager" ${SITE}`,
    `"principal product manager" ${SITE}`,
    `"group product manager" ${SITE}`,
    `"VP product" ${SITE}`,
    `"director of product" ${SITE}`,
    `"CPO" ${SITE}`,
    `"technical product manager" ${SITE}`,
    `"product analyst" ${SITE}`,
    `"product operations" ${SITE}`,
    `"TPM" ${SITE}`,
    `"product" "SaaS" ${SITE}`,
    `"product" "B2B" ${SITE}`,
    `"product" "fintech" ${SITE}`,
    `"product" "edtech" ${SITE}`,
    `"product" "AI startup" ${SITE}`,
    `"product" "healthtech" ${SITE}`,
    `"product" "climate tech" ${SITE}`,
    `"product" "cybersecurity" ${SITE}`,
    `"product" "remote" ${SITE}`,
    `"product strategy" ${SITE}`,
  ],

  marketing: [
    `"marketing manager" ${SITE}`,
    `"growth marketing" ${SITE}`,
    `"content marketing" ${SITE}`,
    `"performance marketing" ${SITE}`,
    `"demand generation" ${SITE}`,
    `"product marketing" ${SITE}`,
    `"digital marketing" ${SITE}`,
    `"brand marketing" ${SITE}`,
    `"marketing director" ${SITE}`,
    `"VP marketing" ${SITE}`,
    `"CMO" ${SITE}`,
    `"head of marketing" ${SITE}`,
    `"SEO" "specialist" ${SITE}`,
    `"paid media" ${SITE}`,
    `"lifecycle marketing" ${SITE}`,
    `"email marketing" ${SITE}`,
    `"field marketing" ${SITE}`,
    `"marketing" "SaaS" ${SITE}`,
    `"marketing" "B2B" ${SITE}`,
    `"marketing operations" ${SITE}`,
    `"community manager" ${SITE}`,
    `"social media manager" ${SITE}`,
    `"marketing analyst" ${SITE}`,
    `"marketing" "healthtech" ${SITE}`,
    `"marketing" "fintech" ${SITE}`,
    `"marketing" "AI startup" ${SITE}`,
    `"marketing" "remote" ${SITE}`,
    `"influencer marketing" ${SITE}`,
    `"event marketing" ${SITE}`,
  ],

  sales: [
    `"account executive" ${SITE}`,
    `"sales engineer" ${SITE}`,
    `"sales representative" ${SITE}`,
    `"business development" ${SITE}`,
    `"customer success" ${SITE}`,
    `"sales manager" ${SITE}`,
    `"VP sales" ${SITE}`,
    `"head of sales" ${SITE}`,
    `"sales director" ${SITE}`,
    `"SDR" ${SITE}`,
    `"BDR" ${SITE}`,
    `"account manager" ${SITE}`,
    `"enterprise sales" ${SITE}`,
    `"solutions consultant" ${SITE}`,
    `"revenue" "manager" ${SITE}`,
    `"CRO" ${SITE}`,
    `"sales" "SaaS" ${SITE}`,
    `"sales" "B2B" ${SITE}`,
    `"sales operations" ${SITE}`,
    `"customer success manager" ${SITE}`,
    `"partnership" "manager" ${SITE}`,
    `"channel sales" ${SITE}`,
    `"pre-sales" ${SITE}`,
    `"sales" "fintech" ${SITE}`,
    `"sales" "healthtech" ${SITE}`,
    `"sales" "AI startup" ${SITE}`,
    `"sales" "remote" ${SITE}`,
    `"inside sales" ${SITE}`,
    `"sales enablement" ${SITE}`,
  ],

  finance: [
    `"financial analyst" ${SITE}`,
    `"accountant" ${SITE}`,
    `"controller" ${SITE}`,
    `"finance manager" ${SITE}`,
    `"fp&a" ${SITE}`,
    `"CFO" ${SITE}`,
    `"VP finance" ${SITE}`,
    `"head of finance" ${SITE}`,
    `"finance director" ${SITE}`,
    `"tax" "manager" ${SITE}`,
    `"treasury" ${SITE}`,
    `"audit" "manager" ${SITE}`,
    `"accounts payable" ${SITE}`,
    `"accounts receivable" ${SITE}`,
    `"bookkeeper" ${SITE}`,
    `"payroll" "specialist" ${SITE}`,
    `"finance" "fintech" ${SITE}`,
    `"finance" "SaaS" ${SITE}`,
    `"financial controller" ${SITE}`,
    `"senior accountant" ${SITE}`,
    `"finance" "crypto" ${SITE}`,
    `"finance" "remote" ${SITE}`,
    `"billing" "specialist" ${SITE}`,
    `"revenue accountant" ${SITE}`,
  ],

  hr: [
    `"recruiter" ${SITE}`,
    `"talent acquisition" ${SITE}`,
    `"hr manager" ${SITE}`,
    `"people operations" ${SITE}`,
    `"hr business partner" ${SITE}`,
    `"head of people" ${SITE}`,
    `"VP people" ${SITE}`,
    `"CHRO" ${SITE}`,
    `"people partner" ${SITE}`,
    `"hr director" ${SITE}`,
    `"talent partner" ${SITE}`,
    `"technical recruiter" ${SITE}`,
    `"sourcer" ${SITE}`,
    `"compensation" "analyst" ${SITE}`,
    `"benefits" "specialist" ${SITE}`,
    `"DEIB" ${SITE}`,
    `"employer brand" ${SITE}`,
    `"hr coordinator" ${SITE}`,
    `"people analytics" ${SITE}`,
    `"hr" "SaaS" ${SITE}`,
    `"hr" "remote" ${SITE}`,
    `"hr" "fintech" ${SITE}`,
    `"recruiting coordinator" ${SITE}`,
    `"hris" "analyst" ${SITE}`,
  ],

  operations: [
    `"operations manager" ${SITE}`,
    `"operations analyst" ${SITE}`,
    `"business operations" ${SITE}`,
    `"revenue operations" ${SITE}`,
    `"head of operations" ${SITE}`,
    `"VP operations" ${SITE}`,
    `"COO" ${SITE}`,
    `"operations director" ${SITE}`,
    `"strategy" "operations" ${SITE}`,
    `"go-to-market" ${SITE}`,
    `"deal desk" ${SITE}`,
    `"revops" ${SITE}`,
    `"supply chain" ${SITE}`,
    `"procurement" ${SITE}`,
    `"logistics" "manager" ${SITE}`,
    `"operations" "SaaS" ${SITE}`,
    `"operations" "fintech" ${SITE}`,
    `"chief of staff" ${SITE}`,
    `"operations" "remote" ${SITE}`,
    `"operations" "healthtech" ${SITE}`,
    `"operations" "AI startup" ${SITE}`,
    `"business analyst" ${SITE}`,
    `"process improvement" ${SITE}`,
  ],

  legal: [
    `"legal counsel" ${SITE}`,
    `"attorney" ${SITE}`,
    `"paralegal" ${SITE}`,
    `"contracts manager" ${SITE}`,
    `"compliance" ${SITE}`,
    `"general counsel" ${SITE}`,
    `"head of legal" ${SITE}`,
    `"VP legal" ${SITE}`,
    `"corporate counsel" ${SITE}`,
    `"privacy counsel" ${SITE}`,
    `"employment lawyer" ${SITE}`,
    `"ip counsel" ${SITE}`,
    `"legal operations" ${SITE}`,
    `"compliance manager" ${SITE}`,
    `"regulatory" "analyst" ${SITE}`,
    `"legal" "fintech" ${SITE}`,
    `"legal" "crypto" ${SITE}`,
    `"legal" "SaaS" ${SITE}`,
    `"legal" "remote" ${SITE}`,
    `"legal" "healthtech" ${SITE}`,
    `"data privacy" "counsel" ${SITE}`,
  ],

  'project-management': [
    `"project manager" ${SITE}`,
    `"program manager" ${SITE}`,
    `"scrum master" ${SITE}`,
    `"delivery manager" ${SITE}`,
    `"senior project manager" ${SITE}`,
    `"technical program manager" ${SITE}`,
    `"agile coach" ${SITE}`,
    `"PMO" ${SITE}`,
    `"release manager" ${SITE}`,
    `"project coordinator" ${SITE}`,
    `"program director" ${SITE}`,
    `"implementation manager" ${SITE}`,
    `"project" "SaaS" ${SITE}`,
    `"project" "fintech" ${SITE}`,
    `"project" "healthtech" ${SITE}`,
    `"project" "remote" ${SITE}`,
    `"project" "AI startup" ${SITE}`,
    `"project" "B2B" ${SITE}`,
    `"IT project manager" ${SITE}`,
  ],

  // ── Content & Creative (3 categories) ────────────────────────────────────

  writing: [
    `"content writer" ${SITE}`,
    `"copywriter" ${SITE}`,
    `"technical writer" ${SITE}`,
    `"content strategist" ${SITE}`,
    `"editor" ${SITE}`,
    `"senior copywriter" ${SITE}`,
    `"blog writer" ${SITE}`,
    `"content manager" ${SITE}`,
    `"documentation" "writer" ${SITE}`,
    `"UX writer" ${SITE}`,
    `"content lead" ${SITE}`,
    `"head of content" ${SITE}`,
    `"content" "SaaS" ${SITE}`,
    `"content" "B2B" ${SITE}`,
    `"managing editor" ${SITE}`,
    `"content" "fintech" ${SITE}`,
    `"content" "AI startup" ${SITE}`,
    `"content" "remote" ${SITE}`,
    `"SEO content" ${SITE}`,
    `"content director" ${SITE}`,
  ],

  translation: [
    `"translator" ${SITE}`,
    `"localization" ${SITE}`,
    `"interpreter" ${SITE}`,
    `"localization manager" ${SITE}`,
    `"language specialist" ${SITE}`,
    `"localization engineer" ${SITE}`,
    `"localization coordinator" ${SITE}`,
    `"translation" "manager" ${SITE}`,
    `"i18n" ${SITE}`,
    `"internationalization" ${SITE}`,
    `"linguist" ${SITE}`,
    `"localization" "SaaS" ${SITE}`,
    `"localization QA" ${SITE}`,
    `"translation" "lead" ${SITE}`,
    `"globalization" ${SITE}`,
  ],

  creative: [
    `"video editor" ${SITE}`,
    `"motion designer" ${SITE}`,
    `"animator" ${SITE}`,
    `"creative director" ${SITE}`,
    `"multimedia" ${SITE}`,
    `"video producer" ${SITE}`,
    `"3d artist" ${SITE}`,
    `"illustrator" ${SITE}`,
    `"art director" ${SITE}`,
    `"photographer" ${SITE}`,
    `"creative producer" ${SITE}`,
    `"head of creative" ${SITE}`,
    `"content creator" ${SITE}`,
    `"visual" "storytelling" ${SITE}`,
    `"creative" "SaaS" ${SITE}`,
    `"creative" "fintech" ${SITE}`,
    `"creative" "remote" ${SITE}`,
    `"creative" "AI startup" ${SITE}`,
    `"sound designer" ${SITE}`,
    `"graphic" "senior" ${SITE}`,
  ],

  // ── Other (4 categories) ─────────────────────────────────────────────────

  support: [
    `"customer support" ${SITE}`,
    `"customer service" ${SITE}`,
    `"support engineer" ${SITE}`,
    `"technical support" ${SITE}`,
    `"support manager" ${SITE}`,
    `"head of support" ${SITE}`,
    `"support lead" ${SITE}`,
    `"help desk" ${SITE}`,
    `"customer experience" ${SITE}`,
    `"support operations" ${SITE}`,
    `"tier 2 support" ${SITE}`,
    `"support" "SaaS" ${SITE}`,
    `"support" "B2B" ${SITE}`,
    `"customer advocate" ${SITE}`,
    `"support specialist" ${SITE}`,
    `"support" "fintech" ${SITE}`,
    `"support" "remote" ${SITE}`,
    `"support" "AI startup" ${SITE}`,
    `"support" "healthtech" ${SITE}`,
    `"customer operations" ${SITE}`,
  ],

  education: [
    `"instructional designer" ${SITE}`,
    `"training specialist" ${SITE}`,
    `"learning" ${SITE}`,
    `"curriculum" ${SITE}`,
    `"learning designer" ${SITE}`,
    `"training manager" ${SITE}`,
    `"e-learning" ${SITE}`,
    `"education" "manager" ${SITE}`,
    `"education" "edtech" ${SITE}`,
    `"course developer" ${SITE}`,
    `"head of learning" ${SITE}`,
    `"L&D" ${SITE}`,
    `"enablement" "specialist" ${SITE}`,
    `"onboarding" "specialist" ${SITE}`,
    `"education" "content" ${SITE}`,
    `"education" "remote" ${SITE}`,
    `"education" "SaaS" ${SITE}`,
    `"education technology" ${SITE}`,
    `"academic" "coordinator" ${SITE}`,
    `"sales enablement" "specialist" ${SITE}`,
  ],

  research: [
    `"researcher" ${SITE}`,
    `"ux researcher" ${SITE}`,
    `"user researcher" ${SITE}`,
    `"research scientist" ${SITE}`,
    `"senior researcher" ${SITE}`,
    `"research engineer" ${SITE}`,
    `"head of research" ${SITE}`,
    `"research manager" ${SITE}`,
    `"market researcher" ${SITE}`,
    `"research analyst" ${SITE}`,
    `"quantitative researcher" ${SITE}`,
    `"research" "AI startup" ${SITE}`,
    `"research" "healthtech" ${SITE}`,
    `"applied scientist" ${SITE}`,
    `"research director" ${SITE}`,
    `"research" "fintech" ${SITE}`,
    `"research" "remote" ${SITE}`,
    `"research" "SaaS" ${SITE}`,
    `"clinical researcher" ${SITE}`,
    `"policy researcher" ${SITE}`,
  ],

  consulting: [
    `"consultant" ${SITE}`,
    `"solutions architect" ${SITE}`,
    `"implementation" ${SITE}`,
    `"professional services" ${SITE}`,
    `"senior consultant" ${SITE}`,
    `"management consultant" ${SITE}`,
    `"strategy consultant" ${SITE}`,
    `"solutions engineer" ${SITE}`,
    `"implementation consultant" ${SITE}`,
    `"customer engineer" ${SITE}`,
    `"technical consultant" ${SITE}`,
    `"onboarding" "manager" ${SITE}`,
    `"consulting" "SaaS" ${SITE}`,
    `"consulting" "fintech" ${SITE}`,
    `"engagement manager" ${SITE}`,
    `"consulting" "remote" ${SITE}`,
    `"consulting" "healthtech" ${SITE}`,
    `"consulting" "AI startup" ${SITE}`,
    `"customer onboarding" ${SITE}`,
    `"delivery consultant" ${SITE}`,
  ],
};

// ─── International Queries (~20 total) ────────────────────────────────────────

export const GREENHOUSE_INTL_QUERIES: string[] = [
  // French
  `"développeur" ${SITE}`,
  `"ingénieur logiciel" ${SITE}`,
  `"développeur frontend" ${SITE}`,
  `"développeur backend" ${SITE}`,
  `"chef de produit" ${SITE}`,

  // Spanish
  `"desarrollador" ${SITE}`,
  `"ingeniero de software" ${SITE}`,
  `"desarrollador frontend" ${SITE}`,
  `"gerente de producto" ${SITE}`,

  // German
  `"Softwareentwickler" ${SITE}`,
  `"Entwickler" ${SITE}`,
  `"Frontend-Entwickler" ${SITE}`,
  `"Produktmanager" ${SITE}`,

  // Portuguese
  `"desenvolvedor" ${SITE}`,
  `"engenheiro de software" ${SITE}`,
  `"desenvolvedor frontend" ${SITE}`,
  `"gerente de produto" ${SITE}`,

  // Dutch
  `"software ontwikkelaar" ${SITE}`,

  // Italian
  `"sviluppatore" ${SITE}`,

  // Polish
  `"programista" ${SITE}`,

  // Japanese
  `"エンジニア" ${SITE}`,

  // Korean
  `"소프트웨어 엔지니어" ${SITE}`,

  // Swedish
  `"mjukvaruutvecklare" ${SITE}`,

  // Danish
  `"softwareudvikler" ${SITE}`,

  // Norwegian
  `"utvikler" ${SITE}`,

  // Finnish
  `"ohjelmistokehittäjä" ${SITE}`,

  // Czech
  `"vývojář" ${SITE}`,

  // Hungarian
  `"szoftverfejlesztő" ${SITE}`,

  // French (more roles)
  `"analyste données" ${SITE}`,
  `"responsable marketing" ${SITE}`,
  `"développeur backend" ${SITE}`,

  // Spanish (more roles)
  `"desarrollador backend" ${SITE}`,
  `"analista de datos" ${SITE}`,

  // German (more roles)
  `"Backend-Entwickler" ${SITE}`,
  `"Datenanalyst" ${SITE}`,
];

// ─── Merged flat list ─────────────────────────────────────────────────────────

const usQueries = Object.values(GREENHOUSE_QUERIES_BY_CATEGORY).flat();

// Deduplicate
export const GREENHOUSE_SEARCH_QUERIES = [
  ...new Set([...usQueries, ...GREENHOUSE_INTL_QUERIES]),
];

// Get queries for specific category
export function getQueriesForCategory(category: string): string[] {
  return GREENHOUSE_QUERIES_BY_CATEGORY[category] || [];
}

// Get all queries as newline-separated string (for Apify input)
export function getAllQueriesAsString(): string {
  return GREENHOUSE_SEARCH_QUERIES.join('\n');
}

/**
 * Extract company slug from Greenhouse job URL
 * Examples:
 *   https://boards.greenhouse.io/stripe/jobs/123 → "stripe"
 *   https://boards.greenhouse.io/airbnb → "airbnb"
 *   https://job-boards.greenhouse.io/notion/jobs/456 → "notion"
 */
export function extractGreenhouseSlug(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Must be greenhouse.io
    if (!parsed.hostname.includes('greenhouse.io')) {
      return null;
    }

    // Path format: /{company-slug}/jobs/{job-id} or /{company-slug}
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 1) {
      const slug = pathParts[0].toLowerCase();

      // Skip generic/invalid slugs
      if (slug.length < 2 || slug === 'jobs' || slug === 'embed') {
        return null;
      }

      return slug;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract unique company slugs from array of URLs
 */
export function extractUniqueSlugs(urls: string[]): string[] {
  const slugs = new Set<string>();

  for (const url of urls) {
    const slug = extractGreenhouseSlug(url);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort();
}
