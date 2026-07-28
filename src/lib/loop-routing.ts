// Direction routing for the auto-apply matcher.
//
// Problem it solves: every opportunity used to be fanned out across ALL active loops, with only a
// loose word-overlap pre-filter, so a single "Dataiku Developer" (data) listing reached ~220 of 250
// loops — graphic designers, recruiters, animators — and the LLM rejected almost all of them
// (wasted AI calls, slow matcher, a wall of junk in the audit). Here we tag each loop with the
// professional DIRECTIONS it belongs to (one of the 21 categories, MULTIPLE allowed), and the
// matcher only considers a loop whose directions match the listing's category (or an adjacent one).
//
// Recall-safe by design: a person lands in ALL their real directions (multi-membership) + an
// adjacency map widens each category to its neighbours + a loop with NO directions falls through to
// the old behaviour (fail-open). We'd rather let an extra candidate reach the LLM than silently drop
// a real one.

export const ALL_CATEGORY_SLUGS = [
  'engineering', 'design', 'data', 'devops', 'qa', 'security',
  'product', 'marketing', 'sales', 'finance', 'hr', 'operations', 'legal', 'project-management',
  'writing', 'translation', 'creative',
  'support', 'education', 'research', 'consulting',
] as const;

// Keyword → category triggers. A trigger is a plain substring (distinctive, multi-char) or a RegExp
// (for short/ambiguous tokens that need a word boundary: bi, qa, hr, pm, 2d…). Multi-membership: a
// haystack can match several categories ("Senior Data Engineer | ML" → data + engineering). Triggers
// lean specific so the routing cut stays meaningful (generic "sql"/"api"/"git" are NOT data/eng
// triggers on their own).
const TRIGGERS: Record<string, (string | RegExp)[]> = {
  engineering: [
    'developer', 'engineer', 'programmer', 'software', 'full-stack', 'fullstack', 'full stack',
    'backend', 'back-end', 'back end', 'frontend', 'front-end', 'front end', 'web dev', /\bswe\b/, /\bsde\b/,
    '.net', 'asp.net', 'dotnet', 'java', 'python', 'node', 'react', 'angular', 'vue', 'php', 'laravel',
    'golang', /\bgo developer\b/, 'ruby', 'rails', 'c++', 'c#', 'spring boot', 'kotlin', 'swift', 'flutter',
    'android', /\bios\b/, 'mobile dev', 'embedded', 'firmware', 'microservices', 'api development',
  ],
  data: [
    'data engineer', 'data analyst', 'data scien', 'data analytics', 'data analysis', 'data pipeline',
    'data warehouse', 'data modeling', 'data modelling', 'big data', 'master data', 'analytics engineer',
    'business intelligence', 'business analyst', /\bbi developer\b/, /\bbi analyst\b/, 'dataiku', 'etl',
    'elt', 'spark', 'pyspark', 'hadoop', 'snowflake', 'databricks', 'bigquery', 'redshift', 'tableau',
    'power bi', 'powerbi', 'looker', 'machine learning', 'ml engineer', 'ai engineer', 'ml/ai', 'ai/ml',
    /\bml\b/, 'pytorch', 'tensorflow', 'scikit', 'keras', 'deep learning', /\bnlp\b/, 'informatica',
    'kafka', 'airflow',
  ],
  design: [
    'designer', 'ux/ui', 'ui/ux', 'ux design', 'ui design', 'user experience', 'user interface',
    'figma', 'sketch', 'graphic design', 'visual design', 'product design', 'web design',
    'brand identity', 'wireframe', 'prototyp', 'illustrat',
  ],
  devops: [
    'devops', 'sre', 'site reliability', 'cloud engineer', 'platform engineer', 'kubernetes', /\bk8s\b/,
    'terraform', 'ansible', 'ci/cd', 'cicd', 'infrastructure', 'sysadmin', 'system administrator',
    'cloud infrastructure', 'devsecops',
  ],
  qa: [
    /\bqa\b/, 'quality assur', 'quality analyst', 'quality engineer', 'test engineer', 'tester', /\bsdet\b/,
    'automation test', 'test automation', 'selenium', 'cypress', 'playwright', 'tosca', 'manual test',
    'quality control', 'qa engineer',
  ],
  security: [
    'security', 'infosec', 'cybersecurity', 'cyber security', 'penetration test', 'pentest', 'owasp',
    'soc analyst', 'vulnerability', 'application security',
  ],
  product: ['product manager', 'product owner', 'product management', 'product lead', 'head of product'],
  marketing: [
    'marketing', 'growth', /\bseo\b/, /\bsem\b/, /\bppc\b/, 'performance marketing', 'social media',
    'brand manager', 'digital marketing', 'demand generation', 'content marketing',
  ],
  sales: [
    /\bsales\b/, 'account executive', 'business development', /\bbdr\b/, /\bsdr\b/, 'account manager',
    'inside sales',
  ],
  finance: [
    'accountant', 'accounting', 'bookkeep', 'payroll', 'fp&a', 'financial analyst', 'financial controller',
    'financial reporting', 'auditor', 'cfo',
  ],
  hr: [/\bhr\b/, 'recruit', 'talent acquisition', 'people ops', 'human resources', 'sourcer', 'headhunter'],
  operations: [
    'operations', 'ops manager', 'office manager', 'administrative', 'supply chain', 'logistics',
    'business operations',
  ],
  legal: ['lawyer', 'attorney', 'paralegal', 'legal counsel', 'general counsel', 'legal advisor', 'law firm', 'litigation'],
  'project-management': [
    'project manager', 'scrum master', 'agile coach', 'program manager', /\bpmo\b/, /\bpmp\b/, 'safe agilist',
    'delivery manager', 'project management',
  ],
  writing: ['writer', 'copywriter', 'copywriting', 'content writer', 'technical writer', 'journalist', 'editorial'],
  translation: [
    'translat', 'localiz', 'localis', 'linguist', 'interpreter', 'subtitl', 'caption', 'transcription',
    'proofread', 'terminolog', 'language specialist', 'language expert',
  ],
  creative: [
    'animator', 'animation', 'video editor', 'motion graphic', 'illustrator', /\b2d\b/, /\b3d\b/,
    'creative director', 'art director', 'videograph', 'photograph',
  ],
  support: [
    'customer support', 'customer success', 'customer service', 'help desk', 'helpdesk', 'technical support',
    'support engineer', 'support specialist',
  ],
  education: ['teacher', 'tutor', 'instructor', 'lecturer', 'trainer', 'curriculum', 'professor', 'educator', 'e-learning'],
  research: ['researcher', 'research scientist', 'research engineer', 'research associate', 'r&d', /\bphd\b/, 'academic research'],
  consulting: ['consultant', 'consulting', 'advisory'],
};

