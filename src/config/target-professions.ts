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
  // Avionics/Hardware tech (v2.2 addition)
  'avionics technician', 'avionics engineer', 'avionics',
  'asic', 'dft engineer', 'cdc constraints',
  'pcb design engineer', 'pcb engineer',
  'building automation systems',
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
  // Indian accounting/compliance roles (2026-06-13, blacklist-only era — these flood from Telegram
  // finance channels; onsite-India FTE, not our target). MULTI-WORD / qualified forms so we never
  // catch bare 'ca' (California etc.) and never block our finance TARGETS (financial analyst, FP&A,
  // treasury analyst — kept in WHITELIST_FINANCE, NOT blacklisted).
  'chartered accountant', 'company secretary', 'cost accountant', 'icwa', 'cma certification',
  'ca articleship', 'articleship', 'ca fresher', 'ca inter', 'ca final', 'ca industrial',
  'qualified ca', 'semi qualified', 'semi-qualified', 'ca trainee', 'ca dropout',
  'credit manager', 'area credit manager', 'relationship manager', 'branch manager',
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
  // Assistants (too generic for remote tech; 'virtual assistant' moved to
  // whitelist 2026-06-12 — it's a core freelance gig we now scrape deliberately)
  'personal assistant', 'executive assistant',
  'administrative assistant', 'admin assistant',
  // Retail/Merchandise
  'merchandise', 'merchandising', 'merchandiser',
  // Property/Real Estate (already have some, adding more)
  'property management',
  // Pharma/Life Sciences (not IT)
  'life sciences', 'life science', 'pharmaceutical', 'pharma',
  'biotech', 'biotechnology', 'clinical trial',
  // Training programs (not real jobs)
  'master class', 'masterclass', 'training program',
];

