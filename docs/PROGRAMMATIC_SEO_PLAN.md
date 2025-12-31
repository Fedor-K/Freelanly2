# Phase 2: Programmatic SEO Implementation Plan

> Created: 2025-12-31
> Status: Planning
> Priority: HIGH
> Expected pages: 764+

## Executive Summary

Programmatic SEO создаёт сотни уникальных страниц, таргетирующих long-tail запросы. Для job board это критически важно — 40-50% трафика приходит на страницы Category + Location.

### Traffic Distribution (Industry Benchmark)

| Page Type | Traffic % | Priority |
|-----------|-----------|----------|
| Category + Location | 40-50% | Critical |
| Individual Job Listings | 30-40% | High |
| Category Hubs | 10-15% | Very High |
| Skills Pages | 5-10% | Medium |

---

## 1. Category + Country Pages

### 1.1 Overview

| Metric | Value |
|--------|-------|
| URL Pattern | `/jobs/[category]/country/[country]` |
| Example | `/jobs/engineering/country/germany` |
| Total Pages | 21 categories × 30 countries = **630 pages** |
| Target Keywords | "remote engineering jobs germany", "remote design jobs uk" |

### 1.2 URL Structure

```
/jobs/engineering/country/usa
/jobs/engineering/country/united-kingdom
/jobs/engineering/country/germany
/jobs/design/country/netherlands
/jobs/data/country/canada
```

**URL Rules:**
- Lowercase only
- Hyphens for multi-word countries (`united-kingdom`, not `uk`)
- Max 60 characters
- No trailing slashes

### 1.3 Countries List (30)

| Code | Slug | Full Name |
|------|------|-----------|
| US | usa | United States |
| GB | united-kingdom | United Kingdom |
| DE | germany | Germany |
| CA | canada | Canada |
| NL | netherlands | Netherlands |
| FR | france | France |
| ES | spain | Spain |
| PL | poland | Poland |
| PT | portugal | Portugal |
| IE | ireland | Ireland |
| AU | australia | Australia |
| IN | india | India |
| BR | brazil | Brazil |
| MX | mexico | Mexico |
| AR | argentina | Argentina |
| UA | ukraine | Ukraine |
| RO | romania | Romania |
| CZ | czechia | Czech Republic |
| CH | switzerland | Switzerland |
| AT | austria | Austria |
| BE | belgium | Belgium |
| SE | sweden | Sweden |
| DK | denmark | Denmark |
| NO | norway | Norway |
| FI | finland | Finland |
| IT | italy | Italy |
| IL | israel | Israel |
| SG | singapore | Singapore |
| JP | japan | Japan |
| AE | uae | United Arab Emirates |

### 1.4 Page Template Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumbs: Home > Jobs > Engineering > Germany            │
├─────────────────────────────────────────────────────────────┤
│ H1: Remote Engineering Jobs in Germany                      │
│ Subtitle: X positions available from Y companies            │
├─────────────────────────────────────────────────────────────┤
│ FILTERS SIDEBAR          │  JOB LISTINGS                    │
│ ├─ Experience Level      │  ├─ JobCard 1                    │
│ ├─ Job Type              │  ├─ JobCard 2                    │
│ └─ Salary Range          │  └─ ...                          │
├─────────────────────────────────────────────────────────────┤
│ SEO CONTENT SECTION (400-600 words)                         │
│ ├─ Intro: Market overview for [category] in [country]       │
│ ├─ Salary Insights: Average salary in [country]             │
│ ├─ Top Companies: Companies hiring in [country]             │
│ ├─ Skills in Demand: Popular skills for [category]          │
│ └─ Why Remote in [Country]: Benefits, timezone, etc.        │
├─────────────────────────────────────────────────────────────┤
│ RELATED PAGES                                               │
│ ├─ Other categories in [country]                            │
│ ├─ [category] in nearby countries                           │
│ └─ [category] by experience level                           │
├─────────────────────────────────────────────────────────────┤
│ FAQ SECTION (4-5 questions with FAQPage schema)             │
│ ├─ How many [category] jobs in [country]?                   │
│ ├─ What is the average salary?                              │
│ ├─ Which companies are hiring?                              │
│ └─ Do I need a visa to work remotely?                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 Meta Tags

