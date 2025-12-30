/**
 * ============================================================================
 * TARGET PROFESSIONS v2.1 — ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ ДЛЯ ФИЛЬТРАЦИИ
 * ============================================================================
 *
 * v2.1: Added "supply chain" to logistics blacklist
 * ============================================================================
 *
 * ПРАВИЛО ИМПОРТА:
 * 1. Blacklist (приоритет) → title содержит запрещённые слова → НЕ импортировать
 * 2. Whitelist → title содержит целевые профессии → импортировать
 * 3. Ни то, ни другое → НЕ импортировать
 *
 * ПРИНЦИП: Лучше пропустить хорошую вакансию, чем проиндексировать мусор
 *
 * Используется в: src/lib/job-filter.ts → shouldSkipJob()
 * ============================================================================
 */

// ============================================================================
// BLACKLIST — ЗАПРЕЩЁННЫЕ ПРОФЕССИИ (проверяется ПЕРВЫМ)
// ============================================================================

const BLACKLIST_HEALTHCARE = [
  'nurse', 'nursing', 'rn ', 'lpn', 'cna', 'caregiver',
  'doctor', 'physician', 'md ', 'surgeon', 'dentist',
  'therapist', 'physical therapist', 'occupational therapist', 'speech therapist',
  'pharmacist', 'pharmacy', 'veterinarian', 'vet tech',
  'medical assistant', 'healthcare aide', 'health aide',
  'clinical', 'patient care', 'hospice', 'home health',
  'phlebotomist', 'radiologist', 'sonographer', 'emt', 'paramedic',
  'optometrist', 'chiropractor', 'podiatrist',
];

const BLACKLIST_CONSTRUCTION = [
  'construction', 'contractor', 'foreman', 'superintendent',
  'electrician', 'plumber', 'hvac', 'welder', 'carpenter',
  'mason', 'roofer', 'painter', 'drywall', 'flooring',
  'locksmith', 'glazier', 'ironworker', 'pipefitter',
  'heavy equipment', 'crane operator', 'excavator',
  'framer', 'tiler', 'plasterer', 'bricklayer',
];

const BLACKLIST_MANUFACTURING = [
  'manufacturing', 'production worker', 'assembly', 'assembler',
  'machine operator', 'cnc operator', 'press operator',
  'quality inspector', 'manufacturing qa', 'line worker',
  'factory', 'plant operator', 'process operator',
  'toolmaker', 'machinist', 'mill operator', 'lathe',
  'fabricator', 'welder', 'solderer',
];

const BLACKLIST_RETAIL_HOSPITALITY = [
  'retail', 'cashier', 'store clerk', 'sales associate',
  'store manager', 'store operations', 'retail manager', 'merchandiser', 'stocker',
  'cook', 'chef', 'sous chef', 'line cook', 'prep cook',
  'barista', 'bartender', 'server', 'waiter', 'waitress',
  'host', 'hostess', 'busser', 'dishwasher',
  'hotel', 'front desk', 'concierge', 'bellhop', 'housekeeper', 'housekeeping',
  'restaurant manager', 'kitchen manager', 'food service',
  'sommelier', 'maitre d', 'banquet',
];

const BLACKLIST_LOGISTICS = [
  'driver', 'truck driver', 'delivery driver', 'cdl',
  'courier', 'delivery', 'shipping', 'receiving',
  'warehouse', 'forklift', 'picker', 'packer', 'loader',
  'logistics coordinator', 'dispatch', 'dispatcher',
  'freight', 'dock worker', 'material handler',
  'cargo', 'longshoreman', 'stevedore',
  'supply chain', // Supply Chain roles are logistics, not target remote
];

const BLACKLIST_FIELD_OUTDOOR = [
  // Technicians (physical, not IT)
  'field technician', 'field service', 'field engineer',
  'installation technician', 'service technician',
  'maintenance technician', 'maintenance worker',
  'facilities technician', 'building maintenance',
  'sound technician', 'audio technician', 'stage technician',
  'lighting technician', 'av technician', 'broadcast technician',
  'wardrobe technician', 'costume technician',
  'equipment technician', 'lab technician',
  'hvac technician', 'refrigeration technician',
  'cable technician', 'telecommunications technician',
  'appliance technician', 'repair technician',
  // Environment/Outdoor
  'landscaper', 'landscape', 'landscaping', 'groundskeeper',
  'horticulturist', 'arborist', 'gardener',
  'ecologist', 'environmental scientist', 'wetland',
  'restoration', 'conservation', 'wildlife',
  'surveyor', 'land surveyor', 'geologist',
  'park ranger', 'forest', 'agriculture',
];

