# SEO Landing Pages Implementation Plan

## Database Analysis Summary

### Tables Status

#### Core Tables (Actively Used) ✅
| Table | Purpose | Status |
|-------|---------|--------|
| User, Account, Session, VerificationToken | NextAuth authentication | Active |
| Company | Company profiles | Active |
| Category | 21 job categories | Active |
| Job | Main job listings | Active |
| Application | User job applications | Active (analytics) |
| SavedJob | Saved jobs feature | Active |
| JobAlert, AlertLanguagePair, AlertNotification | Job alert system | Active |
| ImportLog | Import tracking | Active |
| DataSource | Source management | Active |
| SalaryBenchmark | Salary cache | Active |
| Settings | Key-value store | Active |

#### CEO Analytics Tables (Partially Implemented) ⚠️
| Table | Purpose | Status |
|-------|---------|--------|
| DailyMetric | Daily metrics | Has service, no dashboard UI |
| MonthlyTarget | Monthly goals | Has service, no dashboard UI |
| RevenueEvent | Revenue tracking | Integrated with Stripe |
| CEOAlert | Business alerts | Has service, no dashboard UI |

**Recommendation**: Keep these tables - they're being populated and may be used for future CEO dashboard.

#### Unused Tables (Legacy) ❌
| Table | Purpose | Issue |
|-------|---------|-------|
| LandingPage | SEO landing pages | Model exists but NOT used - hardcoded config in `src/app/[landing]/page.tsx` instead |

**Recommendation**: Either remove LandingPage model OR start using it for dynamic landing pages.

### Source Enum Values

#### Implemented ✅
- LINKEDIN (via Apify)
- LEVER (ATS integration)
- REMOTEOK (API)
- WEWORKREMOTELY (scraper)
- HACKERNEWS (Who is Hiring parser)

#### Not Implemented (Placeholders)
- GREENHOUSE, ASHBY, WORKABLE, BAMBOO, SMARTRECRUITERS, WORKDAY
- RSS, MANUAL, SCRAPE
- REMOTIVE, ARBEITNOW, HIMALAYAS, WORKINGNOMADS, INDEED

**Recommendation**: Keep as placeholders for future integrations.

---

## Current SEO Landing Pages Analysis

### Existing Implementation (`src/app/[landing]/page.tsx`)

**URL Pattern**: `/remote-{skill}-jobs` or `/remote-{skill}-jobs-{location}`

**Skills Covered** (35 total):
- Frontend: react, typescript, javascript, vue, angular, nextjs
- Backend: nodejs, python, java, golang, rust, ruby, rails, django, laravel
- Data: postgresql, mongodb, redis, elasticsearch, kafka, spark, machine-learning, data-science
- DevOps: aws, kubernetes, docker, terraform, devops, sre, cloud
- Other: graphql, flutter, swift, kotlin, security, frontend, backend, fullstack, mobile, product-manager, product-designer, ui-ux, figma

**Locations Covered** (7 total):
- usa, europe, uk, germany, canada, australia, worldwide

**SEO Features Present**:
- ✅ Proper metadata (title, description, keywords)
- ✅ Open Graph tags
- ✅ Canonical URLs
- ✅ Schema.org (BreadcrumbList, ItemList, WebPage)
- ✅ FAQ schema for rich snippets
- ✅ Internal linking (related skills, location variants)
- ✅ Pagination with proper URLs
- ✅ SEO content section
- ✅ Static generation with `generateStaticParams`

### Missing Landing Pages

1. **Category Landing Pages** - `/jobs/[category]`
   - `/jobs/engineering`, `/jobs/translation`, `/jobs/marketing`, etc.
   - Currently categories only accessible via filters on /jobs page

2. **Level Landing Pages** - `/jobs/level/[level]`
   - `/jobs/level/senior`, `/jobs/level/junior`, `/jobs/level/entry`
   - High search volume for "remote senior developer jobs"

3. **Country Landing Pages** - `/jobs/country/[country]`
   - `/jobs/country/germany`, `/jobs/country/spain`, etc.
   - More countries than current 7 locations

4. **Translation Language Pair Pages** - `/jobs/translation/[source]-[target]`
   - `/jobs/translation/english-russian`, `/jobs/translation/german-english`
   - Critical for translation category SEO

5. **Combined Filter Pages**
   - `/jobs/engineering/senior/usa`
   - `/jobs/translation/remote/germany`

---

## Implementation Plan

### Phase 1: Remove Legacy Code (Optional)

**Option A**: Remove LandingPage model
```
- Delete LandingPage model from prisma/schema.prisma
- Run prisma db push
```

**Option B**: Use LandingPage model for dynamic pages (recommended)
```
- Keep model, start populating it
- Add admin interface to manage landing pages
- Use DB data instead of hardcoded skillKeywords
```

### Phase 2: Category Landing Pages

**New Route**: `src/app/jobs/[category]/page.tsx`

