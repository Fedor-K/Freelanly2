# Freelanly 2.0 — Project Context

## Quick Summary

SEO-оптимизированная платформа для поиска удалённых вакансий. Агрегация из LinkedIn (Apify), ATS (Lever), RemoteOK, WeWorkRemotely, HackerNews. AI extraction через DeepSeek.

**Автоматизация:**
- Daily cron at 6:00 UTC: fetches all sources
- Daily cron at 7:00 UTC: sends job alert notifications
- n8n workflow: scrapes LinkedIn posts every 15-20 min via Apify
- Auto cleanup: removes jobs older than 30 days after each import
- Company enrichment via Apollo.io

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- PostgreSQL (Neon) + Prisma 5
- DeepSeek API (extraction + categorization)
- Apify (LinkedIn scraping)
- Apollo.io (company enrichment)
- NextAuth v5 (authentication)
- DashaMail (transactional emails)
- Stripe (subscription payments)

## Authentication & User Dashboard

### Auth Setup (NextAuth v5)
- **Providers**: Google OAuth + Magic Link (via DashaMail)
- **Session**: Database strategy, 30-day lifetime
- **Protected routes**: `/dashboard/*` via middleware

**Files:**
- `src/lib/auth.ts` — NextAuth configuration
- `src/lib/auth-email.ts` — Magic Link email sender
- `src/middleware.ts` — Route protection
- `src/components/auth/SignInForm.tsx` — Login form
- `src/components/auth/UserMenu.tsx` — Header user menu

**Environment variables:**
```
AUTH_SECRET=xxx  # Generate: openssl rand -base64 32
AUTH_URL=https://freelanly.com
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

### User Plans & Stripe Integration
| Feature | FREE | PRO |
|---------|------|-----|
| Job views | Unlimited | Unlimited |
| Saved jobs | Unlimited | Unlimited |
| Salary insights | Average only | Full (range, percentiles, source) |
| INSTANT alerts | Yes | Yes |
| Apply to jobs | Limited | Unlimited |

**Pricing (EUR):**
| Plan | Price | Trial |
|------|-------|-------|
| Weekly | €10/week | No trial |
| Monthly | €20/month | 7-day trial |
| Annual | €192/year | 7-day trial (save 20%) |

**Stripe Price IDs:**
```
WEEKLY:  price_1Sh8hVKHJU6KLxM3W75Rystk
MONTHLY: price_1S3HO0KHJU6KLxM30Jgoqizh
ANNUAL:  price_1Sh8fcKHJU6KLxM3lCvLduFe
```

**Stripe Files:**
- `src/lib/stripe.ts` — Stripe client, price config, checkout/portal helpers
- `src/app/api/stripe/checkout/route.ts` — Create checkout session
- `src/app/api/stripe/webhook/route.ts` — Handle Stripe events
- `src/app/api/stripe/portal/route.ts` — Customer portal session
- `src/app/pricing/page.tsx` — Pricing page
- `src/app/pricing/PricingCards.tsx` — Checkout flow component

**Webhook events handled:**
- `checkout.session.completed` — Upgrade user to PRO
- `customer.subscription.created/updated` — Sync subscription status
- `customer.subscription.deleted` — Downgrade to FREE
- `invoice.paid` — Record revenue event
- `invoice.payment_failed` — Log failed payment

**Environment variables:**
```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

**Configure Stripe webhook:**
- URL: `https://freelanly.com/api/stripe/webhook`
- Events: checkout.session.completed, customer.subscription.*, invoice.*

### Dashboard Pages
```
/dashboard              — Overview, stats
/dashboard/saved        — Saved jobs
/dashboard/applications — Application tracking (TODO)
/dashboard/alerts       — Job alerts management
/dashboard/settings     — Profile settings
```

### Job Alerts for Translators
Специальные фильтры для языковых профессий с поддержкой множественных языковых пар.

**Translation Types:**
- WRITTEN, INTERPRETATION, LOCALIZATION, EDITING
- TRANSCRIPTION, SUBTITLING, MT_POST_EDITING, COPYWRITING