const BLACKLIST_SECURITY_CLEANING = [
  'security guard', 'security officer', 'armed security',
  'janitor', 'custodian', 'cleaner', 'cleaning',
  'maintenance', 'handyman', 'porter',
  'pest control', 'exterminator',
];

const BLACKLIST_OFFICE_TRADITIONAL = [
  'receptionist', 'front desk clerk', 'office manager',
  'mail room', 'file clerk', 'records clerk',
  'office assistant', 'office coordinator',
];

const BLACKLIST_ENTERTAINMENT_EVENTS = [
  // Stage/Production (physical)
  'stagehand', 'rigger', 'grip', 'gaffer',
  'wardrobe', 'costume', 'makeup artist', 'hair stylist',
  'props', 'set designer', 'scenic',
  'camera operator', 'boom operator',
  // Events (physical presence)
  'event coordinator', 'event manager', 'event planner',
  'wedding', 'catering', 'banquet',
  'conference coordinator', 'trade show',
  'venue manager', 'box office',
];

const BLACKLIST_SOCIAL_WORK = [
  'counselor', 'case manager', 'social worker',
  'youth worker', 'residential counselor', 'group home',
  'substance abuse', 'behavioral health', 'mental health counselor',
  'probation officer', 'parole officer',
  'child welfare', 'foster care', 'adoption',
  'crisis counselor', 'hotline',
];

const BLACKLIST_EDUCATION_TRADITIONAL = [
  'teacher', 'substitute teacher', 'classroom',
  'professor', 'lecturer', 'adjunct',
  'paraprofessional', 'teacher aide', 'teaching assistant',
  'school principal', 'school administrator', 'dean',
  'librarian', 'school counselor',
  'tutor', // physical tutoring
  'daycare', 'childcare', 'preschool',
];

const BLACKLIST_AUTOMOTIVE = [
  'mechanic', 'auto mechanic', 'automotive technician',
  'body shop', 'collision repair', 'tire technician',
  'oil change', 'lube tech', 'service advisor',
  'detailer', 'car wash',
];

const BLACKLIST_PHYSICAL_ENGINEERING = [
  'mechanical engineer', 'mechanical engineering', 'electrical engineer', 'civil engineer',
  'structural engineer', 'chemical engineer', 'aerospace engineer',
  'hardware engineer', 'manufacturing engineer', 'industrial engineer',
  'process engineer', 'plant engineer', 'facilities engineer',
  'project engineer', 'field engineer', 'site engineer',
  'pcb designer', 'hardware design', 'hardware test',
  'rf engineer', 'power engineer', 'controls engineer',
  'biomedical engineer', 'nuclear engineer', 'marine engineer',
  'mining engineer', 'petroleum engineer', 'geological engineer',
  'environmental engineer', 'agricultural engineer',
  'test engineer, hardware', 'validation engineer, hardware',
  // CAD/Hardware engineering
  'cad engineer', 'cad backend', 'cad automation', 'catia',
  'solidworks engineer', 'autocad',
  // Physical process engineering
  'energetics', 'energetic', 'propulsion', 'combustion',
];

const BLACKLIST_ACCOUNTING = [
  'accountant', 'staff accountant', 'senior accountant',
  'accounting', 'accounting consultant', 'accounting specialist',
  'bookkeeper', 'bookkeeping',
  'accounts payable', 'accounts receivable', 'ap/ar', 'a/p', 'a/r',
  'payroll', 'payroll specialist', 'payroll clerk',
  'auditor', 'internal auditor', 'external auditor',
  'tax preparer', 'tax specialist', 'tax accountant',
  'collections', 'collector', 'credit analyst',
  'controller', 'assistant controller',
  'billing', 'billing specialist', 'invoicing',
  'cpa', 'certified public accountant',
];

const BLACKLIST_SALES_FIELD = [
  'field sales', 'outside sales', 'door to door', 'door-to-door',
  'canvasser', 'canvassing',
  'territory manager', 'territory sales', 'regional sales',
  'area manager', 'district manager', 'zone manager',
  'brand ambassador', 'promoter', 'demonstrator',
  'retail sales', 'in-store sales',
  'route sales', 'delivery sales',
];