**URLs Generated**:
- `/jobs/engineering` (21 categories total)
- `/jobs/translation`
- `/jobs/marketing`
- etc.

**Features**:
- Category-specific metadata
- Filter jobs by category
- Show related categories
- Category-specific FAQ
- Schema.org JobListing

### Phase 3: Level Landing Pages

**New Route**: `src/app/jobs/level/[level]/page.tsx`

**URLs Generated**:
- `/jobs/level/senior`
- `/jobs/level/junior`
- `/jobs/level/entry`
- `/jobs/level/mid`
- `/jobs/level/lead`
- `/jobs/level/manager`

**Features**:
- Level-specific content ("What to expect as a Senior developer...")
- Salary benchmarks by level
- Career progression info

### Phase 4: Extended Country Landing Pages

**New Route**: `src/app/jobs/country/[country]/page.tsx`

**URLs Generated** (50+ countries from config):
- `/jobs/country/germany`
- `/jobs/country/spain`
- `/jobs/country/netherlands`
- `/jobs/country/poland`
- etc.

**Features**:
- Country-specific job requirements
- Local salary data
- Timezone info
- Work permit requirements (optional)

### Phase 5: Translation Language Pair Pages

**New Route**: `src/app/jobs/translation/[langPair]/page.tsx`

**URLs Generated**:
- `/jobs/translation/english-russian`
- `/jobs/translation/german-english`
- `/jobs/translation/spanish-english`
- `/jobs/translation/french-english`
- etc.

**Features**:
- Language-specific job matching
- Translation rate benchmarks
- Certification requirements
- Related language pairs

### Phase 6: Combined Filter Pages (Advanced)

**New Route**: `src/app/jobs/[category]/[level]/page.tsx`

**URLs Generated**:
- `/jobs/engineering/senior`
- `/jobs/translation/mid`
- `/jobs/marketing/entry`

**With Location**: `src/app/jobs/[category]/[level]/[country]/page.tsx`
- `/jobs/engineering/senior/germany`

---

## URL Structure Summary

```
/jobs                                    # Main job listing
/jobs/[category]                         # Category landing (21 pages)
/jobs/level/[level]                      # Level landing (9 pages)
/jobs/country/[country]                  # Country landing (50+ pages)
/jobs/translation/[source]-[target]      # Language pair (100+ pages)
/jobs/[category]/[level]                 # Category + Level (189 pages)
/jobs/[category]/[level]/[country]       # Full combination (9000+ pages)

/remote-[skill]-jobs                     # Existing skill landing (35 pages)
/remote-[skill]-jobs-[location]          # Existing skill+location (245 pages)
```

---

## Technical Implementation Details

### Shared Components to Create
1. `LandingPageLayout` - Common layout for all landing pages
2. `LandingPageHero` - Consistent hero section
3. `LandingPageSidebar` - Filter navigation
4. `LandingPageFAQ` - Dynamic FAQ generator
5. `LandingPageSchema` - Schema.org generator

### SEO Requirements Checklist
- [ ] Unique title for each page (max 60 chars)
- [ ] Unique meta description (max 155 chars)
- [ ] Canonical URL
- [ ] Open Graph tags
- [ ] Schema.org JobPosting for listings
- [ ] BreadcrumbList schema
- [ ] FAQPage schema
- [ ] Internal linking to related pages
- [ ] Pagination with rel="next/prev"
- [ ] Hreflang (if multi-language support needed)

### Sitemap Updates
- Add all new landing page URLs to sitemap
- Update `src/app/sitemap.ts`
- Ensure proper lastmod dates

---

## Estimated Page Counts

| Type | Count |
|------|-------|
| Category pages | 21 |
| Level pages | 9 |
| Country pages | 50 |
| Language pair pages | 100+ |
| Category + Level | 189 |
| Skill pages (existing) | 35 |
| Skill + Location (existing) | 245 |
| **Total** | **650+** |

---

## Priority Order

1. **High Priority** (most search volume):
   - Category landing pages (`/jobs/[category]`)
   - Translation language pair pages (`/jobs/translation/[source]-[target]`)

2. **Medium Priority**:
   - Level landing pages (`/jobs/level/[level]`)
   - Country landing pages (`/jobs/country/[country]`)

3. **Lower Priority**:
   - Combined filter pages (can wait, complex)

---

## Questions for Confirmation

1. Should we remove the unused `LandingPage` model or start using it?
2. Priority order - start with categories or translation language pairs?
3. Do we need the combined filter pages (`/jobs/engineering/senior/germany`) now or later?
4. Should country pages use ISO codes (`/jobs/country/de`) or full names (`/jobs/country/germany`)?
5. Keep CEO analytics tables (DailyMetric, etc.) or remove them?

---

## Ready to Implement

After confirmation, I will:
1. Clean up legacy code (if approved)
2. Create shared landing page components
3. Implement category landing pages
4. Implement translation language pair pages
5. Update sitemap
6. Test SEO markup with Google Rich Results Test
