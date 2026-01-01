# Freelanly Blog Structure

## Overview

SEO-optimized blog structure based on topic clusters and programmatic SEO approach.
Inspired by RemoteRocketship's hub-and-spoke model with 100+ pages from templates.

## Current State

| Metric | Value |
|--------|-------|
| Published Posts | 4 |
| Categories | 6 |
| Avg. Reading Time | 12 min |
| Top Performing | remote-developer-salaries-2026 (288 views) |

## URL Structure

```
/blog/                                      # Main hub (all posts)
│
├── /remote-work/                           # PILLAR: Remote Work Best Practices
│   ├── /time-management/                   # Cluster: Time management strategies
│   ├── /work-life-balance/                 # Cluster: Work-life balance tips
│   ├── /communication-tools/               # Cluster: Tools for remote teams
│   └── /future-trends-2026/                # Cluster: Future of remote work
│
├── /salaries/                              # PILLAR: Salary Guides Hub
│   ├── /developer-salaries-2026/           # [EXISTS] Developer salary guide
│   ├── /[role]-salary-guide/               # PROGRAMMATIC: 21 role-specific guides
│   └── /by-country/[country]/              # PROGRAMMATIC: Country salary guides
│
├── /interview/                             # PILLAR: Interview Preparation Hub
│   ├── /remote-interview-tips/             # [EXISTS] How to ace remote interview
│   ├── /questions/                         # Hub for interview questions
│   │   ├── /software-engineer/             # PROGRAMMATIC: Role-specific Q&A
│   │   ├── /product-manager/
│   │   ├── /data-analyst/
│   │   └── .../                            # 21 roles total
│   └── /preparation-checklist/             # Cluster: Interview prep guide
│
├── /resume/                                # PILLAR: Resume Tips Hub
│   ├── /software-engineer/                 # PROGRAMMATIC: Role-specific resume
│   ├── /product-manager/
│   └── .../                                # 21 roles total
│
├── /cover-letter/                          # PILLAR: Cover Letter Hub
│   ├── /software-engineer/                 # PROGRAMMATIC: Role-specific letters
│   ├── /product-manager/
│   └── .../                                # 21 roles total
│
├── /tools/                                 # PILLAR: Remote Work Tools
│   └── /setup-guide-2026/                  # [EXISTS] Essential tools guide
│
└── /statistics/                            # PILLAR: Industry Reports
    └── /remote-work-statistics-2026/       # [EXISTS] Statistics report
```

## Content Pillars

### 1. Remote Work Best Practices (NEW)
**Primary Keyword:** remote work best practices (Vol: 250, Diff: 8)

| Cluster Post | Keyword | Volume | Difficulty |
|-------------|---------|--------|------------|
| Work-Life Balance | work-life balance remote work | 30 | 1 |
| Time Management | time management for remote workers | 150 | 8 |
| Future Trends 2026 | future of remote work | 390 | 10 |
| Communication Tools | communication tools for remote teams | 150 | 17 |

### 2. Interview Preparation (EXPAND)
**Primary Keyword:** remote job interview preparation

| Content Type | Approach | Pages |
|-------------|----------|-------|
| General Guide | Manual | 1 |
| Role-Specific Questions | Programmatic | 21 |
| Cultural Fit Questions | Manual | 1 |
| Technical Questions | Manual | 1 |

### 3. Salary Guides (EXPAND)
**Primary Keyword:** remote [role] salary

| Content Type | Approach | Pages |
|-------------|----------|-------|
| Developer Guide | [EXISTS] | 1 |
| Role-Specific Guides | Programmatic | 21 |
| Country Guides | Programmatic | 15 |

### 4. Resume & Cover Letter (NEW)
**Primary Keywords:** remote [role] resume, remote [role] cover letter

| Hub | Programmatic Pages |
|-----|-------------------|
| Resume Tips | 21 (one per role) |
| Cover Letter Examples | 21 (one per role) |

## Programmatic SEO Templates

### Template 1: Interview Questions by Role
**URL Pattern:** `/blog/interview/questions/[role]/`
**Generate for:** 21 job categories

