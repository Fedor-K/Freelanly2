# Freelanly 2.0 — Project Context

## ⚠️ Current State (updated 2026-05-23) — READ FIRST

Продукт **развернулся** из SEO job-board в **AI auto-apply платформу для фрилансеров**. Многие разделы ниже описывают старый job-board и оставлены как историческая справка по pipeline-у скрапинга/качества (он ещё используется для Opportunities). При расхождениях **этот блок и живой код — источник правды**.

- **Продукт:** скрапим **Opportunities** (фриланс-гиги из постов LinkedIn) + **Jobs** (из ATS), юзер откликается через AI-сгенерированный cover letter, отправка с self-hosted Postal.
- **Главная конверсионная точка:** inline apply на `/freelance/[slug]` — регистрация + AI cover letter + отправка на одной странице без редиректов.
- **Email — ТОЛЬКО Postal** (self-hosted, Hetzner). DashaMail / Resend / SES / SMTP2GO / Elastic Email — **отменены**, файлы под них в `src/lib/email/` мёртвые.
- **Job alerts ПРИОСТАНОВЛЕНЫ.** Единственные исходящие письма: (1) recap 2×/день, (2) auto-apply outreach + ответы, (3) auth OTP.
- **Daily limit:** 20 applies/day для FREE.
- **Paywall (в планах, ещё не включён):** $2-3 за переписку с рекрутером, первая бесплатно.
- **`/dashboard/auto-apply` удалён** → юзер попадает на `/dashboard`.
- **SEO:** `/freelance/` = noindex; `/jobs/`, `/company/`, `/country/` страницы **удалены**; robots.txt разрешает всё кроме `/api/`, `/admin/`, `/dashboard/`, `/freelance/`.
- **БД (снимок):** ~5,768 юзеров (после чистки 6,114 мёртвых), ~1,117 активных auto-apply лупов.

**Crons (2 хоста):**
- *Hetzner:* `match */5`, `send */2`, `replies */15`, `inbound */1`, `recap 0 5,16 * * *` (UTC → 08:00/19:00 MSK).
- *Vercel (`vercel.json`):* `fetch-sources`, `post-to-social`, `discover-lever`, `discover-greenhouse`, `submit-to-index`, `cleanup-stale-alerts`, `send-auto-apply-digest`.

## Quick Summary

Платформа AI auto-apply для фрилансеров. Агрегация из LinkedIn (Apify) и ATS (Lever/Greenhouse/Ashby/SmartRecruiters/Workable). AI extraction и cover letters через DeepSeek или Z.ai (переключается через `AI_PROVIDER` env var).

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- PostgreSQL (Neon) + Prisma 5
- **AI Providers** (switchable via `AI_PROVIDER` env var):
  - DeepSeek API (default) — $0.28/$0.42 per 1M tokens
  - Z.ai GLM-4-32B — $0.10/$0.10 per 1M tokens (64% cheaper)
- Apify (LinkedIn scraping)
- Apollo.io (company enrichment)
- NextAuth v5 (authentication)
- **Postal** — self-hosted на Hetzner, ЕДИНСТВЕННЫЙ email-провайдер (`src/lib/email/postal.ts`)
- Stripe **и** PayPro (subscription payments, поле `User.paymentProvider`)

## Authentication & User Dashboard

### Auth Setup (NextAuth v5)
- **Providers**: Google OAuth + Email OTP code (via Postal)
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

### Registration / Apply Flow (Inline на `/freelance/[slug]`)
ГЛАВНАЯ конверсионная точка. Всё происходит на одной странице проекта без редиректов.

**Flow:**
1. Unauth юзер открывает `/freelance/[slug]` (страница Opportunity)
2. Жмёт apply → инлайн-форма регистрации (email + обязательные поля, см. `ProjectPageClient.tsx`)
3. OTP-код отправляется через Postal → юзер вводит код прямо на странице (`?apply=1` флаг сохраняет намерение)
4. После верификации AI генерит cover letter → отправка отклика на email/URL автора — всё на той же странице
5. Создаётся `AutoApplication`; дальше пользователь управляет всем в `/dashboard`

