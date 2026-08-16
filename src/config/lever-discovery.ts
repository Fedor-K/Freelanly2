/**
 * Lever Company Discovery Configuration
 *
 * Search queries for finding new companies on Lever via Google Search.
 * Organized by 21 job categories matching site.ts categories.
 *
 * ~510 US queries + ~100 EU queries + ~40 international queries = ~650 total
 *
 * Run weekly via Apify → webhook → /api/webhooks/lever-discovery
 */

const SITE_US = 'site:jobs.lever.co';
const SITE_EU = 'site:jobs.eu.lever.co';

// ─── US Queries (21 categories, ~510 total) ───────────────────────────────────

export const LEVER_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  // ── Tech (6 categories) ──────────────────────────────────────────────────

  engineering: [
    // Core roles
    `"software engineer" ${SITE_US}`,
    `"developer" ${SITE_US}`,
    `"frontend engineer" ${SITE_US}`,
    `"backend engineer" ${SITE_US}`,
    `"fullstack" ${SITE_US}`,
    `"mobile engineer" ${SITE_US}`,
    // Seniority levels
    `"staff engineer" ${SITE_US}`,
    `"principal engineer" ${SITE_US}`,
    `"senior software engineer" ${SITE_US}`,
    `"engineering manager" ${SITE_US}`,
    `"VP engineering" ${SITE_US}`,
    `"technical lead" ${SITE_US}`,
    `"CTO" ${SITE_US}`,
    // Technologies
    `"react" "engineer" ${SITE_US}`,
    `"python" "engineer" ${SITE_US}`,
    `"golang" "engineer" ${SITE_US}`,
    `"rust" "engineer" ${SITE_US}`,
    `"java" "engineer" ${SITE_US}`,
    `"ruby on rails" ${SITE_US}`,
    `"node.js" "engineer" ${SITE_US}`,
    `"typescript" "engineer" ${SITE_US}`,
    `"swift" "developer" ${SITE_US}`,
    `"flutter" "developer" ${SITE_US}`,
    `"angular" "developer" ${SITE_US}`,
    `"vue.js" "developer" ${SITE_US}`,
    `"c++" "engineer" ${SITE_US}`,
    `"scala" "engineer" ${SITE_US}`,
    // More technologies
    `"kotlin" "developer" ${SITE_US}`,
    `"elixir" "engineer" ${SITE_US}`,
    `"php" "developer" ${SITE_US}`,
    `"django" "developer" ${SITE_US}`,
    `"embedded" "engineer" ${SITE_US}`,
    `"firmware" "engineer" ${SITE_US}`,
    `"DBA" ${SITE_US}`,
    // Industries
    `"software engineer" "fintech" ${SITE_US}`,
    `"software engineer" "healthtech" ${SITE_US}`,
    `"software engineer" "AI startup" ${SITE_US}`,
    `"software engineer" "blockchain" ${SITE_US}`,
    `"software engineer" "climate tech" ${SITE_US}`,
    `"software engineer" "edtech" ${SITE_US}`,
    `"software engineer" "cybersecurity" ${SITE_US}`,
    `"software engineer" "Web3" ${SITE_US}`,
    `"software engineer" "SaaS" ${SITE_US}`,
    `"software engineer" "B2B" ${SITE_US}`,
    `"software engineer" "remote" ${SITE_US}`,
  ],

  design: [
    `"product designer" ${SITE_US}`,
    `"ux designer" ${SITE_US}`,
    `"ui designer" ${SITE_US}`,
    `"visual designer" ${SITE_US}`,
    `"design lead" ${SITE_US}`,
    `"senior product designer" ${SITE_US}`,
    `"staff designer" ${SITE_US}`,
    `"head of design" ${SITE_US}`,
    `"design manager" ${SITE_US}`,
    `"interaction designer" ${SITE_US}`,
    `"design systems" ${SITE_US}`,
    `"brand designer" ${SITE_US}`,
    `"graphic designer" ${SITE_US}`,
    `"ux/ui designer" ${SITE_US}`,
    `"design director" ${SITE_US}`,
    `"web designer" ${SITE_US}`,
    `"design" "figma" ${SITE_US}`,
    `"design" "SaaS" ${SITE_US}`,
    `"design" "fintech" ${SITE_US}`,
    `"design" "healthtech" ${SITE_US}`,
    `"design" "AI startup" ${SITE_US}`,
    `"design" "remote" ${SITE_US}`,
    `"design" "B2B" ${SITE_US}`,
    `"design" "edtech" ${SITE_US}`,
  ],

  data: [
    `"data scientist" ${SITE_US}`,
    `"data engineer" ${SITE_US}`,
    `"data analyst" ${SITE_US}`,
    `"machine learning" ${SITE_US}`,
    `"ai engineer" ${SITE_US}`,
    `"senior data scientist" ${SITE_US}`,
    `"staff data engineer" ${SITE_US}`,
    `"analytics engineer" ${SITE_US}`,
    `"ml engineer" ${SITE_US}`,
    `"deep learning" ${SITE_US}`,
    `"nlp engineer" ${SITE_US}`,
    `"computer vision" ${SITE_US}`,
    `"data platform" ${SITE_US}`,
    `"business intelligence" ${SITE_US}`,
    `"Snowflake" "engineer" ${SITE_US}`,
    `"dbt" "analytics" ${SITE_US}`,
    `"Databricks" ${SITE_US}`,
    `"data" "AI startup" ${SITE_US}`,
    `"mlops" ${SITE_US}`,
    `"head of data" ${SITE_US}`,
    `"data science manager" ${SITE_US}`,
    `"LLM" "engineer" ${SITE_US}`,
    `"generative AI" ${SITE_US}`,
    `"data" "fintech" ${SITE_US}`,
    `"data" "healthtech" ${SITE_US}`,
    `"data" "remote" ${SITE_US}`,
    `"data warehouse" ${SITE_US}`,
    `"ETL" "engineer" ${SITE_US}`,
  ],

  devops: [
    `"devops engineer" ${SITE_US}`,
    `"sre" ${SITE_US}`,
    `"platform engineer" ${SITE_US}`,
    `"cloud engineer" ${SITE_US}`,
    `"infrastructure engineer" ${SITE_US}`,
    `"senior devops" ${SITE_US}`,
    `"site reliability" ${SITE_US}`,
    `"kubernetes" "engineer" ${SITE_US}`,
    `"aws" "engineer" ${SITE_US}`,
    `"terraform" "engineer" ${SITE_US}`,
    `"docker" "engineer" ${SITE_US}`,
    `"cloud architect" ${SITE_US}`,
    `"devsecops" ${SITE_US}`,
    `"release engineer" ${SITE_US}`,
    `"build engineer" ${SITE_US}`,
    `"systems engineer" ${SITE_US}`,
    `"platform" "SaaS" ${SITE_US}`,
    `"GCP" "engineer" ${SITE_US}`,
    `"Azure" "engineer" ${SITE_US}`,
    `"infrastructure" "fintech" ${SITE_US}`,
    `"head of infrastructure" ${SITE_US}`,
    `"devops" "SaaS" ${SITE_US}`,
    `"devops" "remote" ${SITE_US}`,
    `"network engineer" ${SITE_US}`,
    `"production engineer" ${SITE_US}`,
    `"infrastructure" "remote" ${SITE_US}`,
  ],

  qa: [
    `"qa engineer" ${SITE_US}`,
    `"test engineer" ${SITE_US}`,
    `"quality assurance" ${SITE_US}`,
    `"automation engineer" ${SITE_US}`,
    `"SDET" ${SITE_US}`,
    `"senior qa engineer" ${SITE_US}`,
    `"qa lead" ${SITE_US}`,
    `"qa manager" ${SITE_US}`,
    `"test automation" ${SITE_US}`,
    `"quality engineer" ${SITE_US}`,
    `"performance testing" ${SITE_US}`,
    `"qa analyst" ${SITE_US}`,
    `"software tester" ${SITE_US}`,
    `"manual qa" ${SITE_US}`,
    `"selenium" "engineer" ${SITE_US}`,
    `"cypress" "engineer" ${SITE_US}`,
    `"qa" "SaaS" ${SITE_US}`,
    `"qa" "fintech" ${SITE_US}`,
    `"qa" "remote" ${SITE_US}`,
    `"qa" "mobile" ${SITE_US}`,
    `"qa" "API" ${SITE_US}`,
    `"playwright" "engineer" ${SITE_US}`,
  ],

  security: [
    `"security engineer" ${SITE_US}`,
    `"cybersecurity" ${SITE_US}`,
    `"information security" ${SITE_US}`,
    `"security analyst" ${SITE_US}`,
    `"application security" ${SITE_US}`,
    `"security architect" ${SITE_US}`,
    `"penetration tester" ${SITE_US}`,
    `"CISO" ${SITE_US}`,
    `"SOC analyst" ${SITE_US}`,
    `"cloud security" ${SITE_US}`,
    `"security operations" ${SITE_US}`,
    `"head of security" ${SITE_US}`,
    `"GRC" "analyst" ${SITE_US}`,
    `"threat intelligence" ${SITE_US}`,
    `"security" "fintech" ${SITE_US}`,
    `"security" "Web3" ${SITE_US}`,
    `"security" "SaaS" ${SITE_US}`,
    `"security" "remote" ${SITE_US}`,
    `"security" "crypto" ${SITE_US}`,
    `"security" "healthtech" ${SITE_US}`,
    `"vulnerability" "analyst" ${SITE_US}`,
    `"IAM" "engineer" ${SITE_US}`,
  ],

  // ── Business (8 categories) ──────────────────────────────────────────────

  product: [
    `"product manager" ${SITE_US}`,
    `"product owner" ${SITE_US}`,
    `"product lead" ${SITE_US}`,
    `"head of product" ${SITE_US}`,
    `"senior product manager" ${SITE_US}`,
    `"principal product manager" ${SITE_US}`,
    `"group product manager" ${SITE_US}`,
    `"VP product" ${SITE_US}`,
    `"director of product" ${SITE_US}`,
    `"CPO" ${SITE_US}`,
    `"technical product manager" ${SITE_US}`,
    `"product analyst" ${SITE_US}`,
    `"product operations" ${SITE_US}`,
    `"TPM" ${SITE_US}`,
    `"product" "SaaS" ${SITE_US}`,
    `"product" "B2B" ${SITE_US}`,
    `"product" "fintech" ${SITE_US}`,
    `"product" "edtech" ${SITE_US}`,
    `"product" "AI startup" ${SITE_US}`,
    `"product" "healthtech" ${SITE_US}`,
    `"product" "climate tech" ${SITE_US}`,
    `"product" "cybersecurity" ${SITE_US}`,
    `"product" "remote" ${SITE_US}`,
    `"product strategy" ${SITE_US}`,
  ],

  marketing: [
    `"marketing manager" ${SITE_US}`,
    `"growth marketing" ${SITE_US}`,
    `"content marketing" ${SITE_US}`,
    `"performance marketing" ${SITE_US}`,
    `"demand generation" ${SITE_US}`,
    `"product marketing" ${SITE_US}`,
    `"digital marketing" ${SITE_US}`,
    `"brand marketing" ${SITE_US}`,
    `"marketing director" ${SITE_US}`,
    `"VP marketing" ${SITE_US}`,
    `"CMO" ${SITE_US}`,
    `"head of marketing" ${SITE_US}`,
    `"SEO" "specialist" ${SITE_US}`,
    `"paid media" ${SITE_US}`,
    `"lifecycle marketing" ${SITE_US}`,
    `"email marketing" ${SITE_US}`,
    `"field marketing" ${SITE_US}`,
    `"marketing" "SaaS" ${SITE_US}`,
    `"marketing" "B2B" ${SITE_US}`,
    `"marketing operations" ${SITE_US}`,
    `"community manager" ${SITE_US}`,
    `"social media manager" ${SITE_US}`,
    `"marketing analyst" ${SITE_US}`,
    `"marketing" "healthtech" ${SITE_US}`,
    `"marketing" "fintech" ${SITE_US}`,
    `"marketing" "AI startup" ${SITE_US}`,
    `"marketing" "remote" ${SITE_US}`,
    `"influencer marketing" ${SITE_US}`,
    `"event marketing" ${SITE_US}`,
  ],

  sales: [
    `"account executive" ${SITE_US}`,
    `"sales engineer" ${SITE_US}`,
    `"sales representative" ${SITE_US}`,
    `"business development" ${SITE_US}`,
    `"customer success" ${SITE_US}`,
    `"sales manager" ${SITE_US}`,
    `"VP sales" ${SITE_US}`,
    `"head of sales" ${SITE_US}`,
    `"sales director" ${SITE_US}`,
    `"SDR" ${SITE_US}`,
    `"BDR" ${SITE_US}`,
    `"account manager" ${SITE_US}`,
    `"enterprise sales" ${SITE_US}`,
    `"solutions consultant" ${SITE_US}`,
    `"revenue" "manager" ${SITE_US}`,
    `"CRO" ${SITE_US}`,
    `"sales" "SaaS" ${SITE_US}`,
    `"sales" "B2B" ${SITE_US}`,
    `"sales operations" ${SITE_US}`,
    `"customer success manager" ${SITE_US}`,
    `"partnership" "manager" ${SITE_US}`,
    `"channel sales" ${SITE_US}`,
    `"pre-sales" ${SITE_US}`,
    `"sales" "fintech" ${SITE_US}`,
    `"sales" "healthtech" ${SITE_US}`,
    `"sales" "AI startup" ${SITE_US}`,
    `"sales" "remote" ${SITE_US}`,
    `"inside sales" ${SITE_US}`,
    `"sales enablement" ${SITE_US}`,
  ],

  finance: [
    `"financial analyst" ${SITE_US}`,
    `"accountant" ${SITE_US}`,
    `"controller" ${SITE_US}`,
    `"finance manager" ${SITE_US}`,
    `"fp&a" ${SITE_US}`,
    `"CFO" ${SITE_US}`,
    `"VP finance" ${SITE_US}`,
    `"head of finance" ${SITE_US}`,
    `"finance director" ${SITE_US}`,
    `"tax" "manager" ${SITE_US}`,
    `"treasury" ${SITE_US}`,
    `"audit" "manager" ${SITE_US}`,
    `"accounts payable" ${SITE_US}`,
    `"accounts receivable" ${SITE_US}`,
    `"bookkeeper" ${SITE_US}`,
    `"payroll" "specialist" ${SITE_US}`,
    `"finance" "fintech" ${SITE_US}`,
    `"finance" "SaaS" ${SITE_US}`,
    `"financial controller" ${SITE_US}`,
    `"senior accountant" ${SITE_US}`,
    `"finance" "crypto" ${SITE_US}`,
    `"finance" "remote" ${SITE_US}`,
    `"billing" "specialist" ${SITE_US}`,
    `"revenue accountant" ${SITE_US}`,
  ],

  hr: [
    `"recruiter" ${SITE_US}`,
    `"talent acquisition" ${SITE_US}`,
    `"hr manager" ${SITE_US}`,
    `"people operations" ${SITE_US}`,
    `"hr business partner" ${SITE_US}`,
    `"head of people" ${SITE_US}`,
    `"VP people" ${SITE_US}`,
    `"CHRO" ${SITE_US}`,
    `"people partner" ${SITE_US}`,
    `"hr director" ${SITE_US}`,
    `"talent partner" ${SITE_US}`,
    `"technical recruiter" ${SITE_US}`,
    `"sourcer" ${SITE_US}`,
    `"compensation" "analyst" ${SITE_US}`,
    `"benefits" "specialist" ${SITE_US}`,
    `"DEIB" ${SITE_US}`,
    `"employer brand" ${SITE_US}`,
    `"hr coordinator" ${SITE_US}`,
    `"people analytics" ${SITE_US}`,
    `"hr" "SaaS" ${SITE_US}`,
    `"hr" "remote" ${SITE_US}`,
    `"hr" "fintech" ${SITE_US}`,
    `"recruiting coordinator" ${SITE_US}`,
    `"hris" "analyst" ${SITE_US}`,
  ],

  operations: [
    `"operations manager" ${SITE_US}`,
    `"operations analyst" ${SITE_US}`,
    `"business operations" ${SITE_US}`,
    `"revenue operations" ${SITE_US}`,
    `"head of operations" ${SITE_US}`,
    `"VP operations" ${SITE_US}`,
    `"COO" ${SITE_US}`,
    `"operations director" ${SITE_US}`,
    `"strategy" "operations" ${SITE_US}`,
    `"go-to-market" ${SITE_US}`,
    `"deal desk" ${SITE_US}`,
    `"revops" ${SITE_US}`,
    `"supply chain" ${SITE_US}`,
    `"procurement" ${SITE_US}`,
    `"logistics" "manager" ${SITE_US}`,
    `"operations" "SaaS" ${SITE_US}`,
    `"operations" "fintech" ${SITE_US}`,
    `"chief of staff" ${SITE_US}`,
    `"operations" "remote" ${SITE_US}`,
    `"operations" "healthtech" ${SITE_US}`,
    `"operations" "AI startup" ${SITE_US}`,
    `"business analyst" ${SITE_US}`,
    `"process improvement" ${SITE_US}`,
  ],

  legal: [
    `"legal counsel" ${SITE_US}`,
    `"attorney" ${SITE_US}`,
    `"paralegal" ${SITE_US}`,
    `"contracts manager" ${SITE_US}`,
    `"compliance" ${SITE_US}`,
    `"general counsel" ${SITE_US}`,
    `"head of legal" ${SITE_US}`,
    `"VP legal" ${SITE_US}`,
    `"corporate counsel" ${SITE_US}`,
    `"privacy counsel" ${SITE_US}`,
    `"employment lawyer" ${SITE_US}`,
    `"ip counsel" ${SITE_US}`,
    `"legal operations" ${SITE_US}`,
    `"compliance manager" ${SITE_US}`,
    `"regulatory" "analyst" ${SITE_US}`,
    `"legal" "fintech" ${SITE_US}`,
    `"legal" "crypto" ${SITE_US}`,
    `"legal" "SaaS" ${SITE_US}`,
    `"legal" "remote" ${SITE_US}`,
    `"legal" "healthtech" ${SITE_US}`,
    `"data privacy" "counsel" ${SITE_US}`,
  ],

  'project-management': [
    `"project manager" ${SITE_US}`,
    `"program manager" ${SITE_US}`,
    `"scrum master" ${SITE_US}`,
    `"delivery manager" ${SITE_US}`,
    `"senior project manager" ${SITE_US}`,
    `"technical program manager" ${SITE_US}`,
    `"agile coach" ${SITE_US}`,
    `"PMO" ${SITE_US}`,
    `"release manager" ${SITE_US}`,
    `"project coordinator" ${SITE_US}`,
    `"program director" ${SITE_US}`,
    `"implementation manager" ${SITE_US}`,
    `"project" "SaaS" ${SITE_US}`,
    `"project" "fintech" ${SITE_US}`,
    `"project" "healthtech" ${SITE_US}`,
    `"project" "remote" ${SITE_US}`,
    `"project" "AI startup" ${SITE_US}`,
    `"project" "B2B" ${SITE_US}`,
    `"IT project manager" ${SITE_US}`,
  ],

  // ── Content & Creative (3 categories) ────────────────────────────────────

  writing: [
    `"content writer" ${SITE_US}`,
    `"copywriter" ${SITE_US}`,
    `"technical writer" ${SITE_US}`,
    `"content strategist" ${SITE_US}`,
    `"editor" ${SITE_US}`,
    `"senior copywriter" ${SITE_US}`,
    `"blog writer" ${SITE_US}`,
    `"content manager" ${SITE_US}`,
    `"documentation" "writer" ${SITE_US}`,
    `"UX writer" ${SITE_US}`,
    `"content lead" ${SITE_US}`,
    `"head of content" ${SITE_US}`,
    `"content" "SaaS" ${SITE_US}`,
    `"content" "B2B" ${SITE_US}`,
    `"managing editor" ${SITE_US}`,
    `"content" "fintech" ${SITE_US}`,
    `"content" "AI startup" ${SITE_US}`,
    `"content" "remote" ${SITE_US}`,
    `"SEO content" ${SITE_US}`,
    `"content director" ${SITE_US}`,
  ],

  translation: [
    `"translator" ${SITE_US}`,
    `"localization" ${SITE_US}`,
    `"interpreter" ${SITE_US}`,
    `"localization manager" ${SITE_US}`,
    `"language specialist" ${SITE_US}`,
    `"localization engineer" ${SITE_US}`,
    `"localization coordinator" ${SITE_US}`,
    `"translation" "manager" ${SITE_US}`,
    `"i18n" ${SITE_US}`,
    `"internationalization" ${SITE_US}`,
    `"linguist" ${SITE_US}`,
    `"localization" "SaaS" ${SITE_US}`,
    `"localization QA" ${SITE_US}`,
    `"translation" "lead" ${SITE_US}`,
    `"globalization" ${SITE_US}`,
  ],

  creative: [
    `"video editor" ${SITE_US}`,
    `"motion designer" ${SITE_US}`,
    `"animator" ${SITE_US}`,
    `"creative director" ${SITE_US}`,
    `"multimedia" ${SITE_US}`,
    `"video producer" ${SITE_US}`,
    `"3d artist" ${SITE_US}`,
    `"illustrator" ${SITE_US}`,
    `"art director" ${SITE_US}`,
    `"photographer" ${SITE_US}`,
    `"creative producer" ${SITE_US}`,
    `"head of creative" ${SITE_US}`,
    `"content creator" ${SITE_US}`,
    `"visual" "storytelling" ${SITE_US}`,
    `"creative" "SaaS" ${SITE_US}`,
    `"creative" "fintech" ${SITE_US}`,
    `"creative" "remote" ${SITE_US}`,
    `"creative" "AI startup" ${SITE_US}`,
    `"sound designer" ${SITE_US}`,
    `"graphic" "senior" ${SITE_US}`,
  ],

  // ── Other (4 categories) ─────────────────────────────────────────────────

  support: [
    `"customer support" ${SITE_US}`,
    `"customer service" ${SITE_US}`,
    `"support engineer" ${SITE_US}`,
    `"technical support" ${SITE_US}`,
    `"support manager" ${SITE_US}`,
    `"head of support" ${SITE_US}`,
    `"support lead" ${SITE_US}`,
    `"help desk" ${SITE_US}`,
    `"customer experience" ${SITE_US}`,
    `"support operations" ${SITE_US}`,
    `"tier 2 support" ${SITE_US}`,
    `"support" "SaaS" ${SITE_US}`,
    `"support" "B2B" ${SITE_US}`,
    `"customer advocate" ${SITE_US}`,
    `"support specialist" ${SITE_US}`,
    `"support" "fintech" ${SITE_US}`,
    `"support" "remote" ${SITE_US}`,
    `"support" "AI startup" ${SITE_US}`,
    `"support" "healthtech" ${SITE_US}`,
    `"customer operations" ${SITE_US}`,
  ],

  education: [
    `"instructional designer" ${SITE_US}`,
    `"training specialist" ${SITE_US}`,
    `"learning" ${SITE_US}`,
    `"curriculum" ${SITE_US}`,
    `"learning designer" ${SITE_US}`,
    `"training manager" ${SITE_US}`,
    `"e-learning" ${SITE_US}`,
    `"education" "manager" ${SITE_US}`,
    `"education" "edtech" ${SITE_US}`,
    `"course developer" ${SITE_US}`,
    `"head of learning" ${SITE_US}`,
    `"L&D" ${SITE_US}`,
    `"enablement" "specialist" ${SITE_US}`,
    `"onboarding" "specialist" ${SITE_US}`,
    `"education" "content" ${SITE_US}`,
    `"education" "remote" ${SITE_US}`,
    `"education" "SaaS" ${SITE_US}`,
    `"education technology" ${SITE_US}`,
    `"academic" "coordinator" ${SITE_US}`,
    `"sales enablement" "specialist" ${SITE_US}`,
  ],

  research: [
    `"researcher" ${SITE_US}`,
    `"ux researcher" ${SITE_US}`,
    `"user researcher" ${SITE_US}`,
    `"research scientist" ${SITE_US}`,
    `"senior researcher" ${SITE_US}`,
    `"research engineer" ${SITE_US}`,
    `"head of research" ${SITE_US}`,
    `"research manager" ${SITE_US}`,
    `"market researcher" ${SITE_US}`,
    `"research analyst" ${SITE_US}`,
    `"quantitative researcher" ${SITE_US}`,
    `"research" "AI startup" ${SITE_US}`,
    `"research" "healthtech" ${SITE_US}`,
    `"applied scientist" ${SITE_US}`,
    `"research director" ${SITE_US}`,
    `"research" "fintech" ${SITE_US}`,
    `"research" "remote" ${SITE_US}`,
    `"research" "SaaS" ${SITE_US}`,
    `"clinical researcher" ${SITE_US}`,
    `"policy researcher" ${SITE_US}`,
  ],

  consulting: [
    `"consultant" ${SITE_US}`,
    `"solutions architect" ${SITE_US}`,
    `"implementation" ${SITE_US}`,
    `"professional services" ${SITE_US}`,
    `"senior consultant" ${SITE_US}`,
    `"management consultant" ${SITE_US}`,
    `"strategy consultant" ${SITE_US}`,
    `"solutions engineer" ${SITE_US}`,
    `"implementation consultant" ${SITE_US}`,
    `"customer engineer" ${SITE_US}`,
    `"technical consultant" ${SITE_US}`,
    `"onboarding" "manager" ${SITE_US}`,
    `"consulting" "SaaS" ${SITE_US}`,
    `"consulting" "fintech" ${SITE_US}`,
    `"engagement manager" ${SITE_US}`,
    `"consulting" "remote" ${SITE_US}`,
    `"consulting" "healthtech" ${SITE_US}`,
    `"consulting" "AI startup" ${SITE_US}`,
    `"customer onboarding" ${SITE_US}`,
    `"delivery consultant" ${SITE_US}`,
  ],
};