```markdown
# [Role] Interview Questions and Answers

## Overview
Prepare for your remote [role] interview with these common questions...

## Technical Questions
1. [Question 1]
   - What they're looking for: ...
   - Example answer: ...

## Behavioral Questions
[...]

## Remote-Specific Questions
[...]

## FAQ
[FAQPage schema]

## Related
- [Role] Salary Guide
- [Role] Resume Tips
- Browse [Role] Jobs →
```

### Template 2: Salary Guide by Role
**URL Pattern:** `/blog/salaries/[role]-salary-guide/`
**Generate for:** 21 job categories

```markdown
# Remote [Role] Salary Guide 2026

## Overview
Average remote [role] salaries by experience level and location...

## Salary by Level
| Level | USA | Europe | Global |
|-------|-----|--------|--------|
| Entry | $X | €X | $X |
| Mid | $X | €X | $X |
| Senior | $X | €X | $X |

## Salary by Country
[Top 10 countries with salary data]

## How to Negotiate
[...]

## Related
- [Role] Interview Questions
- Browse [Role] Jobs →
```

### Template 3: Resume Tips by Role
**URL Pattern:** `/blog/resume/[role]/`
**Generate for:** 21 job categories

```markdown
# Remote [Role] Resume: Tips and Examples

## Key Skills to Highlight
[Role-specific skills]

## Resume Template
[Downloadable template]

## Examples
[2-3 example sections]

## Common Mistakes
[...]

## Related
- [Role] Cover Letter
- [Role] Interview Questions
- Browse [Role] Jobs →
```

### Template 4: Cover Letter by Role
**URL Pattern:** `/blog/cover-letter/[role]/`
**Generate for:** 21 job categories

```markdown
# Remote [Role] Cover Letter: Tips and Examples

## Structure
1. Opening hook
2. Why this company
3. Relevant experience
4. Remote work skills
5. Call to action

## Example Cover Letter
[Full example]

## Tips for Remote Applications
[...]

## Related
- [Role] Resume Tips
- [Role] Interview Questions
- Browse [Role] Jobs →
```

## 21 Job Categories for Programmatic Content

| # | Category Slug | Display Name |
|---|--------------|--------------|
| 1 | engineering | Software Engineer |
| 2 | design | Product Designer |
| 3 | data | Data Analyst |
| 4 | devops | DevOps Engineer |
| 5 | qa | QA Engineer |
| 6 | security | Security Engineer |
| 7 | product | Product Manager |
| 8 | marketing | Marketing Manager |
| 9 | sales | Sales Representative |
| 10 | finance | Financial Analyst |
| 11 | hr | HR Manager |
| 12 | operations | Operations Manager |
| 13 | legal | Legal Counsel |
| 14 | project-management | Project Manager |
| 15 | writing | Content Writer |
| 16 | translation | Translator |
| 17 | creative | Creative Director |
| 18 | support | Customer Support |
| 19 | education | Education Specialist |
| 20 | research | Research Analyst |
| 21 | consulting | Consultant |

## Implementation Phases

### Phase 1: Quick Wins (Week 1-2)
**Goal:** 5 new posts targeting low-difficulty keywords

| # | Post | Keyword | Vol | Diff | Status |
|---|------|---------|-----|------|--------|
| 1 | Remote Work Best Practices (Pillar) | remote work best practices | 250 | 8 | TODO |
| 2 | Work-Life Balance Remote Work | work-life balance remote work | 30 | 1 | TODO |
| 3 | Time Management Remote Workers | time management for remote workers | 150 | 8 | TODO |
| 4 | Future of Remote Work 2026 | future of remote work | 390 | 10 | TODO |
| 5 | Communication Tools Remote Teams | communication tools for remote teams | 150 | 17 | TODO |

### Phase 2: Programmatic Pages (Week 3-4)
**Goal:** 84 pages from 4 templates

| Template | Pages | Priority |
|----------|-------|----------|
| Interview Questions | 21 | High |
| Salary Guides | 21 | High |
| Resume Tips | 21 | Medium |
| Cover Letter | 21 | Medium |

