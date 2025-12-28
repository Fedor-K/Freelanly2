/**
 * Target Professions Whitelist
 *
 * Only jobs matching these patterns will be imported.
 * This ensures we only collect relevant jobs for our tech/digital audience.
 */

// Engineering / Development
const ENGINEERING_PATTERNS = [
  // Roles
  'developer', 'engineer', 'programmer', 'coder', 'architect',
  'technical lead', 'tech lead', 'team lead', 'engineering manager',
  'cto', 'vp engineer', 'head of engineer',
  // Specializations
  'frontend', 'front-end', 'front end',
  'backend', 'back-end', 'back end',
  'fullstack', 'full-stack', 'full stack',
  'web developer', 'mobile developer',
  'ios developer', 'android developer',
  'react native', 'flutter',
  'software', 'application', 'platform',
  // Technologies in title
  'java developer', 'python', 'javascript', 'typescript',
  'golang', 'go developer', 'rust', 'c\\+\\+', 'c#', '\\.net', 'dotnet',
  'php', 'ruby', 'scala', 'kotlin', 'swift',
  'node', 'react', 'vue', 'angular', 'next\\.js', 'nuxt',
  'django', 'rails', 'spring', 'laravel',
  'blockchain', 'web3', 'solidity', 'smart contract',
];

// Data & AI
const DATA_PATTERNS = [
  'data scientist', 'data analyst', 'data engineer',
  'ml engineer', 'machine learning', 'ai engineer', 'artificial intelligence',
  'analytics engineer', 'bi developer', 'bi analyst', 'business intelligence',
  'statistician', 'quantitative',
  'deep learning', 'nlp', 'natural language', 'computer vision',
  'big data', 'etl', 'data warehouse', 'data pipeline',
];

// DevOps & Infrastructure
const DEVOPS_PATTERNS = [
  'devops', 'sre', 'site reliability',
  'platform engineer', 'infrastructure engineer',
  'system admin', 'sysadmin', 'sysops', 'systems engineer',
  'network engineer', 'cloud engineer',
  'database admin', 'dba',
  'aws', 'azure', 'gcp', 'google cloud',
  'kubernetes', 'docker', 'terraform',
];

// Security
const SECURITY_PATTERNS = [
  'security engineer', 'security analyst', 'security architect',
  'cybersecurity', 'cyber security', 'infosec', 'information security',
  'penetration tester', 'pentester', 'ethical hacker',
  'soc analyst', 'security operations',
  'ciso', 'security lead', 'security manager',
];

// QA & Testing
const QA_PATTERNS = [
  'qa', 'quality assurance', 'tester', 'testing',
  'test engineer', 'test automation', 'automation engineer',
  'sdet', 'qa lead', 'qa manager',
  'manual tester', 'automation tester',
];

// Design
const DESIGN_PATTERNS = [
  'designer', 'ux', 'ui', 'ux/ui', 'ui/ux',
  'product designer', 'visual designer', 'graphic designer', 'web designer',
  'interaction designer', 'motion designer',
  'design lead', 'head of design', 'creative director', 'art director',
];

// Product & Project
const PRODUCT_PATTERNS = [
  'product manager', 'product owner', 'apm',
  'program manager', 'project manager', 'pmo',
  'scrum master', 'agile coach',
  'technical program manager', 'tpm',
  'cpo', 'vp product', 'head of product', 'chief product',
];

// Marketing (Digital)
const MARKETING_PATTERNS = [
  'marketing manager', 'digital marketing', 'online marketing',
  'growth manager', 'growth hacker', 'head of growth',
  'content marketing', 'content strategist',
  'social media manager', 'community manager',
  'performance marketing', 'paid media', 'media buyer',
  'marketing analyst', 'marketing operations', 'marketing ops',
  'cmo', 'vp marketing', 'head of marketing',
  'seo', 'sem', 'ppc', 'paid ads', 'paid search',
  'email marketing', 'crm manager', 'lifecycle',
  'brand manager', 'brand strategist',
  'demand generation', 'demand gen',
];

// Content & Creative
const CONTENT_PATTERNS = [
  'copywriter', 'content writer', 'technical writer', 'writer',
  'editor', 'copy editor', 'managing editor',
  'translator', 'localization', 'interpreter', 'linguist',
  'video editor', 'video producer', 'videographer',
  'animator', '3d artist', 'motion graphics',
  'content creator', 'content manager',
];

// Sales (Tech/SaaS) - be specific to avoid retail sales
const SALES_PATTERNS = [
  'account executive',
  'business development', 'bdr', 'sdr', 'sales development',
  'sales engineer', 'solutions engineer', 'solution architect', 'pre-sales', 'presales',
  'sales manager', 'sales director', 'head of sales', 'vp sales',
  'partnerships', 'partner manager', 'channel manager', 'alliance manager',
  'enterprise sales', 'saas sales', 'software sales', 'tech sales',
  'inside sales', // tech inside sales
];