```typescript
// Title: max 60 chars
title: `Remote ${category.name} Jobs in ${country.name}`
// Example: "Remote Engineering Jobs in Germany"

// Description: 150-160 chars
description: `Browse ${jobCount} remote ${category.name.toLowerCase()} jobs in ${country.name}. Find work from home positions at top companies. Average salary: ${avgSalary}. Updated daily.`

// Keywords
keywords: [
  `remote ${category} jobs ${country}`,
  `${category} jobs ${country}`,
  `work from home ${category} ${country}`,
  `${country} remote ${category} positions`
]

// Canonical
canonical: `${siteConfig.url}/jobs/${category.slug}/country/${country.slug}`
```

### 1.6 Structured Data

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "position": 1, "name": "Home", "item": "https://freelanly.com" },
        { "position": 2, "name": "Jobs", "item": "https://freelanly.com/jobs" },
        { "position": 3, "name": "Engineering", "item": "https://freelanly.com/jobs/engineering" },
        { "position": 4, "name": "Germany", "item": "https://freelanly.com/jobs/engineering/country/germany" }
      ]
    },
    {
      "@type": "ItemList",
      "name": "Remote Engineering Jobs in Germany",
      "numberOfItems": 45,
      "itemListElement": [...]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [...]
    }
  ]
}
```

### 1.7 Content Generation Strategy

**Unique content per page (avoid thin content penalty):**

1. **Country-specific intro** (100-150 words):
   - Tech hub status (Berlin, London, Amsterdam)
   - Timezone benefits for US/EU collaboration
   - Remote work culture in that country
   - Visa/legal considerations for remote workers

2. **Salary data** (from Adzuna API or formula):
   - Average salary for category in country
   - Comparison to US salaries
   - Cost of living context

3. **Top companies** (dynamic from DB):
   - Companies with HQ or hiring in that country
   - Link to company pages

4. **Related internal links**:
   - Same category, different countries (5-10 links)
   - Same country, different categories (5-10 links)
   - Category + level combinations

### 1.8 Thin Content Prevention

```typescript
// Rules for indexing
const shouldIndex = (jobs: number, category: string, country: string) => {
  // Must have at least 3 jobs to be indexed
  if (jobs < 3) return false;

  // High-volume combinations always indexed
  const highVolume = ['usa', 'united-kingdom', 'germany', 'canada'];
  if (highVolume.includes(country)) return true;

  // Medium-volume needs 5+ jobs
  if (jobs < 5) return false;

  return true;
};

// If not indexed, show "Related jobs" from:
// 1. Same category, worldwide
// 2. Same country, all categories
```

### 1.9 Internal Linking Strategy

```
From Category Hub (/jobs/engineering):
  → Link to top 10 countries with most jobs
  → "Engineering Jobs by Country" section

From Country Hub (/jobs/country/germany):
  → Link to all categories available in Germany
  → "Browse by Category" section

From Category + Country page:
  → Link to parent category hub
  → Link to parent country hub
  → Link to 3-5 nearby countries (same category)
  → Link to related categories (same country)
