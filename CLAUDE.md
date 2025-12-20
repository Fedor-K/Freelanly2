# Freelanly 2.0 — Project Context

## Quick Summary

SEO-оптимизированная платформа для поиска удалённых вакансий. Агрегация из LinkedIn (Apify) и ATS (Lever). AI extraction через DeepSeek.

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- PostgreSQL (Neon) + Prisma 5
- DeepSeek API (extraction + categorization)
- Apify (LinkedIn scraping)
- Apollo.io (company enrichment)

## Key Architecture Decisions

### 21 Job Categories
```
Tech: engineering, design, data, devops, qa, security
Business: product, marketing, sales, finance, hr, operations, legal, project-management
Content: writing, translation, creative
Other: support, education, research, consulting
```

### Job Categorization
- AI classification via DeepSeek with full category list
- Local keyword fallback if AI fails
- Default category: `support` (NOT engineering!)
- File: `src/lib/deepseek.ts` → `classifyJobCategory()`

### Deduplication
- **Companies**: Search by slug OR name (case-insensitive), normalize name
- **Jobs**: Check by sourceId/URL, then by title+company (case-insensitive)
- Files: `src/services/linkedin-processor.ts`, `src/services/sources/lever-processor.ts`

### Job Freshness
- 30-day max age (Google recommendation)
- `src/lib/utils.ts` → `MAX_JOB_AGE_DAYS`, `getMaxJobAgeDate()`

### Filters (/jobs page)
- URL-based state: `?q=search&level=SENIOR&type=FULL_TIME`
- Server Component implementation
- File: `src/app/jobs/page.tsx`

### Breadcrumbs
- Follow URL structure, NOT navigation path
- Job page: `Home / Company / Job Title`
- Industry standard approach

### Privacy Filter
- Only jobs with corporate email (filter gmail, yahoo, etc.)
- `src/lib/utils.ts` → `isFreeEmail()`

### Salary Insights
Real market salary data displayed on job detail pages.

**Data Sources (priority order):**
1. **US jobs** → BLS API (Bureau of Labor Statistics)
   - 40+ SOC occupation code mappings
   - Official government salary data
2. **International** → Adzuna API (19 countries)
   - UK, DE, FR, AU, NL, AT, BE, BR, CA, IN, IT, MX, NZ, PL, RU, SG, ZA, ES, CH
   - Histogram-based salary data with currency conversion
3. **Other countries** → Coefficient-based estimation
   - 50+ countries with coefficients relative to US (1.0)
   - File: `src/config/salary-coefficients.ts`
4. **Fallback** → Calculate from similar jobs in DB

**Caching:**
- 30 days in `SalaryBenchmark` table
- Unique key: `jobTitle + country + region`

**Component displays:**
- Market range visualization (min-max with percentiles)
- Average salary
- Sample size (when available)
- Source badge (BLS/Adzuna/Estimated)
- "This job" position comparison

**Files:**
- `src/lib/bls.ts` — BLS API client
- `src/lib/adzuna.ts` — Adzuna API client
- `src/config/salary-coefficients.ts` — Country coefficients
- `src/services/salary-insights.ts` — Main orchestration service
- `src/components/jobs/SalaryInsights.tsx` — UI component

**Environment variables:**
```
BLS_API_KEY=xxx
ADZUNA_APP_ID=xxx
ADZUNA_APP_KEY=xxx
```

## Important Files

```
src/
├── app/jobs/page.tsx              # Jobs with working filters
├── app/company/[slug]/jobs/[job]/page.tsx  # Job detail + Apply Now
├── lib/deepseek.ts                # AI extraction + categorization (21 cats)
├── lib/utils.ts                   # Freshness, slugify, free email check
├── lib/bls.ts                     # BLS API client (US salary data)
├── lib/adzuna.ts                  # Adzuna API client (international salary)
├── services/linkedin-processor.ts # LinkedIn → Job (with dedup)
├── services/sources/lever-processor.ts  # Lever ATS processor
├── services/company-enrichment.ts # Apollo.io enrichment
├── services/salary-insights.ts    # Salary market data service
├── config/site.ts                 # Categories, levels, countries config
├── config/salary-coefficients.ts  # Country salary coefficients
├── components/jobs/SalaryInsights.tsx  # Salary insights component

scripts/
├── cleanup-duplicate-companies.ts # Merge duplicate companies
├── cleanup-duplicate-jobs.ts      # Remove duplicate jobs
├── recategorize-jobs.ts           # Fix miscategorized jobs
├── fix-mistral-company.ts         # Fix company via Apollo enrichment
├── merge-mistral-companies.ts     # Merge duplicate companies
├── reenrich-mistral.ts            # Re-enrich company from Apollo
├── create-salary-benchmark-table.sql # Manual SQL for SalaryBenchmark table
├── debug-salary-calculation.ts    # Debug salary calculation sources
```

