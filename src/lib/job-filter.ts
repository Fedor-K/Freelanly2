/**
 * Job Filter - determines if a job is remote-friendly
 *
 * Used during import to filter out non-remote jobs before they enter the database.
 * This prevents the need for periodic cleanup scripts.
 */

// Strict whitelist - only clearly remote-friendly job patterns
const REMOTE_FRIENDLY_PATTERNS = [
  // Tech & Engineering
  'developer', 'engineer', 'programmer', 'architect', 'devops', 'sre',
  'frontend', 'backend', 'fullstack', 'full-stack', 'full stack',
  'software', 'web dev', 'mobile dev', 'ios dev', 'android dev',
  'tech lead', 'engineering manager', 'cto', 'vp engineering',

  // Data & AI
  'data scientist', 'data analyst', 'data engineer', 'machine learning',
  'ml engineer', 'ai engineer', 'business intelligence', 'bi developer',
  'analytics engineer', 'etl', 'data architect',

  // Design
  'ui designer', 'ux designer', 'ui/ux', 'ux/ui', 'product designer',
  'graphic designer', 'visual designer', 'interaction designer',
  'design lead', 'design director', 'brand designer', 'web designer',

  // Product & Project
  'product manager', 'product owner', 'project manager', 'program manager',
  'scrum master', 'agile coach', 'delivery manager', 'technical pm',
  'product lead', 'product director', 'head of product',

  // Marketing & Content
  'marketing manager', 'marketing director', 'digital marketing',
  'seo specialist', 'seo manager', 'sem specialist', 'ppc',
  'content writer', 'content manager', 'content strategist',
  'copywriter', 'technical writer', 'blog writer', 'web writer',
  'editor', 'copy editor', 'managing editor',
  'social media manager', 'social media specialist',
  'growth manager', 'growth marketer', 'demand generation',
  'email marketing', 'marketing automation', 'brand manager',

  // Sales (remote-friendly only)
  'sales engineer', 'solutions engineer', 'pre-sales',
  'inside sales', 'sales development', 'sdr', 'bdr',
  'account executive', 'enterprise sales', 'saas sales',
  'sales manager', 'sales director', 'head of sales', 'vp sales',
  'business development manager', 'partnerships manager',

  // Customer Success
  'customer success manager', 'customer success', 'csm',
  'client success', 'client manager', 'relationship manager',
  'onboarding specialist', 'implementation manager',

  // Support (remote-friendly)
  'customer support', 'technical support', 'support engineer',
  'help desk', 'support specialist', 'support manager',
  'customer service representative', 'support analyst',

  // Virtual/Remote Assistants
  'virtual assistant', 'executive assistant', 'remote assistant',
  'personal assistant', 'ea to', 'assistant to',

  // Finance
  'accountant', 'senior accountant', 'staff accountant',
  'financial analyst', 'finance manager', 'controller',
  'bookkeeper', 'accounts payable', 'accounts receivable',
  'tax', 'audit', 'treasury', 'fp&a',

  // HR
  'recruiter', 'technical recruiter', 'talent acquisition',
  'hr manager', 'hr director', 'hr business partner', 'hrbp',
  'people operations', 'people partner', 'compensation',

  // QA & Security
  'qa engineer', 'quality assurance', 'test engineer', 'sdet',
  'automation engineer', 'test automation', 'qa lead', 'qa manager',
  'security engineer', 'security analyst', 'infosec',
  'penetration tester', 'security architect', 'devsecops',

  // Language & Translation
  'translator', 'interpreter', 'localization', 'l10n',
  'transcription', 'transcriptionist',
  'proofreader', 'linguist', 'language specialist',
  'subtitler', 'subtitling', 'captioner',
  'translation manager', 'localization manager',

  // Creative
  'video editor', 'motion designer', 'motion graphics',
  'animator', '3d artist', '2d artist',
  'illustrator', 'creative director', 'art director',

  // Consulting & Research
  'consultant', 'senior consultant', 'management consultant',
  'research scientist', 'researcher', 'research analyst',
  'strategist', 'strategy manager',

  // DevOps & Cloud
  'cloud engineer', 'cloud architect', 'aws', 'azure', 'gcp',
  'infrastructure engineer', 'platform engineer', 'site reliability',
  'kubernetes', 'docker', 'terraform',

  // Database
  'database administrator', 'dba', 'database engineer',

  // Legal (remote-friendly)
  'legal counsel', 'attorney', 'lawyer', 'paralegal', 'contract manager',

  // Operations (remote-friendly)
  'revenue operations', 'revops', 'sales operations', 'salesops',
  'marketing operations', 'business operations', 'operations manager',
];