**Daily limit:** 20 applies/day (FREE).

**Files:**
- `src/app/freelance/[slug]/page.tsx` + `ProjectPageClient.tsx` — страница проекта + inline apply
- `src/app/api/auth/register/route.ts` — создаёт User (alerts больше НЕ создаются — приостановлены)
- `src/app/api/auth/verify-code/route.ts` — проверка OTP
- `src/app/api/user/draft-apply/route.ts`, `quick-apply/route.ts` — генерация и отправка отклика

> Старый flow (RegistrationModal на job-страницах, "Login to Apply" / "Upgrade to Apply", /pricing) — **deprecated**, job/company-страницы удалены.

### User Plans & Stripe Integration
| Feature | FREE | PRO |
|---------|------|-----|
| Job views | Unlimited | Unlimited |
| Saved jobs | Unlimited | Unlimited |
| Salary insights | Average only | Full (range, percentiles, source) |
| INSTANT alerts | Yes | Yes |
| Apply to jobs | ❌ Blocked | ✅ Unlimited |
| Contact info in descriptions | ❌ Hidden | ✅ Visible |

**Pricing (EUR):**
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
/dashboard            — Overview (auto-apply сюда же, /dashboard/auto-apply УДАЛЁН)
/dashboard/discovery  — Лента подобранных Opportunities + apply-all
/dashboard/pipeline   — Трекинг отправленных откликов (AutoApplication)
/dashboard/inbox      — Ответы рекрутеров (reply-checker + inbound)
/dashboard/resumes    — Резюме (PDF → parsedProfile)
/dashboard/templates  — Cover letter templates
/dashboard/alerts     — Управление алертами (рассылка ПРИОСТАНОВЛЕНА)
/dashboard/analytics  — Метрики откликов/ответов
/dashboard/billing    — Подписка (Stripe / PayPro)
/dashboard/settings   — Профиль, SMTP, voice training, расписание отправки
```

### Job Alerts for Translators
Специальные фильтры для языковых профессий с поддержкой множественных языковых пар.

**Translation Types:**
- TRANSLATION, INTERPRETATION, LOCALIZATION, EDITING
- TRANSCRIPTION, SUBTITLING, MT_POST_EDITING, COPYWRITING

**Language Pairs Model:**
```prisma
model AlertLanguagePair {
  id              String   @id @default(cuid())
  jobAlert        JobAlert @relation(...)
  translationType String   // TRANSLATION, INTERPRETATION, etc.
  sourceLanguage  String   // ISO 639-1: EN, RU, DE
  targetLanguage  String   // ISO 639-1: RU, EN, DE
}
```

**Files:**
- `src/app/dashboard/alerts/AlertsList.tsx` — UI for managing alerts
- `src/app/api/user/alerts/route.ts` — CRUD endpoints
- `prisma/schema.prisma` — JobAlert, AlertLanguagePair models

### Email Notifications for Job Alerts
> ⚠️ **ПРИОСТАНОВЛЕНО (с мая 2026).** Рассылка алертов (INSTANT/DAILY/WEEKLY) отключена. Раздел оставлен как историческая справка. Сейчас исходящие письма только: recap 2×/день (08:00+19:00 MSK), auto-apply outreach + ответы, auth OTP. Модели/код не удалены, но крон рассылки не запускается.

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
- `queueInstantAlertsForJob(jobId)` in `src/services/alert-notifications.ts`
- Called after job creation in:
  - `/api/webhooks/linkedin-posts` (n8n real-time)
  - `linkedin-processor.ts` (batch import)
- Checks job against all active INSTANT alerts
- Queues notifications for matching alerts (not immediate send)
- Cron `process-instant-alerts` runs every 15 min to send grouped emails

**Rate Limiting:**
- **Daily limit:** 3 emails per user per day (prevents spam)
- **Debounce:** 30 minutes between emails to same user
- **Batch size:** 50 users per cron run
- Notifications stay in queue until user becomes eligible

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
- `src/lib/utils.ts` → `MAX_JOB_AGE_DAYS = 14` — максимальный возраст для импорта
- `src/lib/utils.ts` → `MAX_JOB_STORAGE_DAYS = 30` — максимальный срок хранения (cleanup)
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
- **Import**: принимаются вакансии до 14 дней давности (`MAX_JOB_AGE_DAYS = 14`)
- **Storage**: вакансии хранятся 30 дней, потом удаляются (`MAX_JOB_STORAGE_DAYS = 30`)
- `src/lib/utils.ts` → `getMaxJobAgeDate()`, `getMaxJobStorageDate()`

### Filters (/jobs page) — УДАЛЕНО
Страницы `/jobs/`, `/company/`, `/country/` удалены (см. блок Current State). Публичный контент теперь только `/freelance/[slug]` (noindex). Раздел оставлен исторически.

### Breadcrumbs
- Follow URL structure, NOT navigation path
- Job page: `Home / Company / Job Title`
- Industry standard approach

### Email Handling
- Free emails (gmail, yahoo, etc.) are soft signals that lower content quality score (-15)
- Jobs with free emails are still imported but may be marked as THIN content
- `src/lib/content-quality.ts` → `isFreeEmailProvider()`

### Company Logo
Priority: Apollo → Logo.dev (`img.logo.dev/DOMAIN?token=pk_A6k2yPZ4T6y5MZrbuUd9yA`) → Placeholder

### Salary Display
Format: `PKR 50,000/mo` | Periods: `/hr`, `/day`, `/wk`, `/mo`, `/yr`

### Salary Insights
Sources: Cache → BLS (US) → Adzuna (19 countries) → Formula estimation.
**Formula:** `BaseSalary[category] × Level × Country` (see `src/config/salary-base.ts`, `salary-coefficients.ts`)
**FREE:** average only | **PRO:** full range, percentiles, source

### AI Post Validation
Перед обработкой постов из социальных сетей проверяем что это действительно вакансия.

**Function:** `isJobPosting(postContent)` в `src/lib/deepseek.ts`

**Фильтруются (NOT_JOB):**
- Event invitations (вебинары, конференции, митапы)
- Company announcements (новости, фандинг)
- Job seeker posts ("I'm looking for...")
- Articles/tips/opinions
- Self-promotion (freelancer advertising)
- Networking posts

**Пропускаются (JOB):**
- Чёткое предложение работы с позицией
- Кто-то нанимает (не ищет работу)
- Есть требования/условия

**Cost:** ~$0.00004 per post (Z.ai), выполняется ДО extractJobData для экономии.

### Content Quality for SEO
Система оценки качества контента для защиты SEO от тонкого контента (короткие посты из LinkedIn).

**Quality Tiers:**
| Tier | Score | SEO | Sitemap | Social Queue |
|------|-------|-----|---------|--------------|
| RICH | 55-100 | index | priority 0.8 | Yes |
| LIGHT | 35-54 | index | priority 0.5 | Yes |
| THIN | 0-34 | noindex | excluded | No |

**Scoring System (0-100):**
```
Base score from description length:
  <300 chars → +10
  300-500 chars → +25
  500-800 chars → +40
  800-1500 chars → +55
  >1500 chars → +70