## Common Tasks

### Run LinkedIn import
```bash
curl -X POST http://localhost:3000/api/cron/fetch-linkedin \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Cleanup duplicates
```bash
npx tsx scripts/cleanup-duplicate-companies.ts
npx tsx scripts/cleanup-duplicate-jobs.ts
```

### Fix categories
```bash
npx tsx scripts/recategorize-jobs.ts
```

### Add Lever source
Admin → Sources → Add New → LEVER → company-slug → Save & Run

### Fix wrong company enrichment
If Apollo enriched company with wrong data (e.g., bakery instead of AI company):
```bash
# 1. Create script to re-enrich with correct domain
cat > scripts/fix-company.ts << 'EOF'
import { prisma } from '../src/lib/db';
import { enrichCompanyByDomain } from '../src/services/company-enrichment';

async function main() {
  const company = await prisma.company.findFirst({
    where: { slug: 'company-slug' }
  });
  if (!company) return;

  // Reset logo to trigger re-enrichment
  await prisma.company.update({
    where: { id: company.id },
    data: { logo: null }
  });

  // Enrich with correct domain
  await enrichCompanyByDomain(company.id, 'correct-domain.com');
}
main().catch(console.error).finally(() => prisma.$disconnect());
EOF
npx tsx scripts/fix-company.ts
```

### Merge duplicate companies
```bash
npx tsx scripts/merge-mistral-companies.ts
# Or create custom merge script for specific companies
```

### Database operations
```bash
# Seed categories (required after DB reset!)
npm run db:seed

# Push schema changes
npx prisma db push

# DANGEROUS: Reset database (deletes ALL data!)
npx prisma db push --force-reset
```

## Recent Changes (Dec 2024)

1. **Fixed company duplicates** — search by slug OR name
2. **Fixed job duplicates** — check title+company before creating
3. **Fixed text overflow** — `break-words overflow-hidden` on post content
4. **Simplified breadcrumbs** — `Home / Company / Job Title`
5. **Working job filters** — search, level, type via URL params
6. **Fixed categorization** — 21 categories, AI + fallback, default=support
7. **Updated README** — comprehensive system documentation
8. **Salary Insights** — real market data from BLS (US) + Adzuna (international)
9. **Salary period extraction** — DeepSeek now extracts salaryPeriod (HOUR/DAY/WEEK/MONTH/YEAR/ONE_TIME)
10. **Salary Insights for annual only** — hidden for hourly/daily/weekly jobs (meaningless comparison)
11. **Calculation tooltip** — hover on "Estimated for [country]" shows formula breakdown
12. **Adzuna validation** — skip data if avgSalary < $1000 or sampleSize < 1
13. **DB salary filter** — MIN_ANNUAL_SALARY = $10000 to filter out hourly rates stored incorrectly
14. **Graceful error handling** — SalaryBenchmark table missing doesn't crash the app

## Code Patterns

### Adding new category
1. Add to `src/config/site.ts` → `categories`
2. Add to `src/lib/deepseek.ts` → `classifyJobCategory()` prompt + `localClassifyJob()`
3. Add to `src/services/sources/lever-processor.ts` → `mapDepartmentToCategory()`
4. Run `npm run db:seed` to create in DB

### Adding new job source
1. Create processor in `src/services/sources/`
2. Add source type to `prisma/schema.prisma` → `Source` enum
3. Add handler in `src/app/api/admin/sources/[id]/run/route.ts`

## Notes

- Всегда проверяй дубли перед созданием company/job
- Категоризация должна быть точной — не всё engineering!
- Фильтры на /jobs работают через URL params
- Breadcrumbs = URL structure, не путь навигации

## ⚠️ Important Warnings

1. **NEVER use `prisma db push --force-reset`** without understanding it deletes ALL data!
2. After DB reset, must run `npm run db:seed` to restore categories
3. Apollo enrichment can match wrong company (e.g., "Mistral" → bakery instead of AI)
4. Salary Insights only shown for annual salaries (YEAR period)
5. Server runs on `/opt/freelanly2` with PM2 process `freelanly`

## Server Commands (Production)

```bash
# SSH to server
ssh root@198.12.73.168

# App location
cd /opt/freelanly2

# Restart app
pm2 restart freelanly

# View logs
pm2 logs freelanly --lines 50

# Rebuild after code changes
git pull && npm run build && pm2 restart freelanly
```