```

---

## 2. Category + Salary Pages

### 2.1 Overview

| Metric | Value |
|--------|-------|
| URL Pattern | `/jobs/[category]/salary/[range]` |
| Example | `/jobs/design/salary/100k-150k` |
| Total Pages | 21 categories × 4 ranges = **84 pages** |
| Target Keywords | "high paying remote jobs", "remote jobs 150k" |

### 2.2 Salary Ranges

| Slug | Range | Label |
|------|-------|-------|
| `0-50k` | $0 - $50,000 | Entry Level |
| `50k-100k` | $50,000 - $100,000 | Mid Level |
| `100k-150k` | $100,000 - $150,000 | Senior Level |
| `150k-plus` | $150,000+ | Staff/Principal |

### 2.3 URL Structure

```
/jobs/engineering/salary/0-50k
/jobs/engineering/salary/50k-100k
/jobs/engineering/salary/100k-150k
/jobs/engineering/salary/150k-plus
```

### 2.4 Page Template

```
┌─────────────────────────────────────────────────────────────┐
│ H1: Remote Engineering Jobs $100K-$150K                     │
│ Subtitle: Senior-level positions with competitive salaries  │
├─────────────────────────────────────────────────────────────┤
│ SALARY RANGE TABS                                           │
│ [0-50K] [50K-100K] [100K-150K ←active] [150K+]             │
├─────────────────────────────────────────────────────────────┤
│ JOB LISTINGS (filtered by salary)                           │
├─────────────────────────────────────────────────────────────┤
│ SEO CONTENT                                                 │
│ ├─ What to expect at this salary level                      │
│ ├─ Required experience and skills                           │
│ ├─ Companies offering this range                            │
│ └─ How to negotiate for higher salary                       │
├─────────────────────────────────────────────────────────────┤
│ FAQ SECTION                                                 │
│ ├─ How many $100K+ engineering jobs available?              │
│ ├─ What skills are needed for $100K+ roles?                 │
│ └─ Which companies pay the highest?                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Meta Tags

```typescript
title: `Remote ${category.name} Jobs ${range.label} - High Paying Positions`
// Example: "Remote Engineering Jobs $100K-$150K - High Paying Positions"

description: `Find ${jobCount} remote ${category.name.toLowerCase()} jobs paying ${range.label}. Senior-level positions at top companies. Browse high-paying opportunities now.`
```

### 2.6 Filtering Logic

```typescript
const salaryRanges = {
  '0-50k': { min: 0, max: 50000 },
  '50k-100k': { min: 50000, max: 100000 },
  '100k-150k': { min: 100000, max: 150000 },
  '150k-plus': { min: 150000, max: null },
};

// Query jobs where:
// salaryMin >= range.min AND (salaryMax <= range.max OR range.max is null)
// Only include jobs with salaryIsEstimate = false for accuracy
```

---

## 3. Skills/Technology Pages

### 3.1 Overview

| Metric | Value |
|--------|-------|
| URL Pattern | `/jobs/skills/[skill]` |
| Example | `/jobs/skills/react` |
| Total Pages | **50+ pages** (expandable) |
| Target Keywords | "remote react jobs", "python developer remote" |

### 3.2 Initial Skills List (50)

**Frontend (10):**
react, vue, angular, javascript, typescript, nextjs, tailwind, css, html, svelte

**Backend (10):**
nodejs, python, java, golang, ruby, php, rust, dotnet, scala, elixir

**Data (8):**
sql, postgresql, mongodb, redis, elasticsearch, spark, hadoop, snowflake

**DevOps (8):**
aws, gcp, azure, docker, kubernetes, terraform, jenkins, linux

**Design (5):**
figma, sketch, adobe-xd, photoshop, illustrator

**Other (9):**
salesforce, hubspot, sap, tableau, power-bi, jira, graphql, rest-api, machine-learning

### 3.3 URL Structure

```
/jobs/skills/react
/jobs/skills/python
/jobs/skills/kubernetes
/jobs/skills/figma
```

### 3.4 Search Logic

```typescript
// Search in job title and description
const skillQuery = {
  OR: [
    { title: { contains: skill, mode: 'insensitive' } },
    { description: { contains: skill, mode: 'insensitive' } },
  ],
};

// Skill aliases for better matching
const skillAliases = {
  'react': ['reactjs', 'react.js', 'react js'],
  'nodejs': ['node.js', 'node js', 'node'],
  'golang': ['go lang', 'go language'],
  'dotnet': ['.net', 'c#', 'csharp'],
  'aws': ['amazon web services'],
  'gcp': ['google cloud', 'google cloud platform'],
};
```

### 3.5 Page Template