**Language Pairs Model:**
```prisma
model AlertLanguagePair {
  id              String   @id @default(cuid())
  jobAlert        JobAlert @relation(...)
  translationType String   // WRITTEN, INTERPRETATION, etc.
  sourceLanguage  String   // ISO 639-1: EN, RU, DE
  targetLanguage  String   // ISO 639-1: RU, EN, DE
}
```

**Files:**
- `src/app/dashboard/alerts/AlertsList.tsx` — UI for managing alerts
- `src/app/api/user/alerts/route.ts` — CRUD endpoints
- `prisma/schema.prisma` — JobAlert, AlertLanguagePair models

### Email Notifications for Job Alerts
Автоматическая рассылка уведомлений о новых вакансиях.

**Matching Criteria:**
- Category (optional)
- Keywords (comma-separated, searches title + description)
- Country (optional)
- Level (optional)
- Language Pairs (for translation category)

**Frequencies:**
- INSTANT — sends immediately after job is created (integrated with job creation)
- DAILY — 7:00 UTC (cron)
- WEEKLY — Monday 7:00 UTC (TODO: separate cron)

**INSTANT alerts implementation:**
- `sendInstantAlertsForJob(jobId)` in `src/services/alert-notifications.ts`
- Called after job creation in:
  - `/api/webhooks/linkedin-posts` (n8n real-time)
  - `linkedin-processor.ts` (batch import)
- Checks job against all active INSTANT alerts
- Sends email if criteria match (category, keywords, country, level, language pairs)
- Uses AlertNotification to prevent duplicates

**Duplicate Prevention:**
- AlertNotification model tracks sent job+alert pairs
- Jobs are marked as sent after successful email delivery

**Files:**
- `src/services/alert-matcher.ts` — Matches jobs to alerts
- `src/services/alert-notifications.ts` — Email generation and sending
- `src/app/api/cron/send-alerts/route.ts` — Cron endpoint

**Manual trigger:**
```bash
curl -X POST "http://localhost:3000/api/cron/send-alerts?frequency=DAILY" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## n8n LinkedIn Posts Integration

Отдельный workflow в n8n для real-time скрапинга LinkedIn постов.

**Workflow:**
1. Schedule Trigger (every 15-20 min)
2. Rotator API (ротация ключевых слов)
3. Apify Actor `harvestapi~linkedin-post-search`
4. Get Dataset Items
5. Send to Freelanly webhook (parallel to both servers)

**Webhook endpoint:** `/api/webhooks/linkedin-posts`

**Supported field formats:**
- n8n mapped: `postUrl`, `postContent`, `author.linkedinUrl`
- Raw Apify: `linkedinUrl`, `content`, `author.linkedinUrl`

**Filtering:**
- `no_title` — DeepSeek не смог извлечь title (не вакансия)
- `no_corporate_email` — нет корпоративного email
- `similar_job_exists` — fuzzy дубликат (см. ниже)
- `duplicate` — точный дубликат по sourceUrl

**Files:**
- `src/app/api/webhooks/linkedin-posts/route.ts` — webhook handler

**Environment variables:**
```
N8N_WEBHOOK_SECRET=xxx  # или APIFY_WEBHOOK_SECRET
```

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
- **Fuzzy dedup**: Same email domain + similar title (60%+ Jaccard similarity) = duplicate
- Files: `src/services/linkedin-processor.ts`, `src/services/sources/lever-processor.ts`
- Fuzzy dedup: `src/app/api/webhooks/linkedin-posts/route.ts` → `findSimilarJobByEmailDomain()`

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

### Company Logo Fallback
When Apollo.io doesn't find a logo, fallback to Logo.dev API (former Clearbit).

**Priority:**
1. Apollo logo (from enrichment)
2. Logo.dev API (`img.logo.dev/DOMAIN?token=TOKEN`) - high quality company logos
3. Placeholder with first letter of company name

**Logo.dev credentials:**
```
Publishable key: pk_A6k2yPZ4T6y5MZrbuUd9yA (safe to share, used in frontend)
Secret key: sk_S3uVup8yTSaIFQ_dz0khiA (server-side only)
```

**Files:**
- `src/lib/company-logo.ts` — `getCompanyLogoUrl()`, `getLogoDevUrl()` utilities
- `src/components/ui/CompanyLogo.tsx` — Reusable component with error handling

**Usage:**
```tsx
<CompanyLogo
  name={company.name}
  logo={company.logo}
  website={company.website}
  size="md"  // sm, md, lg, xl
