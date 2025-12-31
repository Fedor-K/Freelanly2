# SEO Improvement Plan

> Created: 2025-12-31
> Based on: SEO audit showing DA 3/100, Technical 84/100

## Phase 1: Quick Wins (Priority: HIGH)

### Technical Fixes
- [x] Increase homepage meta description to 150+ characters (currently 119) ✅ Done: 148 chars
- [x] Verify canonical tags are rendering correctly on all pages ✅ Done
- [x] Check and fix any pages missing canonical tags ✅ Fixed homepage
- [x] Audit meta descriptions on key pages (jobs, categories, companies) ✅ Fixed /companies

### Content Fixes
- [x] Add intro text to category pages (`/jobs/[category]`) - target 300+ words ✅ Done: Created category-content.ts with unique content for all 21 categories
- [x] Add FAQ section to category pages for more content depth ✅ Done: Dynamic FAQs with real data (job count, salary, companies)
- [ ] Ensure all job pages have sufficient description length

---

## Phase 2: Programmatic SEO (Priority: HIGH)

> **Detailed Plan:** See [docs/PROGRAMMATIC_SEO_PLAN.md](docs/PROGRAMMATIC_SEO_PLAN.md)

### Summary: 764+ New Pages

| Type | Pages | URL Pattern | Status |
|------|-------|-------------|--------|
| Category + Country | 630 | `/jobs/[category]/country/[country]` | Planned |
| Category + Salary | 84 | `/jobs/[category]/salary/[range]` | Planned |
| Skills | 50+ | `/jobs/skills/[skill]` | Planned |

### Implementation Status

#### 2.1 Category + Country Pages (630 pages) ✅ DONE
- [x] Create country config (`/src/config/countries.ts`) - 30 countries with metadata
- [x] Create country content (`/src/config/country-content.ts`) - unique SEO content per country
- [x] Create route `/jobs/[category]/country/[country]/page.tsx`
- [x] Add meta tags, structured data, FAQPage schema
- [x] Implement thin content check (noindex if < 3 jobs)
- [x] Add to sitemap.xml (630 URLs added)
- [x] Add internal linking from category pages

#### 2.2 Category + Salary Pages (84 pages)
- [ ] Create route `/jobs/[category]/salary/[range]/page.tsx`
- [ ] Ranges: 0-50k, 50k-100k, 100k-150k, 150k-plus
- [ ] Add salary filtering logic
- [ ] Add meta tags and structured data
- [ ] Add to sitemap.xml

#### 2.3 Skills Pages (50+ pages)
- [ ] Create skill config (`/src/config/skills.ts`)
- [ ] Create skill content (`/src/config/skill-content.ts`)
- [ ] Create route `/jobs/skills/[skill]/page.tsx`
- [ ] Implement skill search with aliases
- [ ] Add meta tags and structured data
- [ ] Add to sitemap.xml

---

## Phase 3: Content Depth (Priority: MEDIUM)

### Category Page Enhancements
For each category page, add:
- [ ] 300+ word intro paragraph about the category
- [ ] "What does a [role] do?" section
- [ ] "Average salary for [role]" section
- [ ] FAQ with 5-10 common questions
- [ ] Related categories links

### Landing Pages
- [ ] `/remote-react-jobs` - dedicated React jobs page (exists, enhance)
- [ ] `/remote-python-jobs` - dedicated Python jobs page (exists, enhance)
- [ ] Create more technology-specific landing pages

### Blog Content Clusters (from audit)
- [ ] "Finding Remote Jobs" cluster (6 posts)
- [ ] "Remote Work Best Practices" cluster (6 posts)
- [ ] "Remote Job Application Process" cluster (6 posts)
- [ ] "Career Development for Remote Workers" cluster (6 posts)

---

## Phase 4: Link Building (Priority: MEDIUM)

### Directory Submissions
- [ ] Submit to Product Hunt
- [ ] Submit to remote job board directories
- [ ] Submit to startup directories (BetaList, etc.)
- [ ] Submit to tech directories

### Content Marketing
- [ ] Guest posts on remote work blogs
- [ ] Create shareable infographics (remote work stats)
- [ ] Publish original research/surveys

### PR & Mentions
- [ ] Reach out to "best remote job boards" listicles
- [ ] HARO responses for remote work topics

---

## Phase 5: Technical Improvements (Priority: LOW)

### Performance
- [ ] Improve Core Web Vitals scores
- [ ] Optimize images (already using Next.js Image)
- [ ] Review and optimize JavaScript bundle

### Structured Data
- [ ] Verify JobPosting schema on all job pages
- [ ] Add Organization schema (done)
- [ ] Add FAQPage schema to category pages
- [ ] Add BreadcrumbList schema (done)

### International SEO
- [ ] Consider hreflang tags if expanding to other languages
- [ ] Country-specific landing pages optimization

---

## Metrics to Track

| Metric | Current | Target (3 months) | Target (6 months) |
|--------|---------|-------------------|-------------------|
| Domain Authority | 3 | 10 | 20 |
| Referring Domains | 70 | 150 | 300 |
| Indexed Pages | ~3,000 | ~5,000 | ~10,000 |
| Organic Traffic | ~1,000/mo | ~5,000/mo | ~15,000/mo |
| Ranking Keywords | 5 | 100 | 500 |

---

## Completed Tasks

### 2025-12-31
- [x] Fixed blog titles to < 60 characters
- [x] Added 301 redirect `/for-interpreters` → `/jobs/translation`
- [x] Added noindex to pagination pages (`?page=`)
- [x] Removed old sitemap from GSC (`sitemap-iblock-13.xml`)
- [x] Increased homepage meta description to 148 characters
- [x] Added canonical tag to homepage
- [x] Fixed /companies meta description (116 → 156 chars)
- [x] Created category-content.ts with unique SEO content for all 21 categories
- [x] Integrated rich category content into /jobs/[category] page:
  - 300+ word intro text per category
  - Key skills and popular tools badges
  - Salary ranges (entry/mid/senior)
  - Career path progression
  - "Why remote" section
  - Dynamic FAQs with real data
- [x] **Phase 2.1: Category + Country pages (630 pages)**
  - Created countries.ts with 30 countries (US, UK, DE, CA, NL, etc.)
  - Created country-content.ts with unique content per country
  - Created /jobs/[category]/country/[country] route
  - Added to sitemap.xml
  - Added internal links from category pages

---

## Notes

- Focus on programmatic SEO first - it's the biggest opportunity
- DA will improve naturally with time and backlinks
- Technical SEO is already good (84/100)
- Homepage word count is fine for a job board - don't stuff it
