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
- [ ] Add intro text to category pages (`/jobs/[category]`) - target 300+ words
- [ ] Add FAQ section to category pages for more content depth
- [ ] Ensure all job pages have sufficient description length

---

## Phase 2: Programmatic SEO (Priority: HIGH)

### New Page Templates to Create

#### 2.1 Category + Country Pages
**URL Pattern:** `/jobs/[category]/country/[country]`
**Example:** `/jobs/engineering/country/germany` → "Remote Engineering Jobs in Germany"
**Potential pages:** ~20 categories × 30 countries = 600 pages

- [ ] Create route `/jobs/[category]/country/[country]/page.tsx`
- [ ] Add proper meta tags with location-specific titles
- [ ] Add to sitemap
- [ ] Internal linking from category and country pages

#### 2.2 Category + Salary Range Pages
**URL Pattern:** `/jobs/[category]/salary/[range]`
**Example:** `/jobs/design/salary/50k-100k` → "Remote Design Jobs $50K-$100K"
**Ranges:** 0-50k, 50k-100k, 100k-150k, 150k+

- [ ] Create route `/jobs/[category]/salary/[range]/page.tsx`
- [ ] Filter jobs by salary range
- [ ] Add proper meta tags
- [ ] Add to sitemap

#### 2.3 Skills/Technology Pages
**URL Pattern:** `/jobs/skills/[skill]`
**Example:** `/jobs/skills/react` → "Remote React Developer Jobs"
**Top skills:** React, Python, Node.js, AWS, TypeScript, etc.

- [ ] Create route `/jobs/skills/[skill]/page.tsx`
- [ ] Extract and index job skills
- [ ] Add to sitemap
- [ ] Internal linking from job pages

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

---

## Notes

- Focus on programmatic SEO first - it's the biggest opportunity
- DA will improve naturally with time and backlinks
- Technical SEO is already good (84/100)
- Homepage word count is fine for a job board - don't stuff it