/>
```

### Salary Display
Job cards and listings show salary with proper currency and period.

**Format:**
- Full format: `PKR 50,000 - PKR 100,000/mo`
- Compact format (Similar Jobs): `PKR 50K-100K/mo`

**Period suffixes:**
- HOUR → `/hr`
- DAY → `/day`
- WEEK → `/wk`
- MONTH → `/mo`
- YEAR → `/yr`
- ONE_TIME → (no suffix)

**Files:**
- `src/components/jobs/JobCard.tsx` — `formatSalary()`, `formatSalaryPeriod()`
- `src/app/company/[companySlug]/jobs/[jobSlug]/page.tsx` — `formatSalaryCompact()` for Similar Jobs
- `src/types/index.ts` — `JobCardData` includes `salaryPeriod`

### Salary Insights
Real market salary data displayed on job detail pages.

**Data Sources (priority order):**
1. **Cache** — 30 days in `SalaryBenchmark` table
2. **US jobs** → BLS API (Bureau of Labor Statistics)
   - 40+ SOC occupation code mappings
   - Official government salary data
3. **International** → Adzuna API (19 countries)
   - UK, DE, FR, AU, NL, AT, BE, BR, CA, IN, IT, MX, NZ, PL, RU, SG, ZA, ES, CH
4. **Formula-based estimation** (primary fallback):
   ```
   Annual Salary = BaseSalary[category] × LevelMultiplier[level] × CountryCoefficient[country]
   ```

**Formula Components:**
- **Base salaries** (`src/config/salary-base.ts`): 21 categories, $60K-$130K range
  - Engineering: $120K, DevOps: $130K, Product: $130K, QA: $121K
  - Writing: $70K, Translation: $60K, Support: $60K
- **Level multipliers** (`src/config/salary-coefficients.ts`):
  - Intern: 0.30, Entry: 0.50, Junior: 0.65, Mid: 1.00
  - Senior: 1.30, Lead: 1.50, Manager: 1.60, Director: 2.00, Executive: 2.80
- **Country coefficients** (50+ countries):
  - US: 1.00, Switzerland: 0.88, UK: 0.75, Germany: 0.70
  - Poland: 0.35, Brazil: 0.28, India: 0.20, Pakistan: 0.18

**Example calculation:**
```
Senior Engineer in Germany:
$120,000 × 1.30 × 0.70 = $109,200/yr
```

**Component displays:**
- Market range visualization (min-max with percentiles)
- Average salary
- Sample size (when available)
- Source badge (BLS/Adzuna/Estimated)
- "This job" position comparison

**FREE vs PRO restrictions:**
- FREE users: see average salary only, blurred preview of full data
- PRO users: see full range, percentiles, source, sample size
- Component accepts `userPlan` prop ('FREE' | 'PRO' | 'ENTERPRISE')

**Files:**
- `src/lib/bls.ts` — BLS API client
- `src/lib/adzuna.ts` — Adzuna API client
- `src/config/salary-base.ts` — Base salaries by category (NEW)
- `src/config/salary-coefficients.ts` — Level multipliers + country coefficients
- `src/services/salary-insights.ts` — Main orchestration service
- `src/components/jobs/SalaryInsights.tsx` — UI component

**Clear salary cache (if needed):**
```bash
npx prisma db execute --stdin <<< "TRUNCATE TABLE \"SalaryBenchmark\";"
```

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
├── app/api/cron/fetch-sources/route.ts    # Daily ATS cron endpoint
├── app/api/cron/fetch-linkedin/route.ts   # LinkedIn cron endpoint
├── app/api/cron/send-alerts/route.ts      # Job alert notifications cron
├── app/api/webhooks/linkedin-posts/route.ts # n8n webhook for individual posts
├── lib/deepseek.ts                # AI extraction + categorization (21 cats)
├── lib/utils.ts                   # Freshness, slugify, free email check
├── lib/bls.ts                     # BLS API client (US salary data)
├── lib/adzuna.ts                  # Adzuna API client (international salary)
├── services/linkedin-processor.ts # LinkedIn → Job (with dedup)
├── services/job-cleanup.ts        # Auto cleanup old jobs (30 days)
├── services/company-enrichment.ts # Apollo.io enrichment
├── services/salary-insights.ts    # Salary market data service
├── services/alert-matcher.ts      # Match jobs to user alerts
├── services/alert-notifications.ts # Send job alert emails
├── services/sources/
│   ├── index.ts                   # Source orchestration + processAllSources()
│   ├── lever-processor.ts         # Lever ATS processor
│   ├── remoteok-processor.ts      # RemoteOK processor
│   ├── weworkremotely-processor.ts # WeWorkRemotely processor
│   ├── hackernews-processor.ts    # HackerNews Who is Hiring processor
│   └── types.ts                   # Shared types
├── config/site.ts                 # Categories, levels, countries config
├── config/salary-base.ts          # Base salaries by category ($60K-$130K)
├── config/salary-coefficients.ts  # Level multipliers + country coefficients
├── components/jobs/SalaryInsights.tsx  # Salary insights component
├── lib/auth.ts                    # NextAuth configuration
├── lib/auth-email.ts              # Magic Link email sender
├── middleware.ts                  # Route protection
├── app/auth/signin/page.tsx       # Sign in page
├── app/dashboard/
│   ├── page.tsx                   # Dashboard overview
│   ├── layout.tsx                 # Dashboard layout (Header/Footer)
│   ├── saved/page.tsx             # Saved jobs
│   ├── alerts/
│   │   ├── page.tsx               # Alerts page
│   │   └── AlertsList.tsx         # Alerts management component
│   └── settings/page.tsx          # User settings
├── components/auth/UserMenu.tsx   # Header user menu
├── components/auth/SignInForm.tsx # Login form component
├── components/jobs/SaveJobButton.tsx # Save/unsave job button
├── app/api/user/
│   ├── alerts/route.ts            # Job alerts CRUD
│   ├── alerts/[id]/route.ts       # Single alert operations
│   └── settings/route.ts          # User settings
├── app/api/jobs/[id]/save/route.ts # Save/unsave job endpoint
├── app/api/stripe/
│   ├── checkout/route.ts          # Create Stripe checkout session
│   ├── webhook/route.ts           # Handle Stripe webhook events
│   └── portal/route.ts            # Customer portal session
├── app/pricing/
│   ├── page.tsx                   # Pricing page
│   └── PricingCards.tsx           # Checkout flow component
├── lib/stripe.ts                  # Stripe client and helpers
├── lib/company-logo.ts            # Logo URL with Google Favicon fallback
├── components/ui/CompanyLogo.tsx  # Company logo component

scripts/
├── cleanup-duplicate-companies.ts # Merge duplicate companies
├── cleanup-duplicate-jobs.ts      # Remove duplicate jobs
├── recategorize-jobs.ts           # Fix miscategorized jobs
├── reextract-salaries.ts          # Re-extract salaries from job descriptions
├── cleanup-now.ts                 # One-time cleanup of old jobs
```

