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
- **Lever ATS Integration** — импорт вакансий из корпоративных ATS
- **AI Extraction** — извлечение данных из постов через DeepSeek
- **21 категория** — точная классификация вакансий
- **Dual Display** — показываем и extracted facts, и оригинальный пост
- **SEO-First** — программные landing pages для органического трафика
- **Email Applications** — отклики через DashaMail с tracking
- **Company Enrichment** — автоматическое обогащение данных о компаниях через Apollo.io
- **30-дневная свежесть** — только актуальные вакансии (Google рекомендация)

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
| **Payments** | Stripe |
| **Hosting** | VPS + Docker / PM2 |

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
│  LinkedIn (Apify)          │  Lever ATS          │  Другие ATS  │
│  - Hiring posts            │  - API интеграция   │  (Greenhouse │
│  - Unstructured data       │  - Structured data  │   Ashby...)  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ОБРАБОТКА ДАННЫХ                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Дедупликация          │  2. AI Extraction   │  3. Category  │
│     - По sourceId/URL     │     - DeepSeek      │     - 21 cat  │
│     - По title+company    │     - Title/Salary  │     - AI + kw │
│     - Company matching    │     - Skills/Level  │     - Fallback│
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
│   ├── admin/                    # Admin panel
│   │   ├── sources/              # Manage data sources
│   │   └── logs/                 # Import logs
│   └── api/
│       ├── cron/
│       │   └── fetch-linkedin/   # LinkedIn import trigger
│       ├── webhooks/
│       │   └── apify/            # Apify webhook handler
│       └── admin/                # Admin API endpoints
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── jobs/
│       ├── JobCard.tsx
│       └── JobFilters.tsx        # Search filter component
│
├── lib/
│   ├── db.ts                     # Prisma client
│   ├── deepseek.ts               # DeepSeek AI (extraction + categorization)
│   ├── apify.ts                  # Apify client
│   ├── apollo.ts                 # Apollo.io enrichment
│   ├── dashamail.ts              # DashaMail email
│   ├── settings.ts               # DB settings store
│   └── utils.ts                  # Utilities (slugify, freshness, etc.)
│
├── services/
│   ├── linkedin-processor.ts     # LinkedIn → Job pipeline
│   ├── company-enrichment.ts     # Apollo.io enrichment queue
│   └── sources/
│       ├── lever-processor.ts    # Lever ATS processor
│       └── types.ts              # Shared types
│
├── config/
│   └── site.ts                   # Site config, 21 categories, levels, etc.
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

**Файлы:**
- `src/services/linkedin-processor.ts` → `processLinkedInPost()`

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

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/apify` | Apify run completion webhook |

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

### Option 1: PM2 (recommended)

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
- [x] DashaMail integration
- [x] Apollo.io company enrichment
- [x] LinkedIn processor with deduplication
- [x] Job filters (search, level, type)
- [x] 30-day job freshness
- [x] Docker deployment
- [x] Admin panel for sources
- [x] Maintenance scripts
- [ ] Authentication (NextAuth)
- [ ] Stripe payments
- [ ] User dashboard
- [ ] Application tracking
- [ ] SEO landing pages generator

---

## License

Private project. All rights reserved.