const BLACKLIST_PROPERTY = [
  'property manager', 'apartment manager', 'building manager',
  'leasing agent', 'leasing consultant', 'real estate agent',
  'realtor', 'property inspector', 'home inspector',
  'superintendent', 'building superintendent',
  'facilities manager', 'facilities coordinator',
];

const BLACKLIST_BEAUTY = [
  'hairdresser', 'hair stylist', 'barber', 'beautician',
  'nail technician', 'esthetician', 'massage therapist',
  'personal trainer', 'fitness instructor', 'gym',
  'yoga instructor', 'pilates', 'aerobics',
  'spa', 'salon',
];

const BLACKLIST_AGRICULTURE = [
  'farm', 'farmer', 'ranch', 'rancher', 'agricultural',
  'harvest', 'crop', 'livestock', 'dairy',
  'fisherman', 'fishing', 'aquaculture',
];

const BLACKLIST_LEGAL_TRADITIONAL = [
  'attorney', 'lawyer', 'legal counsel', 'general counsel',
  'litigation', 'court', 'judge', 'court reporter',
  'public defender', 'prosecutor', 'district attorney',
];

const BLACKLIST_MISC = [
  // Generic non-jobs
  'volunteer', 'internship unpaid', 'stipend only',
  // Physical labor
  'laborer', 'labor', 'hand', 'helper',
  // Military/Government physical
  'police', 'officer', 'firefighter', 'fire fighter',
  'corrections', 'detention', 'prison',
  // Funeral/Cemetery
  'funeral', 'mortician', 'cemetery',
  // Religious
  'pastor', 'minister', 'priest', 'rabbi', 'imam',
  // Airlines (physical)
  'flight attendant', 'cabin crew', 'pilot', 'co-pilot',
  'ground crew', 'baggage handler', 'ramp agent',
];

// Combine all blacklist patterns
const BLACKLIST_PATTERNS = [
  ...BLACKLIST_HEALTHCARE,
  ...BLACKLIST_CONSTRUCTION,
  ...BLACKLIST_MANUFACTURING,
  ...BLACKLIST_RETAIL_HOSPITALITY,
  ...BLACKLIST_LOGISTICS,
  ...BLACKLIST_FIELD_OUTDOOR,
  ...BLACKLIST_SECURITY_CLEANING,
  ...BLACKLIST_OFFICE_TRADITIONAL,
  ...BLACKLIST_ENTERTAINMENT_EVENTS,
  ...BLACKLIST_SOCIAL_WORK,
  ...BLACKLIST_EDUCATION_TRADITIONAL,
  ...BLACKLIST_AUTOMOTIVE,
  ...BLACKLIST_PHYSICAL_ENGINEERING,
  ...BLACKLIST_ACCOUNTING,
  ...BLACKLIST_SALES_FIELD,
  ...BLACKLIST_PROPERTY,
  ...BLACKLIST_BEAUTY,
  ...BLACKLIST_AGRICULTURE,
  ...BLACKLIST_LEGAL_TRADITIONAL,
  ...BLACKLIST_MISC,
];

// ============================================================================
// WHITELIST — РАЗРЕШЁННЫЕ ПРОФЕССИИ (специфичные термины)
// ============================================================================

const WHITELIST_ENGINEERING = [
  // Software Engineering (specific)
  'software engineer', 'software developer',
  'frontend developer', 'front-end developer', 'front end developer',
  'backend developer', 'back-end developer', 'back end developer',
  'fullstack developer', 'full-stack developer', 'full stack developer',
  'frontend engineer', 'front-end engineer', 'front end engineer',
  'backend engineer', 'back-end engineer', 'back end engineer',
  'fullstack engineer', 'full-stack engineer', 'full stack engineer',
  'web developer', 'mobile developer', 'app developer',
  'ios developer', 'android developer', 'ios engineer', 'android engineer',
  'react developer', 'vue developer', 'angular developer',
  'react engineer', 'vue engineer', 'angular engineer',
  'node developer', 'nodejs developer', 'node engineer',
  'python developer', 'java developer', 'golang developer', 'go developer',
  'python engineer', 'java engineer', 'golang engineer', 'go engineer',
  'rust developer', 'ruby developer', 'rails developer',
  'rust engineer', 'ruby engineer', 'rails engineer',
  'php developer', 'laravel developer', 'django developer',
  'php engineer', 'laravel engineer', 'django engineer',
  '.net developer', 'c# developer', 'dotnet developer',
  '.net engineer', 'c# engineer', 'dotnet engineer', 'c++ engineer',
  'blockchain developer', 'smart contract developer', 'web3 developer', 'solidity',
  'blockchain engineer', 'smart contract engineer', 'web3 engineer',
  'game developer', 'unity developer', 'unreal developer',
  'game engineer', 'unity engineer', 'unreal engineer',
  'wordpress developer', 'shopify developer', 'webflow developer',
  'api developer', 'integration developer', 'api engineer', 'integration engineer',
  'embedded developer', 'firmware developer', 'embedded engineer', 'firmware engineer',
  // Engineering titles (with software context)
  'software engineering', 'application engineer',
  'technical lead', 'tech lead', 'engineering manager',
  'vp engineering', 'vp of engineering', 'head of engineering', 'cto',
  'principal engineer', 'staff engineer', 'senior engineer',
  'senior software engineer', 'lead engineer', 'lead software engineer',
  'engineering director', 'director of engineering',
  // SDET variations
  'software development engineer in test', 'software engineer in test',
  // Generic terms (digital context)
  'developer', 'programmer', 'coder',
];