// v2.3 (2026-06-13) — Office-but-off-target tail. Added when switching to blacklist-only
// (whitelist dropped): these are non-physical roles the old default-deny silently excluded.
// MULTI-WORD on purpose so tech roles survive: 'loan processing' blocks the junk but
// 'Loan Management System Developer' passes; 'insurance agent' blocks but 'Guidewire Developer'
// (insurance-tech) passes; 'call centre' blocks but 'Call Center Software Developer' passes.
const BLACKLIST_OFFICE_OFFTARGET = [
  // Lending / mortgage / insurance / claims ops (NOT fintech engineering)
  'loan processor', 'loan processing', 'loan officer', 'non-qm', 'non qm',
  'mortgage broker', 'mortgage processor', 'mortgage loan officer', 'mortgage underwriter',
  'underwriter', 'underwriting',
  'insurance agent', 'insurance broker', 'insurance sales', 'insurance advisor',
  'claims adjuster', 'claims processor', 'claims processing', 'claims examiner', 'claims specialist',
  'escrow', 'title officer',
  // Call centre / BPO / telesales
  'call centre', 'call center executive', 'call center representative', 'call centre executive',
  'telecaller', 'telecalling', 'telemarketer', 'telemarketing', 'cold caller', 'cold calling',
  'inbound calling', 'outbound calling',
  // Real estate (managers/brokers; agent/realtor already in BLACKLIST_PROPERTY)
  'commercial real estate', 'real estate manager', 'real estate broker', 'real estate associate',
  // Clinical / lab / pharma ops (some in HEALTHCARE; these cover the office variants)
  'laboratory scientist', 'clinical laboratory', 'lab scientist', 'medical technologist',
  'clinical research', 'pharmacovigilance', 'drug safety', 'regulatory affairs',
  'medical coder', 'medical coding', 'medical biller', 'medical billing',
  // Physical / hardware technicians (engineer titles handled by PHYSICAL_ENGINEERING)
  'engineering technician', 'electrical technician', 'mechanical technician',
  'electronics technician', 'instrumentation technician', 'calibration technician',
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
  ...BLACKLIST_OFFICE_OFFTARGET,
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
  'flutter developer', 'flutter engineer', 'react native developer', 'react native engineer', 'dart developer',
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
  // Architects
  'architect', 'software architect', 'ai architect', 'mobile architect',
  'azure architect', 'aws architect', 'enterprise architect', 'boomi architect',
  // IT admin/tooling
  'administrator', 'atlassian administrator', 'jira engineer', 'jira administrator',
  'linux administrator', 'control-m administrator',
  'migration specialist', 'deployment specialist',
  'robotics engineer', 'simulation engineer',
  'performance engineer', 'mongodb engineer',
  // Consultants
  'consultant', 'blackline consultant', 'oracle consultant',
  'edi analyst',
  'business system analyst', 'business systems analyst',
  // Broad roles
  'expert', 'subject matter expert', 'sme',
  'specialist',
  'mainframe', 'maximo',
  'shopify manager', 'shopify',
  'modeler', 'character modeler',
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
  'brand designer', 'brand design', 'creative director', 'art director', 'creative strategist',
  'design lead', 'head of design', 'design manager', 'design intern',
  'figma', 'sketch designer',
  '3d designer', '3d artist', '3d modeler',
  'illustrator', 'photographer', 'product photographer',
  'graphics artist', '3d visualization',
  'game artist', 'concept artist', '2d artist',
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
  'marketing intern', 'marketing associate', 'marketing executive',
  'seo specialist', 'seo manager', 'seo executive', 'seo analyst', 'seo',
  'sem specialist', 'sem manager',
  'ppc specialist', 'ppc manager', 'paid media', 'media buyer',
  'social media manager', 'social media specialist', 'social media',
  'community manager', 'community lead',
  'email marketing', 'email specialist', 'marketing automation',
  'crm manager', 'crm specialist', 'lifecycle marketing',
  'brand manager', 'brand strategist',
  'marketing analyst', 'marketing ops', 'marketing operations',
  'growth manager', 'growth lead', 'head of growth',
  'growth specialist', 'growth strategist', 'growth executive',
  'growth', 'cro', 'cro strategist', 'chief growth',
  'demand generation', 'demand gen', 'lead generation', 'lead gen',
  'lead gen manager', 'leadgen', 'traffic manager', 'traffic acquisition',
  'vp marketing', 'head of marketing', 'cmo', 'chief marketing',
  'marketeer', 'marketing coordinator', 'marketing assistant',
  'performance marketer',
  'link building', 'link builder',
  'business development intern', 'business development',
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
  // Core translation roles
  'translator', 'senior translator', 'freelance translator',
  'translation manager', 'translation coordinator', 'translation specialist',
  'translation project manager', 'translation reviewer',
  // Localization
  'localization specialist', 'localization engineer', 'localization coordinator',
  'localization manager', 'localization lead', 'localization tester',
  'game localization', 'software localization', 'multimedia localization',
  'localization qa', 'linguistic qa', 'language qa',
  // Linguistics
  'linguist', 'senior linguist', 'computational linguist',
  'language specialist', 'language coordinator', 'language lead',
  'language services', 'language manager',
  // Interpreting
  'interpreter', 'conference interpreter', 'remote interpreter',
  // Post-editing & QA
  'post-editor', 'post editor', 'mtpe', 'machine translation post-editor',
  'post-editing', 'post editing',
  'proofreader', 'revisor', 'reviser',
  'translation reviewer', 'linguistic reviewer', 'localization reviewer',
  // Transcription & Subtitling
  'transcriptionist', 'transcription', 'subtitler', 'captioner', 'subtitle editor',
  'language expert',
  // Specialized
  'terminologist', 'terminology manager', 'terminology specialist',
  'dtp specialist', 'desktop publishing specialist',
  // Bilingual/Multilingual
  'bilingual', 'multilingual', 'polyglot',
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
  'call center agent', 'call center',
  'medical reviewer',
  'customer service representative',
];

const WHITELIST_HR = [
  'hr intern', 'human resources intern',
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
  'chief of staff',
  'data entry specialist', 'data entry clerk', 'data entry',
  'virtual assistant', // core freelance gig (moved from blacklist 2026-06-12)
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
  // Removed: 'business consultant' - too generic, catches pharma/life sciences
];

