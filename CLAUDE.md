# Freelanly 2.0 — Project Context

## Quick Summary

SEO-оптимизированная платформа для поиска удалённых вакансий. Агрегация из LinkedIn (Apify) и ATS (Lever). AI extraction через DeepSeek.

**Автоматизация:**
- Daily cron at 6:00 UTC: fetches all sources
- Daily cron at 7:00 UTC: sends job alert notifications
- Daily cron at 10:00 UTC: sends win-back emails to churned users
- Cron every 5 min: processes INSTANT alert queue (batched emails)
- Hourly cron: sends trial onboarding emails (Day 0, 2, 5, 6, 7)
- Cron every 15 min: posts 1 job to LinkedIn + Telegram via n8n
- n8n workflow: scrapes LinkedIn posts every 15-20 min via Apify
- Auto cleanup: removes jobs older than 7 days after each import
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

### Registration Flow (2-Step Funnel)
Пользователи регистрируются через форму при попытке откликнуться на вакансию.

**Flow:**
1. User clicks "Login to Apply" on job page (unauthenticated)
2. RegistrationModal opens with form:
   - Email (required)
   - Name (optional)
   - Categories (multi-select dropdown, required)
   - Country (optional)
   - Language pairs (conditional, if translation selected)
3. User submits → `/api/auth/register` creates:
   - User record (pre-created, not verified yet)
   - JobAlerts (one per category, frequency=INSTANT)
4. Magic link sent via DashaMail
5. User clicks link → verified, redirected to /dashboard
6. User receives INSTANT alerts for matching jobs
7. FREE user hits paywall when trying to apply → UpgradeModal → /pricing

**Why 2-step funnel:**
- Captures email BEFORE paywall (unlike direct /pricing flow)
- Auto-subscribes to job alerts → nurture emails → conversion
- Previous experience: 3% conversion rate with this model

**Files:**
- `src/components/auth/RegistrationForm.tsx` — Reusable registration form component
- `src/components/auth/RegistrationModal.tsx` — Modal wrapper for RegistrationForm
- `src/app/api/auth/register/route.ts` — Creates user + alerts
- `src/app/auth/signin/page.tsx` — Uses RegistrationForm (full page)
- `src/components/auth/UserMenu.tsx` — "Sign In" opens RegistrationModal
- `src/components/jobs/ApplyButton.tsx` — Shows "Login to Apply" for unauth users
- `src/app/pricing/PricingCards.tsx` — Shows RegistrationModal on subscribe click

**ApplyButton behavior:**
- `isAuthenticated=false` → "Login to Apply" → RegistrationModal
- `isAuthenticated=true, userPlan=FREE` → "Upgrade to Apply" → UpgradeModal
- `isAuthenticated=true, userPlan=PRO` → "Apply Now" → actual apply

### User Plans & Stripe Integration
| Feature | FREE | PRO |
|---------|------|-----|
| Job views | Unlimited | Unlimited |
| Saved jobs | Unlimited | Unlimited |
| Salary insights | Average only | Full (range, percentiles, source) |
| INSTANT alerts | Yes | Yes |
| Apply to jobs | ❌ Blocked | ✅ Unlimited |
| Contact info in descriptions | ❌ Hidden | ✅ Visible |

**Pricing (EUR) — No trials:**
| Plan | Price | Per Day | Savings |
|------|-------|---------|---------|
| Monthly | €15/month | €0.50 | — |
| Quarterly | €35/3 months | €0.39 | Save 22% |
| Annual | €150/year | €0.41 | Save 17% |

**Stripe Price IDs:**
```
MONTHLY:   price_1Sk2G8KHJU6KLxM31y73p1lD
QUARTERLY: price_1Sk2I0KHJU6KLxM33CN9mn0E
ANNUAL:    price_1Sk2JYKHJU6KLxM3QE0ffgxt
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

## n8n Integration

**LinkedIn Posts:** `/api/webhooks/linkedin-posts` — receives posts from n8n (every 15-20 min via Apify)
**Social Queue:** Jobs → `SocialPostQueue` → cron every 15 min → n8n → LinkedIn + Telegram
**n8n URL:** `N8N_SOCIAL_WEBHOOK_URL=https://n8n.freelanly.com/webhook/c78f8a78-bd4b-4254-af59-498b224a9e6f`