// ─── EU Lever Queries (~100 total) ────────────────────────────────────────────

export const LEVER_EU_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  engineering: [
    `"software engineer" ${SITE_EU}`,
    `"developer" ${SITE_EU}`,
    `"frontend engineer" ${SITE_EU}`,
    `"backend engineer" ${SITE_EU}`,
    `"fullstack" ${SITE_EU}`,
    `"staff engineer" ${SITE_EU}`,
    `"engineering manager" ${SITE_EU}`,
    `"react" "engineer" ${SITE_EU}`,
    `"python" "engineer" ${SITE_EU}`,
    `"golang" "engineer" ${SITE_EU}`,
    `"java" "engineer" ${SITE_EU}`,
    `"typescript" "engineer" ${SITE_EU}`,
    `"senior software engineer" ${SITE_EU}`,
    `"technical lead" ${SITE_EU}`,
  ],
  design: [
    `"product designer" ${SITE_EU}`,
    `"ux designer" ${SITE_EU}`,
    `"ui designer" ${SITE_EU}`,
    `"design lead" ${SITE_EU}`,
    `"senior product designer" ${SITE_EU}`,
    `"design manager" ${SITE_EU}`,
    `"head of design" ${SITE_EU}`,
  ],
  data: [
    `"data scientist" ${SITE_EU}`,
    `"data engineer" ${SITE_EU}`,
    `"data analyst" ${SITE_EU}`,
    `"machine learning" ${SITE_EU}`,
    `"ai engineer" ${SITE_EU}`,
    `"analytics engineer" ${SITE_EU}`,
    `"ml engineer" ${SITE_EU}`,
    `"head of data" ${SITE_EU}`,
    `"LLM" "engineer" ${SITE_EU}`,
  ],
  devops: [
    `"devops engineer" ${SITE_EU}`,
    `"sre" ${SITE_EU}`,
    `"platform engineer" ${SITE_EU}`,
    `"cloud engineer" ${SITE_EU}`,
    `"kubernetes" "engineer" ${SITE_EU}`,
  ],
  qa: [
    `"qa engineer" ${SITE_EU}`,
    `"test engineer" ${SITE_EU}`,
    `"quality assurance" ${SITE_EU}`,
    `"SDET" ${SITE_EU}`,
  ],
  security: [
    `"security engineer" ${SITE_EU}`,
    `"cybersecurity" ${SITE_EU}`,
    `"information security" ${SITE_EU}`,
    `"application security" ${SITE_EU}`,
  ],
  product: [
    `"product manager" ${SITE_EU}`,
    `"product owner" ${SITE_EU}`,
    `"senior product manager" ${SITE_EU}`,
    `"head of product" ${SITE_EU}`,
    `"technical product manager" ${SITE_EU}`,
  ],
  marketing: [
    `"marketing manager" ${SITE_EU}`,
    `"growth marketing" ${SITE_EU}`,
    `"product marketing" ${SITE_EU}`,
    `"content marketing" ${SITE_EU}`,
    `"digital marketing" ${SITE_EU}`,
  ],
  sales: [
    `"account executive" ${SITE_EU}`,
    `"sales engineer" ${SITE_EU}`,
    `"business development" ${SITE_EU}`,
    `"customer success" ${SITE_EU}`,
    `"SDR" ${SITE_EU}`,
  ],
  finance: [
    `"financial analyst" ${SITE_EU}`,
    `"accountant" ${SITE_EU}`,
    `"controller" ${SITE_EU}`,
    `"finance manager" ${SITE_EU}`,
  ],
  hr: [
    `"recruiter" ${SITE_EU}`,
    `"talent acquisition" ${SITE_EU}`,
    `"hr manager" ${SITE_EU}`,
    `"people operations" ${SITE_EU}`,
    `"hr business partner" ${SITE_EU}`,
  ],
  operations: [
    `"operations manager" ${SITE_EU}`,
    `"business operations" ${SITE_EU}`,
    `"revenue operations" ${SITE_EU}`,
    `"head of operations" ${SITE_EU}`,
  ],
  legal: [
    `"legal counsel" ${SITE_EU}`,
    `"compliance" ${SITE_EU}`,
    `"general counsel" ${SITE_EU}`,
    `"privacy counsel" ${SITE_EU}`,
  ],
  'project-management': [
    `"project manager" ${SITE_EU}`,
    `"program manager" ${SITE_EU}`,
    `"scrum master" ${SITE_EU}`,
    `"delivery manager" ${SITE_EU}`,
  ],
  writing: [
    `"content writer" ${SITE_EU}`,
    `"copywriter" ${SITE_EU}`,
    `"technical writer" ${SITE_EU}`,
    `"content strategist" ${SITE_EU}`,
  ],
  translation: [
    `"translator" ${SITE_EU}`,
    `"localization" ${SITE_EU}`,
    `"localization manager" ${SITE_EU}`,
  ],
  creative: [
    `"video editor" ${SITE_EU}`,
    `"motion designer" ${SITE_EU}`,
    `"creative director" ${SITE_EU}`,
  ],
  support: [
    `"customer support" ${SITE_EU}`,
    `"support engineer" ${SITE_EU}`,
    `"technical support" ${SITE_EU}`,
  ],
  education: [
    `"instructional designer" ${SITE_EU}`,
    `"training specialist" ${SITE_EU}`,
    `"learning" "designer" ${SITE_EU}`,
  ],
  research: [
    `"researcher" ${SITE_EU}`,
    `"ux researcher" ${SITE_EU}`,
    `"research scientist" ${SITE_EU}`,
  ],
  consulting: [
    `"consultant" ${SITE_EU}`,
    `"solutions architect" ${SITE_EU}`,
    `"professional services" ${SITE_EU}`,
  ],
};