## Common Tasks

### Run all ATS sources (Lever, RemoteOK, WWR, HN)
```bash
curl -X POST http://localhost:3000/api/cron/fetch-sources \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Run LinkedIn import only
```bash
curl -X POST http://localhost:3000/api/cron/fetch-linkedin \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Send job alert notifications
```bash
# DAILY alerts
curl -X POST "http://localhost:3000/api/cron/send-alerts?frequency=DAILY" \
  -H "Authorization: Bearer $CRON_SECRET"

# WEEKLY alerts
curl -X POST "http://localhost:3000/api/cron/send-alerts?frequency=WEEKLY" \
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
15. **Real salary display** — show actual salary from job posting when available (not just market estimates)
16. **Auto job cleanup** — automatic deletion of jobs older than 30 days after each import
17. **Multiple ATS sources** — added RemoteOK, WeWorkRemotely, HackerNews processors
18. **Daily cron job** — all sources run automatically at 6:00 UTC
19. **Salary re-extraction** — script to re-extract salaries from existing job descriptions
20. **Authentication system** — NextAuth v5 with Google OAuth + Magic Link
21. **User Dashboard** — `/dashboard` with saved jobs, applications, alerts tracking
22. **User Menu** — header dropdown with profile, settings, logout
23. **Saved Jobs** — save/unsave jobs with SaveJobButton component
24. **Job Alerts** — create alerts by category, keywords, country, level
25. **Translation-specific alerts** — support for translation types + language pairs
26. **Multiple language pairs** — AlertLanguagePair model for complex translator needs
27. **Dashboard layout** — shared Header and Footer across all dashboard pages
28. **User settings** — profile settings page with email preferences
29. **Email notifications** — automated job alert emails via DashaMail
30. **Alert matching** — matches jobs by category, keywords, country, level, language pairs
31. **Daily alert cron** — runs at 7:00 UTC, sends DAILY frequency alerts
32. **n8n webhook integration** — `/api/webhooks/linkedin-posts` for real-time LinkedIn scraping
33. **Fuzzy deduplication** — same email domain + 60%+ title similarity = duplicate
34. **Stripe payments** — subscription plans (Weekly €10, Monthly €20, Annual €192)
35. **Google Favicon fallback** — `CompanyLogo` component with Apollo → Favicon → Placeholder
36. **INSTANT job alerts** — sends email immediately when matching job is created
37. **Salary insights restrictions** — FREE users see average only, PRO sees full data
38. **Logo.dev integration** — switched from Google Favicon to Logo.dev (former Clearbit) for higher quality logos
39. **Salary currency & period** — job cards now show proper currency (PKR, EUR, etc.) and period (/mo, /yr)
40. **salaryPeriod in JobCardData** — added to type definition for proper salary display
41. **Similar Jobs salary fix** — shows correct currency and period instead of hardcoded $...K format
42. **Research-based salary formula** — `BaseSalary × Level × Country` with data from Levels.fyi, Glassdoor
43. **salary-base.ts** — base salaries for 21 categories (Writing $70K, Engineering $120K, etc.)
44. **Level multipliers** — Intern 0.30x to Executive 2.80x
45. **Updated country coefficients** — Switzerland 0.88, UK 0.75, Pakistan 0.18, etc.
46. **Removed DB keyword matching** — was producing inflated salaries ($157K for Copy Lead instead of $105K)

## Code Patterns

### Adding new category
1. Add to `src/config/site.ts` → `categories`
2. Add to `src/lib/deepseek.ts` → `classifyJobCategory()` prompt + `localClassifyJob()`
3. Add to `src/services/sources/lever-processor.ts` → `mapDepartmentToCategory()`
4. Run `npm run db:seed` to create in DB

### Adding new job source
1. Create processor in `src/services/sources/`
2. Add source type to `prisma/schema.prisma` → `Source` enum
3. Register processor in `src/services/sources/index.ts` → `SOURCE_PROCESSORS`
4. Import and call `cleanupOldJobs()` at the end of processor
5. Run `npx prisma db push` to update schema

### Job Cleanup Integration
All processors should call cleanup after successful import:
```typescript
import { cleanupOldJobs } from '@/services/job-cleanup';