```
┌─────────────────────────────────────────────────────────────┐
│ H1: Remote React Developer Jobs                             │
│ Subtitle: X positions requiring React skills                │
├─────────────────────────────────────────────────────────────┤
│ SKILL INFO CARD                                             │
│ ├─ What is React?                                           │
│ ├─ Related skills: JavaScript, TypeScript, Next.js          │
│ ├─ Average salary: $120,000                                 │
│ └─ Demand trend: High                                       │
├─────────────────────────────────────────────────────────────┤
│ JOB LISTINGS                                                │
├─────────────────────────────────────────────────────────────┤
│ SEO CONTENT (300-500 words)                                 │
│ ├─ What React developers do                                 │
│ ├─ Skills needed alongside React                            │
│ ├─ Career path for React developers                         │
│ └─ Why companies hire remote React devs                     │
├─────────────────────────────────────────────────────────────┤
│ RELATED SKILLS                                              │
│ [JavaScript] [TypeScript] [Next.js] [Redux] [Node.js]       │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Skill Content Data

Create `/src/config/skill-content.ts`:

```typescript
export interface SkillContent {
  slug: string;
  name: string;
  description: string;
  relatedSkills: string[];
  categories: string[]; // Which job categories use this skill
  averageSalary: number;
  demandLevel: 'low' | 'medium' | 'high' | 'very-high';
  intro: string; // SEO content
}

export const skillContent: Record<string, SkillContent> = {
  react: {
    slug: 'react',
    name: 'React',
    description: 'A JavaScript library for building user interfaces',
    relatedSkills: ['javascript', 'typescript', 'nextjs', 'redux', 'nodejs'],
    categories: ['engineering', 'design'],
    averageSalary: 130000,
    demandLevel: 'very-high',
    intro: 'React developer jobs are among the most sought-after...',
  },
  // ... more skills
};
```

---

## 4. Implementation Checklist

### Phase 2.1: Category + Country (Week 1-2)

- [ ] Create country config file (`/src/config/countries.ts`)
- [ ] Create country content file (`/src/config/country-content.ts`)
- [ ] Create route `/jobs/[category]/country/[country]/page.tsx`
- [ ] Implement job filtering by country
- [ ] Add meta tags with country-specific titles
- [ ] Add structured data (BreadcrumbList, ItemList, FAQPage)
- [ ] Implement thin content check (noindex if < 3 jobs)
- [ ] Add to sitemap.xml
- [ ] Add internal links from category pages
- [ ] Add internal links from country hub pages
- [ ] Test all 630 URL combinations
- [ ] Deploy and verify in GSC

### Phase 2.2: Category + Salary (Week 2)

- [ ] Create salary range config
- [ ] Create route `/jobs/[category]/salary/[range]/page.tsx`
- [ ] Implement salary filtering logic
- [ ] Add meta tags
- [ ] Add structured data
- [ ] Add salary range tabs UI
- [ ] Add to sitemap.xml
- [ ] Add internal links from category pages
- [ ] Test all 84 combinations
- [ ] Deploy

### Phase 2.3: Skills Pages (Week 3)

- [ ] Create skill config file (`/src/config/skills.ts`)
- [ ] Create skill content file (`/src/config/skill-content.ts`)
- [ ] Create route `/jobs/skills/[skill]/page.tsx`
- [ ] Implement skill search logic with aliases
- [ ] Add meta tags
- [ ] Add structured data
- [ ] Add related skills section
- [ ] Add to sitemap.xml
- [ ] Add internal links from job pages
- [ ] Test all 50+ skill pages
- [ ] Deploy

---

## 5. Sitemap Strategy

### Dynamic Sitemap Generation

```typescript
// sitemap.xml structure
<urlset>
  <!-- Category pages -->
  <url><loc>/jobs/engineering</loc><priority>0.9</priority></url>

  <!-- Category + Country (only if jobs >= 3) -->
  <url><loc>/jobs/engineering/country/germany</loc><priority>0.8</priority></url>

  <!-- Category + Salary -->
  <url><loc>/jobs/engineering/salary/100k-150k</loc><priority>0.7</priority></url>

  <!-- Skills -->
  <url><loc>/jobs/skills/react</loc><priority>0.8</priority></url>
