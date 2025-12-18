# Freelanly 2.0 - SEO-First Remote Jobs Platform

## Концепция

Чистая, быстрая платформа для поиска удалённых вакансий с killer SEO структурой, агрегацией из LinkedIn/ATS и встроенной системой откликов.

---

## SEO-Архитектура (как у RemoteRocketship, но лучше)

### URL Структура

```
/                                    # Главная - "Remote Jobs"
/jobs                                # Все вакансии
/jobs/[category]                     # /jobs/frontend, /jobs/devops
/jobs/[category]/[level]             # /jobs/frontend/senior
/jobs/[category]/[location]          # /jobs/frontend/usa
/jobs/[category]/[type]              # /jobs/frontend/part-time

/remote-[category]-jobs              # /remote-frontend-jobs (альтернативный landing)
/[category]-jobs-[location]          # /frontend-jobs-germany

/companies                           # Список компаний
/companies/[slug]                    # /companies/google
/companies/[slug]/jobs               # Вакансии компании

/job/[slug]                          # Отдельная вакансия
/job/[company]-[title]-[id]          # /job/google-senior-frontend-engineer-abc123

/salaries                            # Зарплаты по категориям
/salaries/[category]                 # /salaries/frontend
/salaries/[category]/[location]      # /salaries/frontend/usa

/blog                                # SEO контент
/blog/[slug]                         # Статьи

/locations/[country]                 # /locations/germany
/locations/[country]/[city]          # /locations/germany/berlin
```

### Программные Landing Pages (для SEO трафика)

Автогенерация страниц на комбинациях:
- 50+ категорий × 30+ стран × 3 уровня × 3 типа = **13,500+ уникальных страниц**

Примеры:
- `/remote-senior-react-developer-jobs-germany`
- `/entry-level-data-analyst-jobs-remote`
- `/part-time-ux-designer-jobs-usa`

---

## Tech Stack

### Frontend
- **Next.js 14** (App Router) - SSR/SSG для SEO
- **Tailwind CSS** - быстрая стилизация
- **shadcn/ui** - компоненты
- **TypeScript** - типизация

### Backend
- **Next.js API Routes** - простота деплоя
- **Prisma** - ORM
- **PostgreSQL** (Neon/Supabase) - основная БД
- **Redis** (Upstash) - кэширование, очереди

### Infrastructure
- **Vercel** - хостинг (не Replit!)
- **Cloudflare** - CDN, защита
- **Resend** - отправка email откликов
- **Stripe** - платежи (миграция существующих)
- **Apify** - парсинг LinkedIn
- **Cron jobs** - обновление вакансий

---

## Основные Фичи