// At the end of processor function:
await cleanupOldJobs();
```

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
6. **Cron jobs run at 6:00 and 7:00 UTC** — sources fetch at 6:00, alerts send at 7:00
7. **Jobs auto-deleted after 30 days** — this is intentional, not a bug
8. **Check cron logs** — `tail -f /var/log/freelanly-cron.log` for debugging

## Server Commands (Production)

```bash
# SSH to server
ssh root@198.12.73.168

# App location
cd /opt/freelanly2

# Restart app
pm2 restart freelanly

# View app logs
pm2 logs freelanly --lines 50

# View cron logs
tail -f /var/log/freelanly-cron.log

# Rebuild after code changes
git pull && npm run build && pm2 restart freelanly

# View crontab
crontab -l

# Run sources manually
curl -X POST http://localhost:3000/api/cron/fetch-sources -H "Authorization: Bearer $CRON_SECRET"
```

## Current Session Status (Dec 22, 2024)

**Что сделано в последних сессиях:**
1. ✅ Stripe payments integration (Weekly €10, Monthly €20, Annual €192)
2. ✅ Logo.dev integration (бывший Clearbit) — высококачественные логотипы компаний
3. ✅ INSTANT job alerts (отправка сразу после создания вакансии)
4. ✅ FREE vs PRO ограничения для Salary Insights
5. ✅ CompanyLogo компонент с Logo.dev fallback
6. ✅ Исправление отображения зарплаты — валюта + период (PKR 50K/mo вместо $50K)
7. ✅ salaryPeriod добавлен в JobCardData
8. ✅ Similar Jobs section — правильный формат зарплаты
9. ✅ website добавлен во все запросы company для Logo fallback
10. ✅ **Research-based salary formula** — `BaseSalary × Level × Country`
11. ✅ **salary-base.ts** — base salaries for 21 categories
12. ✅ **Level multipliers** — Intern 0.30x to Executive 2.80x
13. ✅ **Updated country coefficients** — based on Dec 2024 research
14. ✅ **Removed DB keyword matching** — было причиной завышенных зарплат

**Salary Formula Details:**
```
Annual Salary = BaseSalary[category] × LevelMultiplier[level] × CountryCoefficient[country]