## Key Architecture Decisions

### ⚠️ Job Import Rules (ЕДИНСТВЕННЫЕ ПРАВИЛА)

**Вакансия импортируется ТОЛЬКО если:**
1. Title соответствует whitelist целевых профессий
2. Вакансия не старше 7 дней

```
ПРАВИЛО ИМПОРТА:
1. TOO_OLD → вакансия старше 7 дней → НЕ импортировать
2. Blacklist (приоритет) → title содержит запрещённые слова → НЕ импортировать
3. Whitelist → title содержит целевые профессии → импортировать
4. Ни то, ни другое → НЕ импортировать
```

**Что НЕ является фильтром при импорте:**
- ❌ Тип локации (REMOTE/HYBRID/ONSITE) — НЕ фильтруется
- ❌ Страна
- ❌ Уровень (Junior/Senior)

**Фильтрация по локации** происходит на фронтенде пользователем, не при импорте.

**Файлы:**
- `src/lib/utils.ts` → `MAX_JOB_AGE_DAYS = 7` — максимальный возраст вакансии
- `src/config/target-professions.ts` — whitelist/blacklist паттерны (ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ)
- `src/lib/job-filter.ts` → `shouldSkipJob()` — применяет правило
- Все процессоры (Lever, LinkedIn, etc.) используют `shouldSkipJob()`

**Blacklist примеры:** driver, nurse, accountant, teacher, cook, warehouse, mechanic
**Whitelist примеры:** developer, engineer, designer, product manager, data scientist, marketing manager

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
- **7-day max age** (reduced for better relevance)
- `src/lib/utils.ts` → `MAX_JOB_AGE_DAYS = 7`, `getMaxJobAgeDate()`

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

### Company Logo
Priority: Apollo → Logo.dev (`img.logo.dev/DOMAIN?token=pk_A6k2yPZ4T6y5MZrbuUd9yA`) → Placeholder

### Salary Display
Format: `PKR 50,000/mo` | Periods: `/hr`, `/day`, `/wk`, `/mo`, `/yr`

### Salary Insights
Sources: Cache → BLS (US) → Adzuna (19 countries) → Formula estimation.
**Formula:** `BaseSalary[category] × Level × Country` (see `src/config/salary-base.ts`, `salary-coefficients.ts`)
**FREE:** average only | **PRO:** full range, percentiles, source

## Key Files

**Core:** `src/lib/deepseek.ts` (AI), `src/lib/utils.ts`, `src/lib/auth.ts`, `src/lib/stripe.ts`
**Services:** `src/services/linkedin-processor.ts`, `src/services/sources/*.ts`, `src/services/alert-notifications.ts`, `src/services/salary-insights.ts`
**API crons:** `src/app/api/cron/fetch-sources|fetch-linkedin|send-alerts|process-instant-alerts|send-trial-emails|send-winback-emails`
**Config:** `src/config/site.ts`, `src/config/salary-base.ts`, `src/config/salary-coefficients.ts`
**Scripts:** `scripts/cleanup-duplicate-*.ts`, `scripts/recategorize-jobs.ts`

## Common Tasks

```bash
# Cron triggers (add -H "Authorization: Bearer $CRON_SECRET")
curl -X POST http://localhost:3000/api/cron/fetch-sources    # All ATS sources
curl -X POST http://localhost:3000/api/cron/fetch-linkedin   # LinkedIn only
curl -X POST "http://localhost:3000/api/cron/send-alerts?frequency=DAILY"

# Scripts
npx tsx scripts/cleanup-duplicate-companies.ts
npx tsx scripts/cleanup-duplicate-jobs.ts
npx tsx scripts/recategorize-jobs.ts

# Database
npm run db:seed                    # After DB reset
npx prisma db push                 # Schema changes
npx prisma db push --force-reset   # DANGEROUS: deletes ALL data!
```

**Add Lever source:** Admin → Sources → Add New → LEVER → company-slug

## Key Features Summary

- **Auth**: NextAuth v5 (Google + Magic Link), 2-step registration funnel
- **Payments**: Stripe (Weekly €10, Monthly €20, Annual €192), trial emails, win-back
- **Alerts**: INSTANT/DAILY/WEEKLY job alerts, queue-based batching
- **Salary**: BLS (US) + Adzuna (intl) + formula estimation, FREE vs PRO restrictions
- **SEO**: truncateTitle(), noindex multi-filters, IndexNow, Google Indexing API
- **Social**: Auto-post queue to LinkedIn + Telegram via n8n

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