Bonuses:
  +10 salary provided
  +8 skills ≥3
  +5 skills ≥5
  +7 requirements ≥3
  +5 benefits ≥2
  +5 clean description >500
  +10 Apollo validated

Penalties:
  -15 free email (gmail, yahoo, etc.)
  -10 announcement style
  -5 no apply method
```

**Key principle:** Quality affects SEO only, NOT visibility to users:
- ✅ ALL jobs shown on site (including THIN)
- ✅ ALL jobs sent in job alerts (including THIN)
- ❌ THIN jobs: noindex meta tag, excluded from sitemap, no IndexNow, no social posting

**Files:**
- `src/lib/content-quality.ts` — assessment functions
- `src/app/api/webhooks/linkedin-posts/route.ts` — applies quality on import
- `src/app/company/[companySlug]/jobs/[jobSlug]/page.tsx` — noindex for THIN
- `src/app/sitemap.ts` — excludes THIN, priority by quality
- `scripts/migrate-content-quality.ts` — migration for existing jobs

**Migration:**
```bash
npx tsx scripts/migrate-content-quality.ts
```

## Key Files

**Core:** `src/lib/deepseek.ts` (AI), `src/lib/utils.ts`, `src/lib/auth.ts`, `src/lib/stripe.ts`
**Services:** `src/services/linkedin-processor.ts`, `src/services/sources/*.ts`, `src/services/alert-notifications.ts`, `src/services/salary-insights.ts`
**API crons:** `src/app/api/cron/fetch-sources|fetch-linkedin|send-alerts|process-instant-alerts|send-trial-emails|send-winback-emails`
**Config:** `src/config/site.ts`, `src/config/salary-base.ts`, `src/config/salary-coefficients.ts`
**Scripts:** `scripts/cleanup-duplicate-*.ts`, `scripts/recategorize-jobs.ts`, `scripts/migrate-content-quality.ts`

## Common Tasks

```bash
# Cron triggers (add -H "Authorization: Bearer $CRON_SECRET")
curl -X POST http://localhost:3000/api/cron/fetch-sources    # All ATS sources
curl -X POST http://localhost:3000/api/cron/fetch-linkedin   # LinkedIn only
curl -X POST http://localhost:3000/api/cron/discover-lever   # Find new Lever companies
curl -X POST "http://localhost:3000/api/cron/send-alerts?frequency=DAILY"

# Scripts
npx tsx scripts/cleanup-duplicate-companies.ts
npx tsx scripts/cleanup-duplicate-jobs.ts
npx tsx scripts/recategorize-jobs.ts
npx tsx scripts/migrate-content-quality.ts   # Assess quality for existing jobs
npx tsx scripts/run-lever-discovery.ts       # Manual Lever discovery (local)

# Database
npm run db:seed                    # After DB reset
npx prisma db push                 # Schema changes
npx prisma db push --force-reset   # DANGEROUS: deletes ALL data!
```

**Add Lever source:** Admin → Sources → Add New → LEVER → company-slug

## Key Features Summary

- **Auto-apply (ядро)**: AutoApplyLoop (критерии + лимит) → AutoApplication (AI cover letter → Postal → трекинг ответов/follow-up). Inline apply на `/freelance/[slug]`. 20 applies/day FREE.
- **Auth**: NextAuth v5 (Google + Email OTP via Postal)
- **Payments**: Stripe + PayPro. Paywall за переписку ($2-3, первая бесплатно) — в планах.
- **Email**: Postal only (self-hosted Hetzner)
- **Alerts**: ⚠️ ПРИОСТАНОВЛЕНЫ. Только recap 2×/день + auto-apply + OTP.
- **Salary**: BLS (US) + Adzuna (intl) + formula estimation, FREE vs PRO restrictions
- **SEO**: `/freelance/` noindex; `/jobs`,`/company`,`/country` удалены; IndexNow, Google Indexing API
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

> ⚠️ Большинство страниц ниже **удалены** (`/jobs/*`, `/company/*`, `/country/*`). Из публичных индексируемых остаётся мало; `/freelance/[slug]` — noindex. Список сохранён исторически; применяй `truncateTitle()` к любым новым динамическим страницам.

**Pages using this pattern (historical):**
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

- Всегда проверяй дубли перед созданием company/job/opportunity
- Категоризация должна быть точной — не всё engineering!
- Email — только Postal; alerts приостановлены (см. Current State)
- Главная конверсия — inline apply на `/freelance/[slug]`

## ⚠️ Important Warnings

1. **NEVER use `prisma db push --force-reset`** without understanding it deletes ALL data!
2. After DB reset, must run `npm run db:seed` to restore categories
3. Apollo enrichment can match wrong company (e.g., "Mistral" → bakery instead of AI)
4. Salary Insights only shown for annual salaries (YEAR period)
5. **Primary hosting: Vercel** — автодеплой из GitHub
6. **VPS (198.12.73.168)** — n8n workflows; **Hetzner** — Postal + auto-apply crons (match/send/replies/inbound/recap)
7. **Cron jobs** — Vercel в vercel.json + Hetzner cron на VPS (см. Cron Jobs)
8. **Jobs auto-deleted after 30 days** — intentional for freshness, not a bug
9. **Email — ТОЛЬКО Postal.** Не подключай DashaMail/Resend/SES/SMTP2GO/Elastic — отменены
10. **Job alerts ПРИОСТАНОВЛЕНЫ** — не включай рассылку без явного запроса
11. **`/jobs`, `/company`, `/country` страницы УДАЛЕНЫ** — не ссылайся на них

## Vercel Hosting (Primary)

**Почему Vercel:**
- Автодеплой из GitHub (push → deploy)
- Edge Functions для низкой латентности
- Встроенный SSL
- Environment Variables через Dashboard
- Cron Jobs через vercel.json

**Текущий хостинг:**
- **Primary:** Vercel (freelanly.vercel.app → freelanly.com)
- **n8n:** VPS 198.12.73.168 через Cloudflare Tunnel (n8n.freelanly.com)

**DNS (Cloudflare):**
```
freelanly.com  → CNAME → cname.vercel-dns.com
www            → CNAME → cname.vercel-dns.com
n8n            → CNAME → cfargotunnel.com (Proxy ON)
```

### Vercel Environment Variables

Все env variables добавляются в Vercel Dashboard → Settings → Environment Variables:

```
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
AUTH_SECRET=xxx
AUTH_URL=https://freelanly.com  # ОБЯЗАТЕЛЬНО с https://
CRON_SECRET=xxx
DEEPSEEK_API_KEY=xxx
ZAI_API_KEY=xxx  # Z.ai API key (optional, for AI_PROVIDER=zai)
AI_PROVIDER=deepseek  # or "zai" to use Z.ai GLM-4-32B (64% cheaper)
APIFY_API_TOKEN=xxx
APOLLO_API_KEY1=xxx
# Email — ТОЛЬКО Postal (self-hosted, Hetzner). DashaMail/Resend/SES/SMTP2GO/Elastic — отменены.
POSTAL_API_KEY=xxx
POSTAL_API_URL=xxx          # endpoint self-hosted Postal сервера
POSTAL_FROM_EMAIL=info@freelanly.com
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NEXT_PUBLIC_YANDEX_METRIKA_ID=103606747
BLS_API_KEY=xxx
ADZUNA_APP_ID=xxx
ADZUNA_APP_KEY=xxx
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
```

### Deployment Workflow
`git push origin main` → Vercel автоматически деплоит

### Cron Jobs (2 хоста)

**Vercel** (`vercel.json`) — скрапинг/контент/индексация:
```json
{
  "crons": [
    { "path": "/api/cron/fetch-sources",          "schedule": "0 * * * *" },
    { "path": "/api/cron/post-to-social",         "schedule": "*/15 * * * *" },
    { "path": "/api/cron/discover-lever",         "schedule": "0 3 * * 0,3" },
    { "path": "/api/cron/discover-greenhouse",    "schedule": "0 4 * * 0,3" },
    { "path": "/api/cron/submit-to-index",        "schedule": "0 */4 * * *" },
    { "path": "/api/cron/cleanup-stale-alerts",   "schedule": "0 5 * * *" },
    { "path": "/api/cron/send-auto-apply-digest", "schedule": "0 6 * * *" }
  ]
}
```

**Hetzner** (cron на VPS) — движок auto-apply:
```
match    */5 * * * *    # подбор Opportunities под лупы
send     */2 * * * *    # отправка откликов (Postal)
replies  */15 * * * *   # классификация ответов рекрутеров
inbound  */1 * * * *    # приём входящих писем
recap    0 5,16 * * *   # recap-письма (UTC → 08:00 + 19:00 MSK)
```

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

## VPS / Self-hosted
- **n8n VPS:** SSH `ssh root@198.12.73.168` | URL: https://n8n.freelanly.com (Cloudflare Tunnel) — LinkedIn scraping + social posting workflows
- **Hetzner:** self-hosted Postal (email) + auto-apply crons (match/send/replies/inbound/recap). Источник правды по расписанию — cron на самом сервере.