// ─── International Queries (~40 total) ────────────────────────────────────────

export const LEVER_INTL_QUERIES: string[] = [
  // French
  `"développeur" ${SITE_US}`,
  `"ingénieur logiciel" ${SITE_US}`,
  `"développeur frontend" ${SITE_US}`,
  `"développeur backend" ${SITE_US}`,
  `"chef de produit" ${SITE_US}`,
  `"analyste données" ${SITE_US}`,
  `"responsable marketing" ${SITE_US}`,
  `"développeur" ${SITE_EU}`,
  `"ingénieur logiciel" ${SITE_EU}`,
  `"chef de produit" ${SITE_EU}`,

  // Spanish
  `"desarrollador" ${SITE_US}`,
  `"ingeniero de software" ${SITE_US}`,
  `"desarrollador frontend" ${SITE_US}`,
  `"desarrollador backend" ${SITE_US}`,
  `"gerente de producto" ${SITE_US}`,
  `"analista de datos" ${SITE_US}`,
  `"desarrollador" ${SITE_EU}`,
  `"ingeniero de software" ${SITE_EU}`,

  // German
  `"Softwareentwickler" ${SITE_US}`,
  `"Entwickler" ${SITE_US}`,
  `"Frontend-Entwickler" ${SITE_US}`,
  `"Backend-Entwickler" ${SITE_US}`,
  `"Produktmanager" ${SITE_US}`,
  `"Datenanalyst" ${SITE_US}`,
  `"Softwareentwickler" ${SITE_EU}`,
  `"Entwickler" ${SITE_EU}`,
  `"Produktmanager" ${SITE_EU}`,

  // Portuguese
  `"desenvolvedor" ${SITE_US}`,
  `"engenheiro de software" ${SITE_US}`,
  `"desenvolvedor frontend" ${SITE_US}`,
  `"desenvolvedor backend" ${SITE_US}`,
  `"gerente de produto" ${SITE_US}`,
  `"analista de dados" ${SITE_US}`,
  `"desenvolvedor" ${SITE_EU}`,
  `"engenheiro de software" ${SITE_EU}`,

  // Dutch
  `"software ontwikkelaar" ${SITE_US}`,
  `"software ontwikkelaar" ${SITE_EU}`,

  // Italian
  `"sviluppatore" ${SITE_US}`,
  `"sviluppatore" ${SITE_EU}`,

  // Polish
  `"programista" ${SITE_US}`,
  `"programista" ${SITE_EU}`,

  // Japanese
  `"エンジニア" ${SITE_US}`,
  `"ソフトウェア開発" ${SITE_US}`,

  // Korean
  `"소프트웨어 엔지니어" ${SITE_US}`,

  // Swedish
  `"mjukvaruutvecklare" ${SITE_US}`,
  `"mjukvaruutvecklare" ${SITE_EU}`,

  // Danish
  `"softwareudvikler" ${SITE_EU}`,

  // Norwegian
  `"utvikler" ${SITE_EU}`,

  // Finnish
  `"ohjelmistokehittäjä" ${SITE_EU}`,

  // Czech
  `"vývojář" ${SITE_EU}`,

  // Hungarian
  `"szoftverfejlesztő" ${SITE_EU}`,
];