Example: Lead Writer in US
$70,000 (writing) × 1.50 (lead) × 1.0 (US) = $105,000/yr
```

**Logo.dev credentials:**
```
Publishable key: pk_A6k2yPZ4T6y5MZrbuUd9yA
Secret key: sk_S3uVup8yTSaIFQ_dz0khiA
```

**Stripe credentials (get from owner):**
```
STRIPE_SECRET_KEY=sk_live_xxx  # Get from Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_xxx  # Get from webhook settings
```

**Известные проблемы:**
- Apollo.io не всегда находит данные для небольших компаний → используется Logo.dev fallback
- Если `logo = ""` — Apollo не нашёл данные; если `logo = null` — enrichment не запускался
- Logo.dev иногда не находит логотип для новых/малых компаний → показывается буква-placeholder
- BLS API имеет дневной лимит запросов — при превышении используется formula estimation

**Возможные следующие шаги:**
1. Добавить WEEKLY cron для недельных алертов
2. Application tracking (отслеживание откликов)
3. Onboarding wizard после первого входа
4. Dashboard analytics для пользователей

**Для деплоя последних изменений:**
```bash
cd /opt/freelanly2
git pull origin claude/review-changes-mjh9fja4hh5i30r3-cBxYN
npm run build && pm2 restart freelanly
# Очистить кеш зарплат если нужно:
npx prisma db execute --stdin <<< "TRUNCATE TABLE \"SalaryBenchmark\";"
```

**Настройка Stripe webhook (обязательно!):**
1. Зайти в Stripe Dashboard → Webhooks
2. Add endpoint: `https://freelanly.com/api/stripe/webhook`
3. Select events: checkout.session.completed, customer.subscription.*, invoice.*
4. Добавить STRIPE_WEBHOOK_SECRET в .env.local на сервере
