# Freelanly 2.0

SEO-оптимизированная платформа для поиска удалённых вакансий с агрегацией из LinkedIn и ATS систем.

## Содержание

- [Концепция](#концепция)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Архитектура системы](#архитектура-системы)
- [Источники вакансий](#источники-вакансий)
- [Категоризация вакансий](#категоризация-вакансий)
- [Дедупликация](#дедупликация)
- [Фильтрация и поиск](#фильтрация-и-поиск)
- [URL структура и хлебные крошки](#url-структура-и-хлебные-крошки)
- [Скрипты обслуживания](#скрипты-обслуживания)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)

---

## Концепция

Freelanly агрегирует hiring-посты из LinkedIn, извлекает структурированные данные с помощью AI, и позволяет пользователям откликаться на вакансии напрямую через email.

### Ключевые особенности

- **LinkedIn Integration** — парсинг hiring-постов через Apify
- **Multi-ATS Integration** — импорт вакансий из Lever, RemoteOK, WeWorkRemotely, HackerNews
- **AI Extraction** — извлечение данных из постов через DeepSeek (salary, benefits, skills)
- **Real Salary Display** — показ реальной зарплаты из вакансии, когда доступна
- **21 категория** — точная классификация вакансий
- **Dual Display** — показываем и extracted facts, и оригинальный пост
- **SEO-First** — программные landing pages для органического трафика
- **Email Applications** — отклики через DashaMail с tracking
- **Company Enrichment** — автоматическое обогащение данных о компаниях через Apollo.io
- **30-дневная свежесть** — только актуальные вакансии (Google рекомендация)
- **Auto Cleanup** — автоматическое удаление старых вакансий после каждого импорта
- **Daily Cron** — автоматический запуск всех источников раз в день (6:00 UTC)
- **n8n Integration** — real-time импорт LinkedIn постов через webhook
- **Fuzzy Deduplication** — умная дедупликация по email domain + похожести title
- **Authentication** — NextAuth v5 с Google OAuth и Magic Link
- **User Dashboard** — сохранённые вакансии, алерты, настройки профиля
- **Translation Alerts** — специальные фильтры для переводчиков (типы перевода + языковые пары)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Database** | PostgreSQL (Neon) |
| **ORM** | Prisma 5 |
| **AI** | DeepSeek API |
| **Scraping** | Apify |
| **Email** | DashaMail |
| **Enrichment** | Apollo.io API |
| **Auth** | NextAuth v5 (Google OAuth + Magic Link) |
| **Payments** | Stripe |
| **Hosting** | Vercel (primary) / VPS + PM2 (backup) |

---

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL database (рекомендуем [Neon](https://neon.tech))
- API ключи (см. [Environment Variables](#environment-variables))

### Installation

```bash
# Clone repository
git clone https://github.com/Fedor-K/Freelanly2.git
cd Freelanly2

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Push database schema
npm run db:push

# Seed initial data (categories)
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Архитектура системы

### Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                         ИСТОЧНИКИ                                │
├─────────────────────────────────────────────────────────────────┤
│  LinkedIn (n8n)     │  Lever ATS    │  RemoteOK     │  WWR / HN    │
│  - Real-time posts  │  - API        │  - API        │  - RSS/API   │
│  - via Apify        │  - Structured │  - Structured │  - Structured│
│  - Webhook          │               │               │              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ОБРАБОТКА ДАННЫХ                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Дедупликация          │  2. AI Extraction   │  3. Category  │
│     - По sourceId/URL     │     - DeepSeek      │     - 21 cat  │
│     - По title+company    │     - Title/Salary  │     - AI + kw │
│     - Fuzzy (email+title) │     - Skills/Level  │     - Fallback│
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      БАЗА ДАННЫХ                                 │
├─────────────────────────────────────────────────────────────────┤
│  Jobs                     │  Companies          │  Categories   │
│  - 30-day freshness      │  - Auto-enrichment  │  - 21 total   │
│  - Quality score         │  - Apollo.io data   │  - Hierarchy  │
│  - Dual display data     │  - Deduplication    │               │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND                                    │
├─────────────────────────────────────────────────────────────────┤
│  /jobs                    │  /jobs/[category]   │  /company/*   │
│  - Search filter          │  - Category filter  │  - Job detail │
│  - Level filter           │  - Level filter     │  - Apply Now  │
│  - Type filter            │                     │  - Breadcrumbs│
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Homepage
│   ├── jobs/
│   │   ├── page.tsx              # All jobs (with filters)
│   │   └── [category]/
│   │       ├── page.tsx          # Category page
│   │       └── [level]/page.tsx  # Category + level
│   ├── company/
│   │   └── [companySlug]/
│   │       ├── page.tsx          # Company page
│   │       └── jobs/
│   │           └── [jobSlug]/page.tsx  # Job detail (Apply Now)
│   ├── companies/page.tsx        # All companies
│   ├── country/
│   │   └── [countrySlug]/        # Country SEO pages
│   ├── auth/                     # Authentication pages
│   │   ├── signin/               # Sign in page
│   │   ├── verify-request/       # Magic link sent
│   │   └── error/                # Auth error
│   ├── dashboard/                # User dashboard
│   │   ├── page.tsx              # Overview
│   │   ├── saved/                # Saved jobs
│   │   ├── alerts/               # Job alerts
│   │   └── settings/             # Profile settings
│   ├── admin/                    # Admin panel
│   │   ├── sources/              # Manage data sources
│   │   └── logs/                 # Import logs
│   └── api/
│       ├── cron/
│       │   └── fetch-linkedin/   # LinkedIn import trigger
│       ├── webhooks/
│       │   ├── apify/            # Apify webhook handler
│       │   └── linkedin-posts/   # n8n webhook for individual posts
│       ├── user/                 # User API endpoints
│       │   ├── alerts/           # Job alerts CRUD
│       │   └── settings/         # User settings
│       ├── jobs/[id]/save/       # Save/unsave jobs
│       └── admin/                # Admin API endpoints
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── auth/
│   │   ├── SignInForm.tsx        # Login form
│   │   └── UserMenu.tsx          # Header user dropdown
│   └── jobs/
│       ├── JobCard.tsx
│       ├── JobFilters.tsx        # Search filter component
│       ├── SaveJobButton.tsx     # Save/unsave job button
│       └── SalaryInsights.tsx    # Salary market data visualization
│
├── lib/
│   ├── db.ts                     # Prisma client
│   ├── auth.ts                   # NextAuth v5 configuration
│   ├── auth-email.ts             # Magic Link email sender
│   ├── deepseek.ts               # DeepSeek AI (extraction + categorization)
│   ├── apify.ts                  # Apify client
│   ├── apollo.ts                 # Apollo.io enrichment
│   ├── bls.ts                    # BLS API client (US salary data)
│   ├── adzuna.ts                 # Adzuna API client (international salary)
│   ├── dashamail.ts              # DashaMail email
│   ├── settings.ts               # DB settings store
│   └── utils.ts                  # Utilities (slugify, freshness, etc.)
│
├── middleware.ts                 # Route protection for /dashboard/*
│
├── services/
│   ├── linkedin-processor.ts     # LinkedIn → Job pipeline
│   ├── company-enrichment.ts     # Apollo.io enrichment queue
│   ├── salary-insights.ts        # Salary market data service
│   ├── job-cleanup.ts            # Automatic old job cleanup
│   └── sources/
│       ├── index.ts              # Source orchestration
│       ├── lever-processor.ts    # Lever ATS processor
│       ├── remoteok-processor.ts # RemoteOK processor
│       ├── weworkremotely-processor.ts  # WWR processor
│       ├── hackernews-processor.ts      # HN Who is Hiring processor
│       └── types.ts              # Shared types
│
├── config/
│   ├── site.ts                   # Site config, 21 categories, levels, etc.
│   └── salary-coefficients.ts    # Country salary coefficients (50+ countries)
│
└── types/
    └── index.ts                  # TypeScript types

scripts/
├── cleanup-duplicate-companies.ts  # Merge duplicate companies
├── cleanup-duplicate-jobs.ts       # Remove duplicate jobs
└── recategorize-jobs.ts            # Fix job categories

prisma/
├── schema.prisma                   # Database schema
└── seed.ts                         # Seed categories
```

---

## Источники вакансий

### 1. LinkedIn (через Apify)

**Процесс:**
1. Apify Actor scrapes hiring posts from LinkedIn
2. DeepSeek AI extracts structured data (title, company, salary, skills)
3. Job is categorized using AI + keyword fallback
4. Company is found/created with deduplication
5. Job is saved with Dual Display data

**Фильтрация:**
- Только посты с корпоративным email (не gmail, yahoo, etc.)
- Дедупликация по sourceId, URL, и title+company

**Файлы:**
- `src/lib/apify.ts` — Apify клиент
- `src/lib/deepseek.ts` — AI extraction и categorization
- `src/services/linkedin-processor.ts` — Основной процессор

**Запуск импорта:**
```bash
# Через API
curl -X POST http://localhost:3000/api/cron/fetch-linkedin \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Или через webhook (Apify автоматически вызывает после завершения)
POST /api/webhooks/apify
```

### 2. Lever ATS

**Процесс:**
1. Fetch jobs from Lever API (`/v0/postings/[company-slug]`)
2. Parse structured data (already formatted)
3. Categorize by department + title keywords
4. Create/update jobs

**Особенности:**
- Structured data (quality score = 75)
- Salary data often available
- Department → Category mapping

**Файлы:**
- `src/services/sources/lever-processor.ts`
- `src/services/sources/types.ts`

**Добавление источника:**
1. Admin → Sources → Add New
2. Select "LEVER" as source type
3. Enter company slug (e.g., "netflix")
4. Save and run

### 3. RemoteOK

**Процесс:**
1. Fetch jobs from RemoteOK API (`/api`)
2. Parse structured JSON data
3. Extract salary, location, tags
4. Auto cleanup after import

**Файлы:**
- `src/services/sources/remoteok-processor.ts`

### 4. WeWorkRemotely

**Процесс:**
1. Fetch jobs from WWR RSS feed
2. Parse RSS items
3. Extract job data from descriptions
4. Auto cleanup after import

**Файлы:**
- `src/services/sources/weworkremotely-processor.ts`

### 5. HackerNews Who is Hiring

**Процесс:**
1. Fetch monthly "Who is Hiring" thread
2. Parse individual comments as job posts
3. Extract company, title, location via AI
4. Auto cleanup after import

**Файлы:**
- `src/services/sources/hackernews-processor.ts`

### Company Enrichment

При создании вакансии с корпоративным email система автоматически обогащает данные о компании через Apollo.io API:
- Логотип
- Website
- Industry
- Company size
- Headquarters

**Файлы:**
- `src/lib/apollo.ts` — Apollo.io client
- `src/services/company-enrichment.ts` — Enrichment queue

### Salary Insights

На странице вакансии отображаются реальные рыночные данные о зарплатах:

**Источники данных (по приоритету):**

| Source | Coverage | Data Quality |
|--------|----------|--------------|
| **BLS API** | US only | Official government statistics, 40+ occupation codes |
| **Adzuna API** | 19 countries | UK, DE, FR, AU, NL, AT, BE, BR, CA, IN, IT, MX, NZ, PL, RU, SG, ZA, ES, CH |
| **Coefficients** | 50+ countries | Estimation based on US baseline × country coefficient |
| **DB Fallback** | All | Calculated from similar jobs in database |

**Компонент отображает:**
- Визуализация диапазона зарплат (min-max с перцентилями)
- Средняя зарплата
- Количество похожих вакансий
- Источник данных (BLS/Adzuna/Estimated)
- Позиция текущей вакансии относительно рынка

**Кэширование:**
- 30 дней в таблице `SalaryBenchmark`
- Уникальный ключ: `jobTitle + country + region`

**Файлы:**
- `src/lib/bls.ts` — BLS API client (US)
- `src/lib/adzuna.ts` — Adzuna API client (international)
- `src/config/salary-coefficients.ts` — Country coefficients (50+ countries)
- `src/services/salary-insights.ts` — Main service
- `src/components/jobs/SalaryInsights.tsx` — UI component

---

## Authentication & User Dashboard

### Auth Setup (NextAuth v5)

- **Providers**: Google OAuth + Magic Link (via DashaMail)
- **Session**: Database strategy, 30-day lifetime
- **Protected routes**: `/dashboard/*` via middleware

**Environment variables:**
```env
AUTH_SECRET=xxx  # Generate: openssl rand -base64 32
AUTH_URL=https://freelanly.com
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

**Файлы:**
- `src/lib/auth.ts` — NextAuth configuration
- `src/lib/auth-email.ts` — Magic Link email sender
- `src/middleware.ts` — Route protection
- `src/components/auth/SignInForm.tsx` — Login form
- `src/components/auth/UserMenu.tsx` — Header user menu

### User Plans

| Feature | FREE | PRO ($19/mo) |
|---------|------|--------------|
| Job views | 5/day | Unlimited |
| Applications | 0 | 100/month |
| Saved jobs | Unlimited | Unlimited |
| Salary insights | Limited | Full |
| Email tracking | No | Yes |

### Dashboard Pages

```
/dashboard              — Overview, stats
/dashboard/saved        — Saved jobs
/dashboard/applications — Application tracking (TODO)
/dashboard/alerts       — Job alerts management
/dashboard/settings     — Profile settings
```

### Job Alerts for Translators

Специальные фильтры для языковых профессий:

**Translation Types:**
- WRITTEN — письменный перевод
- INTERPRETATION — устный перевод
- LOCALIZATION — локализация
- EDITING — редактура
- TRANSCRIPTION — транскрибирование
- SUBTITLING — субтитры
- MT_POST_EDITING — постредактирование MT
- COPYWRITING — копирайтинг

**Language Pairs:**
Пользователь может добавить несколько языковых пар для каждого типа перевода:
```
Written Translation: RU→EN, EN→RU, EN→DE
Interpretation: DE→RU, DE→EN
```

**Database Model:**
```prisma
model AlertLanguagePair {
  id              String   @id @default(cuid())
  jobAlert        JobAlert @relation(...)
  translationType String   // WRITTEN, INTERPRETATION, etc.
  sourceLanguage  String   // ISO 639-1: EN, RU, DE
  targetLanguage  String   // ISO 639-1: RU, EN, DE
}
```

**Файлы:**
- `src/app/dashboard/alerts/AlertsList.tsx` — UI для управления алертами
- `src/app/api/user/alerts/route.ts` — API эндпоинты
- `prisma/schema.prisma` — модели JobAlert, AlertLanguagePair

---

## Категоризация вакансий

### 21 категория

| Group | Categories |
|-------|------------|
| **Tech** | engineering, design, data, devops, qa, security |
| **Business** | product, marketing, sales, finance, hr, operations, legal, project-management |
| **Content** | writing, translation, creative |
| **Other** | support, education, research, consulting |

### Алгоритм классификации

1. **AI Classification (DeepSeek)**
   - Prompt с полным списком категорий и примерами
   - Temperature = 0 для детерминизма

2. **Local Fallback (keywords)**
   - Если AI недоступен или вернул invalid category
   - Keyword matching по title
   - Default: `support` (не `engineering`!)

**Файлы:**
- `src/lib/deepseek.ts` → `classifyJobCategory()`
- `src/services/sources/lever-processor.ts` → `mapDepartmentToCategory()`

**Примеры классификации:**
```
"Research Manager" → research
"Business Analyst" → data
"Image Review/Annotation" → qa
"Software Engineer" → engineering
"Product Manager" → product
"Payroll Specialist" → finance
```

---

## Дедупликация

### Дедупликация компаний

**Проблема:** Одна компания может приходить с разными названиями:
- "Acme Corp" vs "Acme Corp, Inc"
- "iTech US Inc" vs "iTech US Inc, "

**Решение:**
1. Нормализация имени (trim, remove trailing comma, etc.)
2. Поиск по нескольким критериям:
   - По slug
   - По LinkedIn URL
   - По имени (case-insensitive)
   - По нормализованному имени

**Файлы:**
- `src/services/linkedin-processor.ts` → `normalizeCompanyName()`, `findOrCreateCompany()`
- `src/services/sources/lever-processor.ts` → `findOrCreateCompany()`

### Дедупликация вакансий

**Проверки:**
1. По sourceId или sourceUrl (exact match)
2. По title + companyId (case-insensitive)
3. По email domain + похожести title (fuzzy, 60%+ Jaccard similarity)

**Файлы:**
- `src/services/linkedin-processor.ts` → `processLinkedInPost()`
- `src/app/api/webhooks/linkedin-posts/route.ts` → `findSimilarJobByEmailDomain()`

### Fuzzy Deduplication

Для предотвращения дубликатов, когда одна компания публикует похожие вакансии:
1. Извлекаем домен из email (напр. `tekwissen.in` из `job@tekwissen.in`)
2. Ищем вакансии за 30 дней с тем же доменом
3. Сравниваем title через Jaccard similarity (пересечение слов / объединение слов)
4. Если similarity ≥ 60% → пропускаем как дубликат

**Пример:**
- `"English - Portuguese Translator"` vs `"English–Portuguese Translator"`
- Оба нормализуются в `["english", "portuguese", "translator"]`
- Similarity = 100% → дубликат

### Скрипты очистки

```bash
# Очистка дублей компаний (merge jobs to primary)
npx tsx scripts/cleanup-duplicate-companies.ts

# Очистка дублей вакансий (keep latest)
npx tsx scripts/cleanup-duplicate-jobs.ts

# Исправление категорий
npx tsx scripts/recategorize-jobs.ts
```

---

## Фильтрация и поиск

### /jobs page

**Доступные фильтры:**

| Filter | Type | URL Param |
|--------|------|-----------|
| Search | Text input | `?q=keyword` |
| Level | Multi-select | `?level=SENIOR&level=LEAD` |
| Job Type | Multi-select | `?type=FULL_TIME&type=CONTRACT` |
| Category | Link to /jobs/[category] | — |

**Реализация:**
- Server Component с URL-based state
- Filters sidebar (desktop only)
- Active filters shown as removable badges
- Pagination preserves filters

**Файлы:**
- `src/app/jobs/page.tsx` — Main page with filters
- `src/components/jobs/JobFilters.tsx` — Search component

### Freshness (30 дней)

Все вакансии старше 30 дней автоматически скрываются из листингов:

```typescript
// src/lib/utils.ts
export const MAX_JOB_AGE_DAYS = 30;

export function getMaxJobAgeDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - MAX_JOB_AGE_DAYS);
  return date;
}
```

### Auto Cleanup

После каждого импорта автоматически удаляются:
- Вакансии старше 30 дней (`postedAt < 30 days ago`)
- Неактивные вакансии (`isActive = false`)

**Файлы:**
- `src/services/job-cleanup.ts` — сервис очистки

**Интеграция:**
- Вызывается в конце каждого процессора (LinkedIn, Lever, RemoteOK, WWR, HN)

---

## URL структура и хлебные крошки

### URL схема

```
/                                    # Homepage
/jobs                                # All jobs (with filters)
/jobs/[category]                     # Jobs by category
/jobs/[category]/[level]             # Jobs by category + level

/company/[companySlug]               # Company page
/company/[companySlug]/jobs/[jobSlug]# Job detail page

/companies                           # All companies
/companies-hiring-worldwide          # Companies hiring globally

/country/[countrySlug]               # Jobs by country
/country/[countrySlug]/jobs/[role]   # Country + role
```

### Breadcrumbs

Хлебные крошки отражают URL-структуру, а не путь навигации:

**Job Detail Page:**
```
Home / Company Name / Job Title
```

**Category Page:**
```
Home / Jobs / Category Name
```

**Примечание:** Если пользователь пришёл из `/jobs/engineering`, хлебные крошки всё равно покажут компанию, т.к. это индустриальный стандарт и соответствует URL структуре.

**Файлы:**
- `src/app/company/[companySlug]/jobs/[jobSlug]/page.tsx` — Job breadcrumbs

---

## Скрипты обслуживания

### cleanup-duplicate-companies.ts

Находит компании-дубли и объединяет их:
1. Группирует по нормализованному имени
2. Выбирает primary (с logo или самую старую)
3. Переносит все jobs на primary
4. Удаляет дубли

```bash
npx tsx scripts/cleanup-duplicate-companies.ts
```

### cleanup-duplicate-jobs.ts

Удаляет дубли вакансий:
1. Группирует по title + companyId (case-insensitive)
2. Оставляет самую свежую
3. Удаляет остальные

```bash
npx tsx scripts/cleanup-duplicate-jobs.ts
```

### recategorize-jobs.ts

Исправляет неправильно категоризированные вакансии:
1. Берёт все вакансии в "engineering"
2. Прогоняет через local classification
3. Если не engineering — пробует AI
4. Обновляет категорию

```bash
npx tsx scripts/recategorize-jobs.ts
```

---

## API Endpoints

### Public (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | Job listings with filters |
| GET | `/jobs/[category]` | Jobs by category |
| GET | `/company/[slug]` | Company page |
| GET | `/company/[slug]/jobs/[jobSlug]` | Job detail |

### Cron (require CRON_SECRET)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cron/fetch-linkedin` | Trigger LinkedIn import |
| POST | `/api/cron/fetch-sources` | Trigger all ATS sources (Lever, RemoteOK, WWR, HN) |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/apify` | Apify run completion webhook |
| POST | `/api/webhooks/linkedin-posts` | n8n webhook for individual LinkedIn posts |

### User (require auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/DELETE | `/api/jobs/[id]/save` | Save/unsave a job |
| GET/POST | `/api/user/alerts` | List/create job alerts |
| PUT/DELETE | `/api/user/alerts/[id]` | Update/delete job alert |
| GET/PUT | `/api/user/settings` | Get/update user settings |

### Admin (internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/sources` | Manage data sources |
| POST | `/api/admin/sources/[id]/run` | Run specific source |
| GET | `/api/admin/logs` | Import logs |
| GET | `/api/admin/stats` | Dashboard stats |
| POST | `/api/admin/cleanup-jobs` | Cleanup old jobs |
| POST | `/api/admin/enrich-companies` | Trigger enrichment |

---

## Environment Variables

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"

# App
NEXT_PUBLIC_APP_URL="https://freelanly.com"

# DeepSeek AI (job extraction + categorization)
DEEPSEEK_API_KEY="sk-xxx"

# Apify (LinkedIn scraping)
APIFY_API_TOKEN="apify_api_xxx"

# Apollo.io (company enrichment)
APOLLO_API_KEY="xxx"

# BLS (Bureau of Labor Statistics) - US salary data
# Register: https://data.bls.gov/registrationEngine/
BLS_API_KEY="xxx"

# Adzuna (international salary data)
# Register: https://developer.adzuna.com/
ADZUNA_APP_ID="xxx"
ADZUNA_APP_KEY="xxx"

# DashaMail (email applications)
DASHAMAIL_API_KEY="xxx"
DASHAMAIL_FROM_EMAIL="info@freelanly.com"
DASHAMAIL_LIST_ID="xxx"

# Stripe (payments)
STRIPE_SECRET_KEY="sk_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_xxx"

# Cron security
CRON_SECRET="your-random-secret"
```

---

## Deployment

### Option 1: Vercel (recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

**Required Environment Variables in Vercel Dashboard:**
- `DATABASE_URL` — Neon PostgreSQL connection string
- `AUTH_SECRET` — NextAuth secret (generate: `openssl rand -base64 32`)
- `AUTH_URL` — `https://freelanly.com`
- `DEEPSEEK_API_KEY`, `APIFY_API_TOKEN`, `APOLLO_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- All other env vars from `.env.example`

**DNS Configuration (Cloudflare):**
```
freelanly.com  → A    → 76.76.21.21 (or Vercel-provided IP)
www            → CNAME → cname.vercel-dns.com
```

**Note:** `prisma generate` runs automatically during build (configured in `package.json`).

### Option 2: PM2 (VPS backup)

```bash
# Initial setup
cd /opt
git clone https://github.com/Fedor-K/Freelanly2.git freelanly2
cd freelanly2

npm install
cp .env.example .env
nano .env  # fill in variables

npx prisma db push
npm run build

# Start on port 3001
pm2 start npm --name "freelanly" -- start -- -p 3001
pm2 save
pm2 startup  # auto-start after reboot

# Setup daily cron (runs at 6:00 UTC)
echo '0 6 * * * curl -s -X POST http://localhost:3000/api/cron/fetch-sources -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/freelanly-cron.log 2>&1' | crontab -
```

### Update (PM2)

```bash
cd /opt/freelanly2
git pull
npm install           # if dependencies changed
npx prisma db push    # if schema changed
npm run build
pm2 restart freelanly
```

### Option 2: Docker

```bash
cd /opt
git clone https://github.com/Fedor-K/Freelanly2.git freelanly
cd freelanly
cp .env.example .env
nano .env

docker compose up -d --build
```

### With Nginx + SSL

```bash
apt install nginx certbot python3-certbot-nginx -y
cp deploy/nginx.conf /etc/nginx/sites-available/freelanly
ln -s /etc/nginx/sites-available/freelanly /etc/nginx/sites-enabled/
certbot --nginx -d your-domain.com
nginx -t && systemctl reload nginx
```

---

## NPM Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:push      # Push schema to database
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed initial data
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Reset DB + reseed
```

---

## Database Schema

See full schema: [prisma/schema.prisma](prisma/schema.prisma)

### Core Models

```
User            → Stripe integration, plan management
Company         → Logo, website, ATS integration, enrichment
Category        → 21 categories with hierarchy support
Job             → Dual source support (ATS/LinkedIn)
Application     → Email tracking
ImportLog       → Job import tracking
DataSource      → Configured import sources
SalaryBenchmark → Cached salary market data (30-day TTL)
```

### Key Job Fields

```prisma
model Job {
  // Basic
  title           String
  description     String

  // Category (21 options)
  category        Category

  // LinkedIn-specific (Dual Display)
  sourceType      SourceType    // STRUCTURED vs UNSTRUCTURED
  originalContent String?       // Original post text
  authorLinkedIn  String?       // Post author URL

  // Quality & Freshness
  qualityScore    Int           // 0-100 score
  postedAt        DateTime      // For 30-day freshness
  salaryIsEstimate Boolean      // Transparency
}
```

---

## Current Status

- [x] Project structure
- [x] Database schema with 21 categories
- [x] Basic pages (Home, Jobs, Job Detail)
- [x] DeepSeek integration (extraction + categorization)
- [x] Apify integration
- [x] Lever ATS integration
- [x] **RemoteOK integration**
- [x] **WeWorkRemotely integration**
- [x] **HackerNews Who is Hiring integration**
- [x] DashaMail integration
- [x] Apollo.io company enrichment
- [x] LinkedIn processor with deduplication
- [x] Job filters (search, level, type)
- [x] 30-day job freshness
- [x] **Auto cleanup of old jobs**
- [x] **Daily cron job (6:00 UTC)**
- [x] Docker deployment
- [x] Admin panel for sources
- [x] Maintenance scripts
- [x] **Salary Insights** (BLS + Adzuna + coefficients)
- [x] **Real salary from job postings** (when available)
- [x] **Authentication** (NextAuth v5 with Google OAuth + Magic Link)
- [x] **User Dashboard** (saved jobs, alerts, settings)
- [x] **Job Alerts** with translation-specific filters (language pairs)
- [x] **Email notifications for job alerts** (DAILY cron at 7:00 UTC)
- [x] **n8n webhook integration** — real-time LinkedIn posts via `/api/webhooks/linkedin-posts`
- [x] **Fuzzy deduplication** — email domain + title similarity (60%+ threshold)
- [x] **Stripe payments** — Weekly €10, Monthly €20, Annual €192
- [x] **Vercel deployment** — primary hosting with auto-deploy from GitHub
- [ ] Application tracking
- [ ] WEEKLY alert frequency cron
- [ ] SEO landing pages generator

---

## License

Private project. All rights reserved.