const WHITELIST_DATA = [
  'data scientist', 'data analyst', 'data engineer',
  'machine learning engineer', 'ml engineer', 'ai engineer',
  'business intelligence', 'bi developer', 'bi analyst', 'bi engineer',
  'analytics engineer', 'data visualization',
  'quantitative analyst', 'quant developer',
  'nlp engineer', 'computer vision engineer', 'deep learning',
  'ai researcher', 'ml researcher', 'research scientist, ai',
  'data ops', 'dataops', 'data governance', 'data steward',
  'etl developer', 'data warehouse', 'data platform',
  'ai/ml', 'ml/ai', 'genai', 'generative ai',
  'prompt engineer', 'ai trainer', 'data annotator',
  'data architect', 'analytics architect',
  'deployed engineer', 'forward deployed',
];

const WHITELIST_DEVOPS = [
  'devops engineer', 'devops', 'sre', 'site reliability',
  'platform engineer', 'infrastructure engineer',
  'cloud engineer', 'aws engineer', 'azure engineer', 'gcp engineer',
  'kubernetes engineer', 'k8s', 'docker',
  'terraform', 'infrastructure as code',
  'systems administrator', 'system administrator', 'sysadmin', 'linux admin',
  'database administrator', 'dba', 'postgres', 'mysql admin',
  'release engineer', 'build engineer', 'ci/cd',
  'network engineer', // remote network config
  'cloud architect', 'solutions architect',
];

const WHITELIST_QA = [
  'qa engineer', 'qa analyst', 'quality assurance engineer',
  'test engineer', 'test automation', 'automation engineer',
  'sdet', 'software test', 'quality engineer',
  'performance tester', 'load tester', 'qa tester', 'tester',
  'qa lead', 'qa manager', 'test lead', 'test manager',
  'quality assurance tester', 'quality assurance analyst',
];

const WHITELIST_SECURITY = [
  'security engineer', 'security analyst', 'security architect',
  'cybersecurity', 'cyber security', 'information security', 'infosec',
  'penetration tester', 'pentester', 'ethical hacker', 'red team',
  'soc analyst', 'security operations', 'blue team',
  'application security', 'appsec', 'cloud security',
  'security researcher', 'vulnerability',
  'ciso', 'chief information security',
];

const WHITELIST_DESIGN = [
  'ui designer', 'ux designer', 'ui/ux', 'ux/ui', 'uiux',
  'ui developer', 'ux developer',
  'product designer', 'digital product designer',
  'visual designer', 'graphic designer', 'web designer',
  'interaction designer', 'motion designer', 'motion designers', 'motion graphics',
  'brand designer', 'creative director', 'art director',
  'design lead', 'head of design', 'design manager',
  'figma', 'sketch designer',
  '3d designer', '3d artist', '3d modeler',
  'designer', // generic - matches "Marketing Designer", etc.
];

const WHITELIST_PRODUCT = [
  'product manager', 'product owner', 'technical product manager',
  'product lead', 'senior product manager', 'group product manager',
  'vp product', 'vp of product', 'head of product', 'cpo', 'chief product',
  'product director', 'director of product',
  'product analyst', 'product ops', 'product operations',
  'growth product manager',
];

const WHITELIST_PROJECT = [
  'project manager', 'technical project manager', 'it project manager',
  'program manager', 'technical program manager', 'tpm',
  'scrum master', 'agile coach', 'delivery manager',
  'pmo', 'project management',
];

