/**
 * SEO niche hubs (owner decision 2026-07-19): per-profession/skill public landing pages, each a
 * live filtered feed of real Opportunity rows → funnels into signup. Only niches with REAL supply
 * (measured 2026-07-19: engineering 5777/30d, data 2379, devops 1081, qa 833, product 529, pm 406,
 * design 390) — supply-starved directions (translation 101, writing 59, legal 27) are deliberately
 * excluded: a landing page for them = thin content + an empty feed.
 *
 * Matching: an opportunity belongs to a niche if its category is in `categorySlugs` AND (when
 * `skillKeywords` is set) a keyword appears in its title or skills[]. Category pre-filters in SQL
 * (indexed categoryId); skill keywords refine in JS.
 */
export type SeoNiche = {
  slug: string;                 // URL: /remote-jobs/{slug}
  label: string;                // "React Developer"
  h1: string;                   // hero headline (without the live count prefix)
  seoTitle: string;             // <60 chars ideally
  seoDesc: string;
  categorySlugs: string[];      // pre-filter pool by category
  skillKeywords?: string[];     // refine: any of these in title/skills (case-insensitive)
  intro: string;                // one honest paragraph under the H1
};

export const SEO_NICHES: SeoNiche[] = [
  {
    slug: 'software-engineer',
    label: 'Software Engineer',
    h1: 'Remote Software Engineer jobs & freelance projects',
    seoTitle: 'Remote Software Engineer Jobs',
    seoDesc: 'Fresh remote software engineering roles and freelance projects, pulled from LinkedIn hiring posts and company career pages every few hours. Matched to your profile.',
    categorySlugs: ['engineering'],
    intro: 'New engineering roles surface as LinkedIn hiring posts and career-page drops hours before they hit the big boards. Freelanly catches them, matches them to your profile, and drafts an application you review and send yourself.',
  },
  {
    slug: 'react-developer',
    label: 'React Developer',
    h1: 'Remote React Developer jobs & freelance projects',
    seoTitle: 'Remote React Developer Jobs',
    seoDesc: 'Fresh remote React and frontend developer roles and freelance gigs, updated every few hours from LinkedIn posts and career pages.',
    categorySlugs: ['engineering'],
    skillKeywords: ['react', 'react.js', 'reactjs', 'next.js', 'nextjs'],
    intro: 'React and Next.js roles from real hiring posts, matched to your stack. You review each AI-drafted application and send it from your own inbox.',
  },
  {
    slug: 'python-developer',
    label: 'Python Developer',
    h1: 'Remote Python Developer jobs & freelance projects',
    seoTitle: 'Remote Python Developer Jobs',
    seoDesc: 'Fresh remote Python developer and backend roles and freelance projects, updated every few hours.',
    categorySlugs: ['engineering', 'data'],
    skillKeywords: ['python', 'django', 'fastapi', 'flask'],
    intro: 'Python backend and data roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'nodejs-developer',
    label: 'Node.js Developer',
    h1: 'Remote Node.js Developer jobs & freelance projects',
    seoTitle: 'Remote Node.js Developer Jobs',
    seoDesc: 'Fresh remote Node.js and backend JavaScript roles and freelance gigs, updated every few hours.',
    categorySlugs: ['engineering'],
    skillKeywords: ['node', 'node.js', 'nodejs', 'express', 'nestjs'],
    intro: 'Node.js and JavaScript backend roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'fullstack-developer',
    label: 'Full-Stack Developer',
    h1: 'Remote Full-Stack Developer jobs & freelance projects',
    seoTitle: 'Remote Full-Stack Developer Jobs',
    seoDesc: 'Fresh remote full-stack developer roles and freelance projects, updated every few hours from real hiring posts.',
    categorySlugs: ['engineering'],
    skillKeywords: ['full stack', 'full-stack', 'fullstack'],
    intro: 'Full-stack roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'frontend-developer',
    label: 'Frontend Developer',
    h1: 'Remote Frontend Developer jobs & freelance projects',
    seoTitle: 'Remote Frontend Developer Jobs',
    seoDesc: 'Fresh remote frontend developer roles and freelance gigs, updated every few hours.',
    categorySlugs: ['engineering'],
    skillKeywords: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular'],
    intro: 'Frontend roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'backend-developer',
    label: 'Backend Developer',
    h1: 'Remote Backend Developer jobs & freelance projects',
    seoTitle: 'Remote Backend Developer Jobs',
    seoDesc: 'Fresh remote backend developer roles and freelance projects, updated every few hours.',
    categorySlugs: ['engineering'],
    skillKeywords: ['backend', 'back-end', 'back end'],
    intro: 'Backend roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'devops-engineer',
    label: 'DevOps Engineer',
    h1: 'Remote DevOps & Cloud Engineer jobs & freelance projects',
    seoTitle: 'Remote DevOps Engineer Jobs',
    seoDesc: 'Fresh remote DevOps, SRE, and cloud engineering roles (AWS, GCP, Azure, Kubernetes), updated every few hours.',
    categorySlugs: ['devops'],
    intro: 'DevOps, SRE, and platform roles from real hiring posts — the segment where our senior-infra members find the most matches.',
  },
  {
    slug: 'data-engineer',
    label: 'Data Engineer',
    h1: 'Remote Data Engineer jobs & freelance projects',
    seoTitle: 'Remote Data Engineer Jobs',
    seoDesc: 'Fresh remote data engineering roles (ETL, pipelines, warehousing), updated every few hours.',
    categorySlugs: ['data'],
    skillKeywords: ['data engineer', 'etl', 'elt', 'pipeline', 'spark', 'airflow', 'snowflake', 'dbt'],
    intro: 'Data engineering roles from real hiring posts, matched to your stack.',
  },
  {
    slug: 'data-analyst',
    label: 'Data Analyst',
    h1: 'Remote Data Analyst jobs & freelance projects',
    seoTitle: 'Remote Data Analyst Jobs',
    seoDesc: 'Fresh remote data analyst and BI roles (SQL, Power BI, Tableau), updated every few hours.',
    categorySlugs: ['data'],
    skillKeywords: ['analyst', 'analytics', 'power bi', 'tableau', 'sql', 'business intelligence'],
    intro: 'Data analyst and BI roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'qa-engineer',
    label: 'QA Engineer',
    h1: 'Remote QA & Test Engineer jobs & freelance projects',
    seoTitle: 'Remote QA Engineer Jobs',
    seoDesc: 'Fresh remote QA, automation, and test engineering roles, updated every few hours.',
    categorySlugs: ['qa'],
    intro: 'QA and test automation roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'ux-ui-designer',
    label: 'UX/UI Designer',
    h1: 'Remote UX/UI Designer jobs & freelance projects',
    seoTitle: 'Remote UX/UI Designer Jobs',
    seoDesc: 'Fresh remote product, UX, and UI design roles and freelance gigs, updated every few hours.',
    categorySlugs: ['design'],
    intro: 'Product and UX/UI design roles from real hiring posts, matched to your portfolio.',
  },
  {
    slug: 'product-manager',
    label: 'Product Manager',
    h1: 'Remote Product Manager jobs & freelance projects',
    seoTitle: 'Remote Product Manager Jobs',
    seoDesc: 'Fresh remote product management roles, updated every few hours from real hiring posts.',
    categorySlugs: ['product'],
    intro: 'Product management roles from real hiring posts, matched to your profile.',
  },
  {
    slug: 'project-manager',
    label: 'Project Manager',
    h1: 'Remote Project Manager jobs & freelance projects',
    seoTitle: 'Remote Project Manager Jobs',
    seoDesc: 'Fresh remote project management roles, updated every few hours from real hiring posts.',
    categorySlugs: ['project-management'],
    intro: 'Project management roles from real hiring posts, matched to your profile.',
  },
];

export function getNiche(slug: string): SeoNiche | undefined {
  return SEO_NICHES.find((n) => n.slug === slug);
}

/** True if an opportunity belongs to a niche (skill refinement in JS over title + skills). */
export function matchesNiche(
  opp: { title: string; skills: string[]; categorySlug: string | null },
  niche: SeoNiche,
): boolean {
  if (niche.categorySlugs.length && (!opp.categorySlug || !niche.categorySlugs.includes(opp.categorySlug))) {
    return false;
  }
  if (!niche.skillKeywords?.length) return true;
  const hay = (opp.title + ' ' + opp.skills.join(' ')).toLowerCase();
  return niche.skillKeywords.some((k) => hay.includes(k.toLowerCase()));
}