### SEO: Page Title Truncation (REQUIRED)
All dynamic pages MUST use `truncateTitle()` from `src/lib/seo.ts` to ensure titles are max 60 characters.

**Utility:** `src/lib/seo.ts`
```typescript
import { truncateTitle } from '@/lib/seo';

// In generateMetadata():
const seoTitle = truncateTitle(`${company.name} Remote Jobs - Work at ${company.name}`);
// Returns max 60 chars with "..." if truncated

return {
  title: seoTitle,
  openGraph: { title: seoTitle, ... },
  twitter: { title: seoTitle, ... },
};
```

**Why:** Google truncates titles >60 chars in search results, causing SEO warnings.

**Pages using this pattern:**
- `/company/[companySlug]/page.tsx`
- `/company/[companySlug]/jobs/page.tsx`
- `/company/[companySlug]/jobs/[jobSlug]/page.tsx`
- `/jobs/[category]/page.tsx`
- `/jobs/[category]/[level]/page.tsx`
- `/jobs/country/[country]/page.tsx`
- `/jobs/translation/[pair]/page.tsx`
- `/country/[countrySlug]/page.tsx`
- `/country/[countrySlug]/jobs/[roleSlug]/page.tsx`

### Blog Content Guidelines
Reference: `/blog/remote-work-statistics-2026`. Use exact data with sources, internal links to /jobs/*, external links to BLS/Gallup/Levels.fyi. No generic advice or rounded numbers.

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
5. **Primary hosting: Replit** — работает из России без проблем
6. **VPS (198.12.73.168)** — только для n8n workflows
7. **Cron jobs** — настраиваются в Replit Scheduled Deployments
8. **Jobs auto-deleted after 7 days** — this is intentional for freshness, not a bug

## Replit Hosting (Primary)

**Почему Replit:**
- Работает из России (Neon DB не блокируется)
- Простой деплой через GitHub
- Встроенный SSL
- Secrets для env variables

**Текущий хостинг:**
- **Primary:** Replit (freelanly.replit.app → freelanly.com)
- **n8n:** VPS 198.12.73.168 через Cloudflare Tunnel (n8n.freelanly.com)

**DNS (Cloudflare):**
```
freelanly.com  → CNAME → xxxx.replit.app (Proxy OFF!)
www            → CNAME → freelanly.com
n8n            → CNAME → cfargotunnel.com (Proxy ON)
```

**⚠️ ВАЖНО: Cloudflare Proxy должен быть OFF (серая тучка) для основного домена!**

### Replit Secrets (Environment Variables)

Все env variables добавляются в Settings → Secrets:

```
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
AUTH_SECRET=xxx
AUTH_URL=https://freelanly.com  # ОБЯЗАТЕЛЬНО с https://
CRON_SECRET=xxx
DEEPSEEK_API_KEY=xxx
APIFY_API_TOKEN=xxx
APOLLO_API_KEY1=xxx
DASHAMAIL_API_KEY=xxx
DASHAMAIL_FROM_EMAIL=info@freelanly.com
DASHAMAIL_LIST_ID=358581
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NEXT_PUBLIC_YANDEX_METRIKA_ID=103606747
BLS_API_KEY=xxx
ADZUNA_APP_ID=xxx
ADZUNA_APP_KEY=xxx
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
```

### Shell Workflow (Replit)
`git pull` → edit files → `git add . && git commit -m "msg"` → `git push` → Replit UI → Deploy → Redeploy

### Cron Jobs (Replit)

Cron jobs настраиваются через Replit Scheduled Deployments или внешние сервисы:

**Manual trigger:**
```bash
curl -X POST "https://freelanly.com/api/cron/fetch-sources" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST "https://freelanly.com/api/cron/fetch-linkedin" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST "https://freelanly.com/api/cron/send-alerts?frequency=DAILY" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST "https://freelanly.com/api/cron/send-nurture" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST "https://freelanly.com/api/cron/submit-to-index" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## VPS (n8n only)
SSH: `ssh root@198.12.73.168` | URL: https://n8n.freelanly.com (Cloudflare Tunnel)