### 1. Агрегация Вакансий

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   LinkedIn      │────▶│              │────▶│             │
│   (via Apify)   │     │   Job        │     │  PostgreSQL │
├─────────────────┤     │   Processor  │     │             │
│   ATS APIs      │────▶│   (dedup,    │────▶│  + Redis    │
│   (Greenhouse,  │     │   normalize, │     │  Cache      │
│   Lever, etc)   │     │   enrich)    │     │             │
├─────────────────┤     │              │     │             │
│   RSS Feeds     │────▶│              │────▶│             │
└─────────────────┘     └──────────────┘     └─────────────┘
```

**Источники:**
- LinkedIn Jobs (Apify actor)
- Greenhouse API
- Lever API
- Ashby API
- Workable API
- RSS фиды компаний
- Прямой скрапинг career pages

### 2. Система Откликов (Email)

```typescript
// Пользователь откликается → мы отправляем email от его имени
{
  from: "user@freelanly.com", // или их личный если верифицирован
  replyTo: "user-real-email@gmail.com",
  to: "hr@company.com",
  subject: "Application: Senior Frontend Developer",
  body: customCoverLetter + attachedResume
}
```

**Фичи:**
- Шаблоны откликов
- AI-генерация cover letter
- Tracking открытий/ответов
- История откликов

### 3. Монетизация (Freemium)

| Feature | Free | Pro ($19/mo) | Enterprise |
|---------|------|--------------|------------|
| Просмотр вакансий | ✅ | ✅ | ✅ |
| Вакансий в день | 20 | Unlimited | Unlimited |
| Отклики в месяц | 5 | 100 | Unlimited |
| AI Cover Letter | ❌ | ✅ | ✅ |
| Email tracking | ❌ | ✅ | ✅ |
| Salary insights | Limited | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |

---

## Database Schema

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  stripeId      String?   @unique  // миграция существующих
  plan          Plan      @default(FREE)
  applications  Application[]
  savedJobs     SavedJob[]
  createdAt     DateTime  @default(now())
}

model Job {
  id            String    @id @default(cuid())
  slug          String    @unique
  title         String
  company       Company   @relation(fields: [companyId], references: [id])
  companyId     String

  // SEO fields
  category      Category  @relation(fields: [categoryId], references: [id])
  categoryId    String
  location      String    // "Remote", "USA", "Germany"
  locationType  LocationType // WORLDWIDE, COUNTRY, CITY
  level         Level     // ENTRY, MID, SENIOR, LEAD
  type          JobType   // FULL_TIME, PART_TIME, CONTRACT

  // Content
  description   String
  requirements  String[]
  salaryMin     Int?
  salaryMax     Int?
  salaryCurrency String?

  // Source
  source        Source    // LINKEDIN, GREENHOUSE, LEVER, etc
  sourceUrl     String
  sourceId      String?
  applyEmail    String?   // для email откликов
  applyUrl      String?   // для redirect откликов

  // Meta
  isActive      Boolean   @default(true)
  postedAt      DateTime
  expiresAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  applications  Application[]

  @@index([category, location, level, type])
  @@index([companyId])
  @@index([postedAt])
}

model Company {
  id            String    @id @default(cuid())
  slug          String    @unique
  name          String
  logo          String?
  website       String?
  description   String?
  size          CompanySize?
  industry      String?

  // ATS integration
  atsType       ATSType?  // GREENHOUSE, LEVER, etc
  atsId         String?   // board token

  jobs          Job[]

  @@index([slug])
}

model Category {
  id            String    @id @default(cuid())
  slug          String    @unique  // "frontend", "devops"
  name          String    // "Frontend Development"
  description   String?   // SEO description
  parentId      String?
  parent        Category? @relation("SubCategories", fields: [parentId], references: [id])
  children      Category[] @relation("SubCategories")

  jobs          Job[]

  @@index([slug])
}

model Application {
  id            String    @id @default(cuid())
  user          User      @relation(fields: [userId], references: [id])
  userId        String
  job           Job       @relation(fields: [jobId], references: [id])
  jobId         String

  coverLetter   String?
  resumeUrl     String?

  status        ApplicationStatus @default(SENT)
  sentAt        DateTime  @default(now())
  openedAt      DateTime?
  repliedAt     DateTime?

  @@unique([userId, jobId])
}

model LandingPage {
  id            String    @id @default(cuid())
  slug          String    @unique  // "remote-senior-react-jobs-germany"

  // Filters for this page
  category      String?
  location      String?
  level         String?
  type          String?

  // SEO
  title         String    // "Senior React Developer Jobs in Germany"
  description   String    // Meta description
  h1            String    // Page heading
  content       String?   // Additional SEO content

  // Stats (updated daily)
  jobCount      Int       @default(0)
  avgSalary     Int?

  @@index([slug])
}

enum Plan { FREE, PRO, ENTERPRISE }
enum Level { ENTRY, JUNIOR, MID, SENIOR, LEAD, EXECUTIVE }
enum JobType { FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP }
enum LocationType { WORLDWIDE, CONTINENT, COUNTRY, STATE, CITY }
enum Source { LINKEDIN, GREENHOUSE, LEVER, ASHBY, WORKABLE, RSS, MANUAL }
enum ATSType { GREENHOUSE, LEVER, ASHBY, WORKABLE, BAMBOO }
enum ApplicationStatus { DRAFT, SENT, OPENED, REPLIED, REJECTED, HIRED }
enum CompanySize { STARTUP, SMALL, MEDIUM, LARGE, ENTERPRISE }
```

---

## Project Structure