const WHITELIST_MARKETING = [
  'marketing manager', 'digital marketing', 'growth marketing',
  'performance marketing', 'content marketing',
  'seo specialist', 'seo manager', 'sem specialist', 'sem manager',
  'ppc specialist', 'ppc manager', 'paid media', 'media buyer',
  'social media manager', 'social media specialist',
  'community manager', 'community lead',
  'email marketing', 'email specialist', 'marketing automation',
  'crm manager', 'crm specialist', 'lifecycle marketing',
  'brand manager', 'brand strategist',
  'marketing analyst', 'marketing ops', 'marketing operations',
  'growth manager', 'growth lead', 'head of growth',
  'demand generation', 'demand gen', 'lead generation', 'lead gen',
  'lead gen manager', 'leadgen', 'traffic manager', 'traffic acquisition',
  'vp marketing', 'head of marketing', 'cmo', 'chief marketing',
  'content strategist', 'content lead',
  'affiliate marketing', 'influencer marketing', 'partnership marketing',
];

const WHITELIST_CONTENT = [
  'copywriter', 'content writer', 'technical writer',
  'ux writer', 'seo writer', 'blog writer',
  'editor', 'copy editor', 'content editor', 'managing editor',
  'content strategist', 'content manager', 'content lead',
  'content creator', 'content producer', 'content specialist',
  'ghostwriter', 'scriptwriter',
];

const WHITELIST_VIDEO_AUDIO = [
  'video editor', 'video producer', 'youtube editor',
  'videographer', 'cinematographer',
  'motion graphics designer', 'after effects',
  'animator', '2d animator', '3d animator',
  'sound designer', 'audio engineer', 'podcast editor',
  'voice over', 'voiceover artist', 'voice artist',
  'colorist', 'vfx artist', 'visual effects',
  'music producer', 'audio producer', 'composer',
];

const WHITELIST_TRANSLATION = [
  'translator', 'localization specialist', 'localization engineer',
  'localization manager', 'localization lead',
  'interpreter', // remote interpreter
  'transcriptionist', 'subtitler', 'captioner',
  'translation project manager', 'language specialist',
  'localization qa', 'linguistic qa',
];

const WHITELIST_SALES = [
  'account executive', 'ae ',
  'sales development representative', 'sdr',
  'business development representative', 'bdr',
  'business development manager', 'bdm',
  'sales engineer', 'solutions engineer', 'pre-sales engineer',
  'presales', 'pre-sales',
  'solutions consultant', 'solution architect',
  'customer success manager', 'csm', 'customer success lead',
  'account manager', 'strategic account',
  'partnership manager', 'partner manager', 'channel manager',
  'inside sales', 'saas sales', 'enterprise sales',
  'sales manager', 'sales director', 'vp sales', 'head of sales',
  'revenue operations', 'revops',
];

const WHITELIST_SUPPORT = [
  'customer support', 'customer support specialist',
  'customer service specialist', // not "representative"
  'technical support', 'tech support', 'support engineer',
  'support specialist', 'it support', 'it helpdesk',
  'help desk analyst', 'helpdesk',
  'customer success associate', 'customer success specialist',
  'customer experience', 'cx specialist',
  'implementation manager', 'implementation specialist',
  'onboarding specialist', 'onboarding manager', 'onboarding',
  'global onboarding',
];

const WHITELIST_HR = [
  'recruiter', 'technical recruiter', 'it recruiter',
  'sourcer', 'talent sourcer',
  'talent acquisition', 'recruiting coordinator', 'recruiting manager',
  'hr business partner', 'hrbp',
  'people operations', 'people ops', 'people partner',
  'employer branding', 'talent brand',
  'compensation analyst', 'total rewards',
  'head of people', 'vp people', 'chief people officer',
];

const WHITELIST_FINANCE = [
  'financial analyst', 'fp&a', 'fpa analyst',
  'finance analyst', 'senior financial analyst',
  'investment analyst', 'equity research', 'research analyst',
  'financial modeler', 'valuation analyst',
  'pricing analyst', 'budget analyst',
  'treasury analyst', 'treasury manager',
  'finance manager', 'finance director', 'vp finance', 'cfo',
];

const WHITELIST_LEGAL = [
  'legal writer', 'legal content',
  'contract analyst', 'contract manager', 'contracts specialist',
  'legal researcher', 'legal research',
  'compliance specialist', 'compliance analyst', 'compliance manager',
  'privacy analyst', 'privacy specialist', 'data protection', 'dpo',
  'gdpr specialist', 'ccpa',
  'paralegal', 'legal assistant',
  'legal operations', 'legal ops',
  'ip analyst', 'patent analyst',
];