// Which loop-directions should receive a listing of category X (always includes X itself). The list
// is recall-safe: neighbours that a candidate of that direction could plausibly fill. Owner rule:
// "data does NOT pull design" — kept (data's neighbours are engineering/devops/research only).
// ASYMMETRIC on purpose. "engineering" is the GENERIC bucket (almost every dev), so a generic SWE
// listing legitimately fans out to all tech specialists — but a SPECIALIST listing (data / devops /
// qa / security / design) must NOT pull the whole engineering bucket back, or there's no cut at all
// (a data role would still reach every engineer). Cross-over is carried by multi-membership instead:
// a dev who actually does data is tagged `data`, so they receive data roles; a pure backend dev is
// not, and correctly doesn't. Owner rule "data does NOT pull design" holds.
export const CATEGORY_ADJACENCY: Record<string, string[]> = {
  engineering: ['engineering', 'data', 'devops', 'qa', 'security'],
  data: ['data', 'devops', 'research'],
  design: ['design', 'creative'],
  devops: ['devops', 'security', 'data'],
  qa: ['qa'],
  security: ['security', 'devops'],
  product: ['product', 'project-management', 'design', 'marketing'],
  marketing: ['marketing', 'sales', 'writing', 'creative'],
  sales: ['sales', 'marketing'],
  finance: ['finance'],
  hr: ['hr'],
  operations: ['operations', 'project-management', 'support'],
  legal: ['legal'],
  'project-management': ['project-management', 'product', 'operations'],
  writing: ['writing', 'marketing', 'creative', 'translation'],
  translation: ['translation', 'writing'],
  creative: ['creative', 'design', 'writing'],
  support: ['support', 'operations'],
  education: ['education', 'writing'],
  research: ['research', 'data'],
  consulting: ['consulting', 'product', 'project-management'],
};