</urlset>
```

### Sitemap Limits

- Max 50,000 URLs per sitemap
- Split into multiple sitemaps if needed:
  - `sitemap-categories.xml`
  - `sitemap-countries.xml`
  - `sitemap-skills.xml`
  - `sitemap-jobs.xml`

---

## 6. Monitoring & Success Metrics

### KPIs to Track

| Metric | Current | Target (3mo) | Target (6mo) |
|--------|---------|--------------|--------------|
| Indexed Pages | ~3,000 | ~5,000 | ~10,000 |
| Organic Traffic | ~1,000/mo | ~5,000/mo | ~15,000/mo |
| Ranking Keywords | 5 | 100 | 500 |
| Avg Position | N/A | < 30 | < 15 |

### Monitoring Tools

- Google Search Console (indexing, impressions, clicks)
- Google Analytics (traffic by landing page)
- Ahrefs/Semrush (keyword rankings)
- Custom dashboard (job counts per page type)

### Weekly Checks

1. Check GSC for indexing errors
2. Review pages with 0 jobs (add noindex or redirect)
3. Monitor Core Web Vitals
4. Check sitemap submission status

---

## 7. Technical Requirements

### Database Queries

```sql
-- Jobs by category + country
SELECT * FROM jobs
WHERE category_id = ?
AND country = ?
AND is_active = true
AND posted_at > NOW() - INTERVAL '7 days';

-- Jobs by salary range
SELECT * FROM jobs
WHERE category_id = ?
AND salary_min >= ? AND salary_max <= ?
AND salary_is_estimate = false
AND is_active = true;

-- Jobs by skill
SELECT * FROM jobs
WHERE (title ILIKE '%react%' OR description ILIKE '%react%')
AND is_active = true;
```

### Caching Strategy

```typescript
// ISR revalidation times
export const revalidate = 3600; // 1 hour for programmatic pages

// For pages with dynamic job counts
export const dynamic = 'force-dynamic'; // Only if needed
```

### Performance Targets

- LCP < 2.5s
- CLS < 0.1
- FID < 100ms
- Time to First Byte < 600ms

---

## 8. Risk Mitigation

### Thin Content Risk

**Problem:** Pages with 0-2 jobs provide little value.

**Solution:**
1. Add `noindex` to pages with < 3 jobs
2. Show "Related jobs" from broader category
3. Add substantial static content (market insights)
4. Consolidate low-volume countries into regions

### Duplicate Content Risk

**Problem:** Similar pages may trigger duplicate content issues.

**Solution:**
1. Unique intro paragraphs per country (not templated)
2. Dynamic data (job count, salary, companies)
3. Proper canonical tags
4. Different structured data per page

### Crawl Budget Risk

**Problem:** Too many low-value pages waste crawl budget.

**Solution:**
1. Strict indexing rules (min 3 jobs)
2. robots.txt disallow for empty pages
3. Prioritize high-value pages in sitemap
4. Regular cleanup of stale pages

---

## 9. File Structure

```
src/
├── app/
│   └── jobs/
│       ├── [category]/
│       │   ├── country/
│       │   │   └── [country]/
│       │   │       └── page.tsx      # Category + Country
│       │   └── salary/
│       │       └── [range]/
│       │           └── page.tsx      # Category + Salary
│       └── skills/
│           └── [skill]/
│               └── page.tsx          # Skills pages
├── config/
│   ├── countries.ts                  # Country definitions
│   ├── country-content.ts            # Country SEO content
│   ├── skills.ts                     # Skill definitions
│   └── skill-content.ts              # Skill SEO content
└── lib/
    └── programmatic-seo.ts           # Shared utilities
```

---

## Approval Checklist

Before implementation, confirm:

- [ ] URL structure approved
- [ ] Country list approved (30 countries)
- [ ] Salary ranges approved (4 ranges)
- [ ] Skills list approved (50 skills)
- [ ] Page templates approved
- [ ] Content strategy approved
- [ ] Thin content rules approved
- [ ] Timeline approved

---

## Next Steps After Approval

1. Create config files for countries and skills
2. Implement Category + Country pages first (highest impact)
3. Add to sitemap
4. Deploy and submit to GSC
5. Monitor indexing for 1 week
6. Proceed with Salary and Skills pages