// Customer Success & Support
const CUSTOMER_PATTERNS = [
  'customer success', 'csm', 'customer success manager',
  'customer support', 'support engineer', 'support specialist',
  'technical support', 'tech support', 'help desk',
  'customer experience', 'cx manager',
  'implementation manager', 'onboarding', 'client success',
];

// HR & Recruiting
const HR_PATTERNS = [
  'recruiter', 'technical recruiter', 'sourcer', 'talent sourcer',
  'talent acquisition', 'recruiting manager', 'recruitment',
  'hr manager', 'hr business partner', 'hrbp',
  'people operations', 'people ops', 'people partner',
  'hr director', 'head of people', 'vp people', 'chro',
];

// Finance
const FINANCE_PATTERNS = [
  'financial analyst', 'fp&a', 'finance analyst',
  'accountant', 'controller', 'bookkeeper',
  'cfo', 'vp finance', 'finance manager', 'finance director',
  'treasury', 'financial planning',
];

// Legal
const LEGAL_PATTERNS = [
  'legal counsel', 'lawyer', 'attorney',
  'compliance manager', 'compliance officer', 'compliance analyst',
  'contract manager', 'paralegal',
  'privacy', 'data protection', 'gdpr',
  'general counsel', 'head of legal', 'vp legal',
];

// Operations
const OPERATIONS_PATTERNS = [
  'operations manager', 'operations analyst', 'ops manager',
  'business operations', 'revops', 'revenue operations',
  'strategy', 'business analyst', 'strategy analyst',
  'chief of staff', 'executive assistant',
  'coo', 'vp operations', 'head of operations',
];

// Combine all patterns
export const TARGET_PROFESSION_PATTERNS: string[] = [
  ...ENGINEERING_PATTERNS,
  ...DATA_PATTERNS,
  ...DEVOPS_PATTERNS,
  ...SECURITY_PATTERNS,
  ...QA_PATTERNS,
  ...DESIGN_PATTERNS,
  ...PRODUCT_PATTERNS,
  ...MARKETING_PATTERNS,
  ...CONTENT_PATTERNS,
  ...SALES_PATTERNS,
  ...CUSTOMER_PATTERNS,
  ...HR_PATTERNS,
  ...FINANCE_PATTERNS,
  ...LEGAL_PATTERNS,
  ...OPERATIONS_PATTERNS,
];

// Build regex for efficient matching
// Using word boundaries where appropriate
const patternString = TARGET_PROFESSION_PATTERNS
  .map(p => {
    // Escape special regex chars except those we use intentionally
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped;
  })
  .join('|');

const TARGET_REGEX = new RegExp(`(${patternString})`, 'i');

/**
 * Check if a job title matches our target professions
 * @param title - Job title to check
 * @returns true if the job is relevant to our audience
 */
export function isTargetProfession(title: string): boolean {
  if (!title) return false;
  return TARGET_REGEX.test(title);
}

// Explicit blacklist for edge cases that might slip through
const BLACKLIST_PATTERNS = [
  // Logistics/Physical
  'driver', 'delivery', 'courier', 'warehouse', 'forklift',
  // Healthcare
  'nurse', 'nursing', 'doctor', 'physician', 'medical assistant', 'healthcare aide',
  // Education (non-EdTech)
  'teacher', 'instructor', 'professor', 'tutor',
  // Food/Hospitality
  'cook', 'chef', 'barista', 'cashier', 'waiter', 'waitress', 'bartender',
  // Construction/Trades
  'construction', 'plumber', 'electrician', 'carpenter', 'mechanic',
  // Retail
  'retail associate', 'store manager', 'sales associate', 'store clerk',
  'retail account manager', 'retail sales',
  // Cleaning
  'janitor', 'cleaner', 'housekeeper', 'custodian',
  // Physical security (not cyber)
  'security guard', 'security officer',
  // Field/Door-to-door sales
  'field sales', 'outside sales', 'door to door', 'door-to-door',
  'sales representative', 'brand ambassador', 'canvasser',
  'territory manager', 'area manager', 'district manager',
  // Finance back-office (not analyst)
  'accounts receivable', 'accounts payable', 'collections',
  'bookkeeper', 'payroll',
  // Generic customer service (not tech support)
  'customer care', 'customer service representative',
  'call center', 'contact center',
];

const BLACKLIST_REGEX = new RegExp(`\\b(${BLACKLIST_PATTERNS.join('|')})\\b`, 'i');

/**
 * Check if a job title is explicitly blacklisted
 * @param title - Job title to check
 * @returns true if the job should be excluded
 */
export function isBlacklistedProfession(title: string): boolean {
  if (!title) return false;
  return BLACKLIST_REGEX.test(title);
}

/**
 * Main function: Check if job should be imported
 * @param title - Job title to check
 * @returns true if job should be imported, false if should be skipped
 */
export function shouldImportByProfession(title: string): boolean {
  // First check blacklist (takes priority)
  if (isBlacklistedProfession(title)) {
    return false;
  }

  // Then check whitelist
  return isTargetProfession(title);
}