/**
 * Classify a loop into the professional directions it belongs to (multi). Scans the loop's job
 * titles + the candidate's current title / field / top skills. Returns a de-duped list of category
 * slugs; [] when nothing recognisable matched (the matcher then fails open for this loop).
 */
export function deriveCategorySlugs(input: {
  jobTitles?: string[];
  currentTitle?: string | null;
  field?: string | null;
  skills?: string[];
}): string[] {
  const norm = (s: string) => ' ' + s.toLowerCase().replace(/[^a-z0-9+#./\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  // STRONG signal — the person's actual occupation/field (loop job titles + current title + field).
  const titleHay = norm([...(input.jobTitles || []), input.currentTitle || '', input.field || ''].join(' '));
  // WEAK signal — skills. A single skill is noisy (a developer lists "Figma"; a graphic designer
  // lists "HTML"), so a skills-ONLY category needs ≥2 distinct trigger hits before we tag it. This
  // kills the over-tagging that leaked candidates into wrong directions (a Graphic Designer tagged
  // "engineering", a Full-Stack dev tagged "design/marketing/qa/security").
  const skillHay = norm((input.skills || []).slice(0, 15).join(' '));
  const hit = (t: string | RegExp, hay: string) => (typeof t === 'string' ? hay.includes(t) : t.test(hay));
  const out = new Set<string>();
  for (const [slug, triggers] of Object.entries(TRIGGERS)) {
    // Title/field names the direction → tag on a single hit (it IS their occupation).
    if (triggers.some((t) => hit(t, titleHay))) { out.add(slug); continue; }
    // Skills only → require two distinct triggers so one stray tool doesn't add a whole profession.
    let n = 0;
    for (const t of triggers) { if (hit(t, skillHay)) { n++; if (n >= 2) break; } }
    if (n >= 2) out.add(slug);
  }
  return [...out];
}

/**
 * Does a loop with these directions want a listing of `oppCatSlug`? Fail-open on an unclassified
 * loop (empty → true) so we never silently drop a candidate we haven't categorised yet.
 */
export function routeAllows(loopCategorySlugs: string[] | null | undefined, oppCatSlug: string): boolean {
  if (!loopCategorySlugs || loopCategorySlugs.length === 0) return true; // fail-open
  const wanted = CATEGORY_ADJACENCY[oppCatSlug] || [oppCatSlug];
  return loopCategorySlugs.some((c) => wanted.includes(c));
}

/**
 * INVERSE of CATEGORY_ADJACENCY for the discovery role-gate: given a candidate's family, the set of
 * opportunity families they should SEE — i.e. every opp-family O whose adjacency list contains
 * `userFamily` (routeAllows([userFamily], O) === true). Used to build the feed's SQL/Prisma filter
 * so an opp is kept when `roleFamily IN oppFamiliesForUser(userFamily)`. Always includes the family
 * itself. Returns [] for a null/unknown family so callers can treat it as "no filter" (fail-open).
 */
export function oppFamiliesForUser(userFamily: string | null | undefined): string[] {
  if (!userFamily) return [];
  const out = new Set<string>([userFamily]);
  for (const [oppFam, receivers] of Object.entries(CATEGORY_ADJACENCY)) {
    if (receivers.includes(userFamily)) out.add(oppFam);
  }
  return [...out];
}