// v2.2 — Enterprise tech platforms: if mentioned in title, it's IT.
// Captures broad set of titles like "ServiceNow Architect", "SAP APO Consultant",
// "Salesforce Integration Lead", "MuleSoft Architect", "Oracle Field Service Consultant"
// that previous narrow patterns missed due to word-boundary regex (multi-word gaps).
const WHITELIST_ENTERPRISE_TECH = [
  // Enterprise platforms (standalone = IT in 99% of cases)
  'salesforce', 'servicenow', 'workday', 'mulesoft', 'peoplesoft',
  'sharepoint', 'dynamics 365', 'd365 ',
  // SAP variants
  'sap ', 'sap fico', 'sap mm', 'sap sd', 'sap hcm', 'sap apo', 'sap ibp',
  'sap basis', 'sap hana', 'sap successfactors', 'sap ariba',
  // Oracle variants (in addition to existing "oracle consultant")
  'oracle cloud', 'oracle fusion', 'oracle epm', 'oracle hcm', 'oracle ebs',
  'oracle apex', 'oracle integration', 'oracle vbcs', 'oracle field service',
  // Adobe / CMS / DAM
  'aem', 'adobe experience manager', 'sitecore', 'optimizely',
  // Data platforms
  'snowflake', 'databricks', 'tableau', 'power bi', 'matillion',
  // Niche IT / Legacy
  'hp-ux', 'hpux', 'cobol developer', 'mainframe developer', 'siebel',
  // Architect patterns (gap in v2.1 — only had cloud/solutions/data)
  'platform architect', 'integration architect', 'enterprise architect',
  'applications architect', 'technology architect', 'technical architect',
  'security architect', // also in SECURITY but here for completeness
  // Lead/Specialist patterns for tech
  'integration lead', 'platform lead', 'devops lead', 'data lead',
  'integration specialist', 'platform specialist',
  // DevSecOps + Cybersec specialist variants (gap)
  'devsecops', 'devsecops engineer', 'devsecops specialist',
  'cybersecurity specialist', 'cybersecurity analyst', 'cybersecurity engineer',
  'identity management', 'iam engineer', 'iam architect', 'sso',
  // Generic admin (broaden — currently only "systems/system/sysadmin/dba/linux")
  'cloud administrator', 'aws administrator', 'azure administrator',
  'oracle administrator', 'sap administrator', 'workday administrator',
  'servicenow administrator', 'salesforce administrator', 'salesforce admin',
  'sharepoint administrator', 'unix administrator',
  // Transformation roles (often IT)
  'digital transformation', 'cloud transformation',
  'technology transformation', 'finance transformation', 'hr transformation',
  // Misc Java/data niche titles seen in real LinkedIn posts
  'bi consultant', 'analytics consultant', 'reporting consultant',
  // More platforms missed in first pass
  'netsuite', 'epic ', 'epicor', 'fircosoft', 'workato',
  'otm consultant', 'otm lead', 'oracle transportation',
  'sharepoint architect', 'sharepoint developer', 'sharepoint lead',
  // Generic IT role variants (with word-boundary-safe forms)
  'systems engineer', 'systems analyst', 'systems architect',
  'network analyst', 'network architect', 'network systems',
  'technical manager', 'technology lead', 'cloud technology',
  'forward deployment', 'deployment engineer', 'forward-deployed',
  'testing engineer', 'test analyst', 'qa lead engineer',
  'red teamer', 'blue teamer', 'purple team',
  'reporting analyst', 'regulatory reporting', 'compliance reporting',
  'service cloud', 'sales cloud', 'commerce cloud',
  // Business development (gap — had BDR/BDM but not executive variants)
  'business development executive', 'bd executive',
  // IAM / Identity Governance tools (IT)
  'sailpoint', 'identitynow', 'iga architect', 'iga engineer',
  'identity governance', 'okta engineer', 'okta administrator',
  'one identity', 'cyberark', 'beyondtrust',
  // APM / Observability (IT)
  'appdynamics', 'dynatrace', 'datadog engineer', 'splunk engineer',
  'new relic', 'observability engineer',
  // Niche IT consultancy
  'consulting manager', 'analytics consulting', 'ai consulting',
  'paas consultant', 'saas consultant', 'erp consultant',
  // Data modeling (gap)
  'data modeler', 'data modeling',
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
  ...WHITELIST_ENTERPRISE_TECH,
];