```
freelanly2/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Landing pages
│   │   ├── page.tsx              # Homepage
│   │   ├── pricing/
│   │   └── about/
│   │
│   ├── (app)/                    # Authenticated area
│   │   ├── dashboard/
│   │   ├── applications/
│   │   ├── saved/
│   │   └── settings/
│   │
│   ├── jobs/                     # Job listings (SEO)
│   │   ├── page.tsx              # /jobs
│   │   ├── [category]/
│   │   │   ├── page.tsx          # /jobs/frontend
│   │   │   └── [filter]/
│   │   │       └── page.tsx      # /jobs/frontend/senior
│   │
│   ├── job/
│   │   └── [slug]/
│   │       └── page.tsx          # Individual job page
│   │
│   ├── companies/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   ├── [landingSlug]/            # Dynamic SEO landing pages
│   │   └── page.tsx              # /remote-react-jobs-germany
│   │
│   ├── api/
│   │   ├── jobs/
│   │   ├── applications/
│   │   ├── webhooks/
│   │   │   ├── stripe/
│   │   │   └── apify/
│   │   └── cron/
│   │       ├── fetch-linkedin/
│   │       ├── fetch-ats/
│   │       └── update-stats/
│   │
│   ├── sitemap.ts                # Dynamic sitemap
│   └── robots.ts
│
├── components/
│   ├── ui/                       # shadcn components
│   ├── jobs/
│   │   ├── JobCard.tsx
│   │   ├── JobList.tsx
│   │   ├── JobFilters.tsx
│   │   └── ApplyModal.tsx
│   ├── layout/
│   └── seo/
│       ├── StructuredData.tsx    # JSON-LD
│       └── MetaTags.tsx
│
├── lib/
│   ├── db.ts                     # Prisma client
│   ├── redis.ts                  # Redis client
│   ├── stripe.ts                 # Stripe utilities
│   ├── email.ts                  # Resend client
│   └── apify.ts                  # Apify client
│
├── services/
│   ├── jobs/
│   │   ├── linkedin-fetcher.ts
│   │   ├── ats-fetcher.ts
│   │   ├── job-processor.ts
│   │   └── job-deduplicator.ts
│   ├── applications/
│   │   └── email-sender.ts
│   └── seo/
│       ├── landing-generator.ts
│       └── sitemap-generator.ts
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
└── scripts/
    ├── migrate-users.ts          # Миграция из старой БД
    └── generate-landings.ts      # Генерация SEO страниц
```

---

## SEO Оптимизации

### 1. Structured Data (JSON-LD)

```typescript
// Для каждой вакансии
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Senior Frontend Developer",
  "description": "...",
  "datePosted": "2024-01-15",
  "validThrough": "2024-02-15",
  "employmentType": "FULL_TIME",
  "jobLocationType": "TELECOMMUTE",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Google",
    "sameAs": "https://google.com"
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "USD",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": 150000,
      "maxValue": 200000,
      "unitText": "YEAR"
    }
  }
}
```

### 2. Internal Linking

- Каждая страница категории линкует на подкатегории
- Каждая вакансия линкует на компанию и категорию
- Footer с links на топ категории/локации
- Breadcrumbs на всех страницах

### 3. Content Strategy

- Уникальные описания для каждой landing page
- Статистика (средняя ЗП, количество вакансий)
- FAQ секции с schema markup
- Blog с таргетингом на long-tail keywords

---

## Миграция Существующих Пользователей

```typescript
// scripts/migrate-users.ts
async function migrateUsers() {
  // 1. Экспорт из старой БД
  const oldUsers = await oldDb.query('SELECT * FROM users');

  // 2. Создание в новой БД с сохранением stripe_customer_id
  for (const user of oldUsers) {
    await prisma.user.create({
      data: {
        email: user.email,
        stripeId: user.stripe_customer_id,
        plan: user.is_premium ? 'PRO' : 'FREE',
        // ... остальные поля
      }
    });
  }

  // 3. Верификация подписок в Stripe
  // Все существующие подписки продолжат работать
}
```

---

## Фазы Разработки

### Phase 1: Foundation (MVP)
- [ ] Настройка Next.js + Prisma + PostgreSQL
- [ ] Базовая auth (NextAuth или Clerk)
- [ ] Схема БД и миграции
- [ ] UI kit (shadcn)
- [ ] Базовые страницы (home, jobs list, job detail)

### Phase 2: Job Aggregation
- [ ] LinkedIn fetcher через Apify
- [ ] Greenhouse/Lever API интеграция
- [ ] Job processor (дедупликация, нормализация)
- [ ] Cron jobs для обновления

### Phase 3: SEO Machine
- [ ] Генератор landing pages
- [ ] Structured data
- [ ] Sitemap генерация
- [ ] Базовый blog

### Phase 4: Applications
- [ ] Email система откликов
- [ ] Шаблоны cover letter
- [ ] AI генерация (опционально)
- [ ] Tracking откликов

### Phase 5: Monetization
- [ ] Stripe интеграция
- [ ] Миграция существующих пользователей
- [ ] Paywall logic
- [ ] Billing portal

### Phase 6: Polish
- [ ] Performance оптимизация
- [ ] Analytics
- [ ] A/B testing
- [ ] Mobile оптимизация

---

## Immediate Next Steps

1. **Инициализация проекта** - Next.js, TypeScript, Tailwind, shadcn
2. **Настройка БД** - Prisma schema, PostgreSQL на Neon
3. **Базовая структура** - layouts, routing, компоненты
4. **Seed data** - категории, тестовые вакансии

Готов начать?