**Technical Requirements:**
1. Create dynamic routes: `/blog/interview/questions/[role]/page.tsx`
2. Create data files with role-specific content
3. Implement generateStaticParams for SSG
4. Add proper internal linking

### Phase 3: High Competition (Week 5+)
**Goal:** Target high-volume keywords after authority is built

| Post | Keyword | Vol | Diff |
|------|---------|-----|------|
| Best Job Boards Remote Work | best job boards for remote work | 590 | 73 |
| Finding Remote Jobs (Pillar) | finding remote jobs | 2900 | 90 |

## Blog Categories (Database)

### Current Categories
```
salary-guides        # Salary-related content
remote-work-tips     # Remote work advice
career              # Career development
industry-reports    # Statistics and reports
company-spotlights  # Company profiles
digital-nomad       # Location-independent work
```

### New Categories to Add
```
interview           # Interview preparation content
resume              # Resume tips and templates
cover-letter        # Cover letter examples
```

## Internal Linking Strategy

### Every Post Must Have:
1. **Pillar Link** - Link to parent pillar page
2. **Cluster Links** - 2-3 links to related cluster posts
3. **Job CTA** - Link to `/jobs/[category]`
4. **Related Posts** - 3 related articles (fill `relatedPosts` field)

### Link Patterns:
```
Interview Questions → Salary Guide → Resume → Cover Letter → Jobs
         ↓                ↓            ↓           ↓
    [Role] Jobs      [Role] Jobs  [Role] Jobs  [Role] Jobs
```

## Content Requirements

### For Each Post:
- **Length:** Pillar 3000+ words, Cluster 1500-2000 words
- **Structure:** H1 → H2s → H3s (proper hierarchy)
- **FAQ Section:** 5-6 questions with FAQPage schema
- **ToC:** Table of contents with anchor links
- **Meta:** Title ≤60 chars, Description ≤160 chars
- **Images:** OG image (1200x630), in-content images with alt
- **Schema:** Article + BreadcrumbList + FAQPage
- **External Links:** 3-5 authoritative sources (BLS, Stanford, etc.)
- **Internal Links:** 5-10 per post

## Expected Results

| Metric | Current | After Phase 1 | After Phase 2 |
|--------|---------|---------------|---------------|
| Total Posts | 4 | 9 | 93 |
| Indexed Pages | 4 | 9 | 93 |
| Role Coverage | 0% | 0% | 100% |
| Topic Authority | Low | Medium | High |
| Estimated Monthly Traffic | ~500 | ~2,000 | ~10,000 |

## Technical Implementation

### New Files to Create:
```
src/app/blog/
├── interview/
│   └── questions/
│       └── [role]/
│           └── page.tsx          # Programmatic interview questions
├── resume/
│   └── [role]/
│       └── page.tsx              # Programmatic resume tips
├── cover-letter/
│   └── [role]/
│       └── page.tsx              # Programmatic cover letters
└── salaries/
    └── [role]-salary-guide/
        └── page.tsx              # Programmatic salary guides

src/data/blog/
├── interview-questions.ts        # Q&A data by role
├── resume-templates.ts           # Resume content by role
├── cover-letter-templates.ts     # Cover letter content by role
└── salary-data.ts                # Salary data by role
```

### Database Schema (already exists):
```prisma
model BlogPost {
  id              String   @id @default(cuid())
  slug            String   @unique
  title           String
  content         String   @db.Text
  excerpt         String?
  metaTitle       String?
  metaDescription String?
  keywords        String[]
  tableOfContents Json?
  faqItems        Json?
  relatedPosts    String[]  // ← Fill this!
  categorySlug    String
  status          BlogStatus
  // ... other fields
}
```

## Monitoring & KPIs

### Track Weekly:
- Google Search Console impressions & clicks
- Indexed pages count
- Average position for target keywords
- Internal linking coverage

### Target KPIs (3 months):
- 90+ pages indexed
- Top 10 for 5+ low-difficulty keywords
- 5,000+ monthly organic sessions
- 2%+ CTR from search

---

*Last updated: January 2026*
*Owner: Content Team*