// Patterns that should be EXCLUDED even if they match whitelist
const EXCLUDE_PATTERNS = [
  // Physical location roles
  'lobby', 'front desk', 'receptionist',
  'store manager', 'store operations', 'retail',
  'shift supervisor', 'shift lead',
  'barista', 'cafe', 'coffee shop',
  'boat captain', 'captain',

  // Medical (on-site)
  'mri tech', 'ct tech', 'x-ray', 'radiology', 'technologist',
  'patient coordinator', 'patient concierge', 'patient services',
  'nurse', 'nursing', 'rn', 'lpn', 'cna',
  'therapist', 'physical therapy', 'occupational therapy',
  'dental', 'dentist', 'hygienist',
  'pharmacy', 'pharmacist',
  'clinical', 'physician', 'doctor',

  // Events & Entertainment (on-site)
  'curator,', 'event producer', 'local producer',
  'venue', 'stage manager', 'production assistant',

  // Field sales
  'outside sales', 'field sales', 'door to door', 'territory',

  // Non-profit / Social services (usually on-site)
  'volunteer coordinator', 'volunteer manager',
  'case worker', 'caseworker', 'social worker',
  'asylum', 'refugee', 'resettlement', 'immigration',
  'newcomer support', 'housing specialist',
  'community health', 'behavioral health', 'mental health therapist',
  'substance abuse', 'counselor',
  'eap case',

  // Sports & Fitness
  'coach -', 'hitting coach', 'pitching coach', 'team coach',
  'fitness', 'personal trainer', 'gym',
  'nutrition assistant', 'dietary',

  // Office management (usually on-site)
  'office administrator', 'office manager', 'facilities manager',

  // Retail & Merchandise
  'merchandise', 'merchandising', 'visual merchandiser',
  'cashier', 'sales associate', 'store clerk',

  // Fundraising / Church
  'philanthropy', 'fundraising', 'development officer',
  'church', 'ministry', 'pastor', 'chaplain',

  // Education (usually on-site)
  'director of education', 'teacher', 'instructor', 'professor',
  'tutor', 'teaching assistant',

  // Legal (location-specific)
  'managing attorney',

  // Warehouse & Logistics
  'warehouse', 'forklift', 'shipping', 'receiving',
  'driver', 'delivery', 'courier', 'trucker',
  'logistics coordinator',

  // Security (on-site)
  'security guard', 'security officer', 'loss prevention',

  // Facilities & Maintenance
  'janitor', 'custodian', 'cleaner', 'housekeeper',
  'maintenance', 'groundskeeper',

  // Food service
  'cook', 'chef', 'kitchen', 'food service', 'server', 'waiter',
  'dishwasher', 'host', 'hostess',

  // Trades (on-site)
  'construction', 'carpenter', 'electrician', 'plumber', 'hvac',
  'mechanic', 'welder', 'machinist',

  // Manufacturing
  'assembly', 'manufacturing', 'production worker', 'factory',
  'machine operator', 'line worker',
];

// Companies known to be non-remote
const BLACKLIST_COMPANIES = [
  'solidcore',
  'action property management',
  'red sox foundation',
  'window nation',
  'simonmed imaging',
  'sofar sounds',
  'blue bottle coffee',
  'insomnia cookies',
  'cirque du soleil',
  'amity foundation',
  'giving home health care',
  'world relief',
  'saronic technologies',
  'compass lexecon',
  'trendyol group',
  'veepee',
];

export interface JobFilterResult {
  isRemoteFriendly: boolean;
  reason: 'whitelisted' | 'excluded' | 'not_whitelisted' | 'blacklisted_company';
  matchedPattern?: string;
}

/**
 * Check if a job title is remote-friendly
 */
export function isRemoteFriendlyJob(title: string, companyName?: string | null): JobFilterResult {
  const titleLower = title.toLowerCase();
  const companyLower = companyName?.toLowerCase() || '';

  // Check if company is blacklisted
  if (companyName && BLACKLIST_COMPANIES.some(c => companyLower.includes(c))) {
    const matched = BLACKLIST_COMPANIES.find(c => companyLower.includes(c));
    return {
      isRemoteFriendly: false,
      reason: 'blacklisted_company',
      matchedPattern: matched,
    };
  }

  // Check if matches any exclude pattern first
  for (const pattern of EXCLUDE_PATTERNS) {
    if (titleLower.includes(pattern.toLowerCase())) {
      return {
        isRemoteFriendly: false,
        reason: 'excluded',
        matchedPattern: pattern,
      };
    }
  }

  // Check if matches whitelist
  for (const pattern of REMOTE_FRIENDLY_PATTERNS) {
    if (titleLower.includes(pattern.toLowerCase())) {
      return {
        isRemoteFriendly: true,
        reason: 'whitelisted',
        matchedPattern: pattern,
      };
    }
  }

  // Not in whitelist
  return {
    isRemoteFriendly: false,
    reason: 'not_whitelisted',
  };
}

/**
 * Simple boolean check for job filtering
 */
export function shouldImportJob(title: string, companyName?: string | null): boolean {
  return isRemoteFriendlyJob(title, companyName).isRemoteFriendly;
}

// Export patterns for testing/debugging
export const PATTERNS = {
  whitelist: REMOTE_FRIENDLY_PATTERNS,
  exclude: EXCLUDE_PATTERNS,
  blacklistCompanies: BLACKLIST_COMPANIES,
};