// ─── Merged flat list ─────────────────────────────────────────────────────────

const usQueries = Object.values(LEVER_QUERIES_BY_CATEGORY).flat();
const euQueries = Object.values(LEVER_EU_QUERIES_BY_CATEGORY).flat();

// Deduplicate
export const LEVER_SEARCH_QUERIES = [
  ...new Set([...usQueries, ...euQueries, ...LEVER_INTL_QUERIES]),
];

// Get queries for specific category (US only)
export function getQueriesForCategory(category: string): string[] {
  return LEVER_QUERIES_BY_CATEGORY[category] || [];
}

// Get all queries as newline-separated string (for Apify input)
export function getAllQueriesAsString(): string {
  return LEVER_SEARCH_QUERIES.join('\n');
}

// Get queries for specific categories as string
export function getQueriesAsString(categories: string[]): string {
  return categories
    .flatMap((cat) => LEVER_QUERIES_BY_CATEGORY[cat] || [])
    .join('\n');
}

/**
 * Result of extracting a Lever company slug, including region info.
 */
export interface LeverSlugResult {
  slug: string;
  region: 'us' | 'eu';
}

/**
 * Extract company slug and region from Lever job URL
 * Examples:
 *   https://jobs.lever.co/stripe/abc123 → { slug: "stripe", region: "us" }
 *   https://jobs.eu.lever.co/personio/xyz → { slug: "personio", region: "eu" }
 */
export function extractLeverSlug(url: string): LeverSlugResult | null {
  try {
    const parsed = new URL(url);

    // Determine region from hostname
    let region: 'us' | 'eu';
    if (parsed.hostname === 'jobs.eu.lever.co') {
      region = 'eu';
    } else if (parsed.hostname === 'jobs.lever.co') {
      region = 'us';
    } else if (parsed.hostname.includes('lever.co')) {
      region = 'us';
    } else {
      return null;
    }

    // Path format: /{company-slug}/{job-id} or /{company-slug}
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 1) {
      const slug = pathParts[0].toLowerCase();

      // Skip generic/invalid slugs
      if (slug.length < 2 || slug === 'jobs' || slug === 'apply') {
        return null;
      }

      return { slug, region };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract unique company slugs from array of URLs (with region info)
 */
export function extractUniqueSlugs(
  urls: string[]
): Array<{ slug: string; region: 'us' | 'eu' }> {
  const seen = new Map<string, 'us' | 'eu'>();

  for (const url of urls) {
    const result = extractLeverSlug(url);
    if (result && !seen.has(result.slug)) {
      seen.set(result.slug, result.region);
    }
  }

  return Array.from(seen.entries())
    .map(([slug, region]) => ({ slug, region }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