// ============================================================================
// HARD NICHING (2026-07-23, owner decision): tech-only import.
// The product niched down to remote tech roles (engineering/data/devops/qa) — the segments that
// actually send and PAY (30d: payers' sends = devops 153 / eng 95 / qa 72 / data 25; meanwhile
// translation 79 sends→1 reply, marketing 164→3, design 215→2, consulting 35→0). The n8n scrape
// rotation was cut the same day (111→96 tech-only queries); this block stops the SAME tail from
// entering via the generic catch-all queries ("send your resume to…" etc.). Patterns are reused
// from the (non-gating) whitelist groups so coverage exactly mirrors what used to be let in.
// 'ui developer'/'ux developer' are spared — those are frontend engineers in practice.
// ============================================================================
const BLACKLIST_NICHE_CUT = [
  ...WHITELIST_TRANSLATION,
  ...WHITELIST_MARKETING,
  ...WHITELIST_CONTENT,
  ...WHITELIST_VIDEO_AUDIO,
  ...WHITELIST_DESIGN.filter(p => p !== 'ui developer' && p !== 'ux developer'),
  ...WHITELIST_CONSULTING,
  // Standalone consultant/consulting: kills the enterprise-bodyshop flood (SAP FICO Consultant,
  // Oracle Techno-Functional Consultant, Workday HCM Consultant…) — 903 supply/mo, 35 sends, 0
  // replies, 2 payer-sends. Platform DEVELOPERS (SAP ABAP Developer etc.) still import.
  'consultant', 'consulting',
  // Admin gig tail (was moved INTO the whitelist 06-12; niching reverses that call)
  'virtual assistant', 'data entry',
];

// ============================================================================
// REGEX BUILDERS
// ============================================================================

// Build blacklist regex with word boundaries
const blacklistPatternString = [...BLACKLIST_PATTERNS, ...BLACKLIST_NICHE_CUT]
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
 * RULE ORDER (v2.3, 2026-06-13 — switched to BLACKLIST-ONLY / default-allow):
 * 1. Blacklist check (priority) → if matches → SKIP
 * 2. Otherwise → IMPORT (default-allow)
 *
 * Why the whitelist was dropped: its original job was SEO anti-thin-content, but /freelance is
 * noindex now, so that reason is dead. Meanwhile the matcher gained strong per-pairing gates
 * (routeAllows by category + lexical/geo pre-filter + AI match GATE) that refuse to actually SEND
 * a mismatched pairing — so a junk opportunity that slips in just queues 0 and ages out. The
 * whitelist was doing redundant work at the cost of silently dropping legit roles it didn't list
 * verbatim (Genesys/SecOps/Database Engineer, Paid Search Strategist, etc.). The blacklist was
 * hardened (BLACKLIST_OFFICE_OFFTARGET) for the office-but-off-target tail before the flip.
 * `isTargetProfession` is kept as a non-gating CLASSIFIER to monitor mis-send rate for a week.
 *
 * @param title - Job title to check
 * @returns true if job should be imported, false if should be skipped
 */
export function shouldImportByProfession(title: string): boolean {
  // Blacklist is now the ONLY hard gate (default-allow for everything else).
  return !isBlacklistedProfession(title);
}

// Export for testing/debugging
export const TARGET_PROFESSION_PATTERNS = WHITELIST_PATTERNS;
export const BLOCKED_PROFESSION_PATTERNS = BLACKLIST_PATTERNS;