const WHITELIST_EDUCATION = [
  'instructional designer', 'e-learning developer', 'elearning',
  'course creator', 'curriculum developer', 'curriculum designer',
  'lms administrator', 'lms specialist',
  'training specialist', 'training manager', 'learning specialist',
  'corporate trainer', 'technical trainer',
  'educational content', 'learning designer',
];

const WHITELIST_RESEARCH = [
  'ux researcher', 'user researcher', 'design researcher',
  'market researcher', 'market research analyst',
  'research analyst', 'research associate',
  'insights analyst', 'consumer insights',
  'competitive intelligence', 'competitive analyst',
  'survey researcher', 'quantitative researcher', 'qualitative researcher',
];

const WHITELIST_OPERATIONS = [
  'operations manager', 'business operations',
  'operations analyst', 'ops analyst',
  'revops', 'revenue operations', 'sales operations',
  'business analyst', 'strategy analyst',
  'chief of staff', 'executive assistant',
  'virtual assistant', 'va ',
  'administrative assistant', 'admin assistant',
  'data entry specialist', 'data entry clerk',
  'research assistant',
  'operations lead', 'head of operations', 'vp operations', 'coo',
];

const WHITELIST_CONSULTING = [
  'management consultant', 'strategy consultant',
  'technology consultant', 'it consultant',
  'digital transformation', 'digital consultant',
  'salesforce consultant', 'sap consultant', 'oracle consultant',
  'implementation consultant', 'functional consultant',
  'marketing consultant', 'seo consultant',
  'business consultant', 'advisory',
];

// Combine all whitelist patterns
const WHITELIST_PATTERNS = [
  ...WHITELIST_ENGINEERING,
  ...WHITELIST_DATA,
  ...WHITELIST_DEVOPS,
  ...WHITELIST_QA,
  ...WHITELIST_SECURITY,
  ...WHITELIST_DESIGN,
  ...WHITELIST_PRODUCT,
  ...WHITELIST_PROJECT,
  ...WHITELIST_MARKETING,
  ...WHITELIST_CONTENT,
  ...WHITELIST_VIDEO_AUDIO,
  ...WHITELIST_TRANSLATION,
  ...WHITELIST_SALES,
  ...WHITELIST_SUPPORT,
  ...WHITELIST_HR,
  ...WHITELIST_FINANCE,
  ...WHITELIST_LEGAL,
  ...WHITELIST_EDUCATION,
  ...WHITELIST_RESEARCH,
  ...WHITELIST_OPERATIONS,
  ...WHITELIST_CONSULTING,
];

// ============================================================================
// REGEX BUILDERS
// ============================================================================

// Build blacklist regex with word boundaries
const blacklistPatternString = BLACKLIST_PATTERNS
  .map(p => {
    // Escape special regex chars
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `\\b${escaped}\\b`;
  })
  .join('|');

const BLACKLIST_REGEX = new RegExp(`(${blacklistPatternString})`, 'i');

// Build whitelist regex with word boundaries
const whitelistPatternString = WHITELIST_PATTERNS
  .map(p => {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `\\b${escaped}\\b`;
  })
  .join('|');

const WHITELIST_REGEX = new RegExp(`(${whitelistPatternString})`, 'i');

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if a job title is explicitly blacklisted
 * @param title - Job title to check
 * @returns true if the job should be EXCLUDED
 */
export function isBlacklistedProfession(title: string): boolean {
  if (!title) return false;
  return BLACKLIST_REGEX.test(title);
}

/**
 * Check if a job title matches our target professions whitelist
 * @param title - Job title to check
 * @returns true if the job is relevant to our audience
 */
export function isTargetProfession(title: string): boolean {
  if (!title) return false;
  return WHITELIST_REGEX.test(title);
}

/**
 * Main function: Check if job should be imported
 *
 * RULE ORDER:
 * 1. Blacklist check (priority) → if matches → SKIP
 * 2. Whitelist check → if matches → IMPORT
 * 3. No match → SKIP
 *
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

// Export for testing/debugging
export const TARGET_PROFESSION_PATTERNS = WHITELIST_PATTERNS;
export const BLOCKED_PROFESSION_PATTERNS = BLACKLIST_PATTERNS;
