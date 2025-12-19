# Freelanly 2.0

SEO-оптимизированная платформа для поиска удалённых вакансий с агрегацией из LinkedIn и ATS систем.

## Концепция

Freelanly агрегирует hiring-посты из LinkedIn, извлекает структурированные данные с помощью AI, и позволяет пользователям откликаться на вакансии напрямую через email.

### Ключевые особенности

- **LinkedIn Integration** — парсинг hiring-постов через Apify
- **AI Extraction** — извлечение данных из постов через DeepSeek
- **Dual Display** — показываем и extracted facts, и оригинальный пост (честность = доверие)
- **SEO-First** — 13,500+ программных landing pages для органического трафика
- **Email Applications** — отклики через DashaMail с tracking

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Database** | PostgreSQL (Neon) |
| **ORM** | Prisma 7 |
| **AI** | DeepSeek API |
| **Scraping** | Apify |
| **Email** | DashaMail |
| **Payments** | Stripe |
| **Hosting** | VPS + Docker |

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

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"

# App
NEXT_PUBLIC_APP_URL="https://freelanly.com"

# DeepSeek AI (job extraction)
DEEPSEEK_API_KEY="sk-xxx"

# Apify (LinkedIn scraping)
APIFY_API_TOKEN="apify_api_xxx"

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

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Homepage
│   ├── jobs/
│   │   └── page.tsx              # Job listings
│   ├── job/
│   │   └── [slug]/
│   │       └── page.tsx          # Job detail (Dual Display)
│   └── api/
│       └── cron/
│           └── fetch-linkedin/
│               └── route.ts      # LinkedIn import endpoint
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── jobs/
│       └── JobCard.tsx
│
├── lib/
│   ├── db.ts                     # Prisma client
│   ├── deepseek.ts               # DeepSeek AI client
│   ├── apify.ts                  # Apify client
│   ├── dashamail.ts              # DashaMail client
│   └── utils.ts                  # Utilities
│
├── services/
│   └── linkedin-processor.ts     # LinkedIn → Job pipeline
│
├── config/
│   └── site.ts                   # Site config, categories
│
└── types/
    └── index.ts                  # TypeScript types

prisma/
├── schema.prisma                 # Database schema
└── seed.ts                       # Seed script
```

---

## Database Schema

### Core Models

```
User            → Stripe integration, plan management
Company         → Logo, website, ATS integration
Category        → Hierarchy support for SEO
Job             → Dual source support (ATS/LinkedIn)
Application     → Email tracking
LandingPage     → SEO programmatic pages
ImportLog       → Job import tracking
```

### Key Job Fields

```prisma
model Job {
  // Basic
  title           String
  description     String

  // LinkedIn-specific (Dual Display)
  sourceType      SourceType    // STRUCTURED vs UNSTRUCTURED
  originalContent String?       // Original post text
  authorLinkedIn  String?       // Post author URL

  // Quality
  qualityScore    Int           // 0-100 score
  salaryIsEstimate Boolean      // Transparency
}
```

See full schema: [prisma/schema.prisma](prisma/schema.prisma)

---

## LinkedIn Processing Pipeline

```
┌─────────────────┐
│  Apify Actor    │  Scrape hiring posts from LinkedIn
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DeepSeek AI    │  Extract: title, company, salary, skills, level
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Company        │  Find/create company, enrich from LinkedIn
│  Enrichment     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Quality Score  │  Calculate score based on data completeness
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │  Save job with Dual Display data
└─────────────────┘
```

### Run Import

```bash
# Via API
curl -X POST http://localhost:3000/api/cron/fetch-linkedin \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Or setup cron (every 6 hours)
0 */6 * * * curl -X POST https://your-domain.com/api/cron/fetch-linkedin -H "Authorization: Bearer secret"
```

---

## Dual Display Feature

LinkedIn posts ≠ structured job descriptions. We solve trust issues by showing BOTH:

```
┌──────────────────────────────────────────────┐
│  Senior React Developer at Acme Corp         │
│  Remote · $120-160k (estimated)              │
├──────────────────────────────────────────────┤
│  📋 EXTRACTED FACTS                          │
│  ─────────────────                           │
│  • Role: Senior Frontend Developer           │
│  • Skills: React, TypeScript, Node.js        │
│  • Level: Senior                             │
│  • Remote: Yes                               │
├──────────────────────────────────────────────┤
│  💬 ORIGINAL LINKEDIN POST                   │
│  ─────────────────────────                   │
│  "Hey network! 🚀 We're growing at Acme...   │
│   Looking for a Senior React Developer..."   │
│                                              │
│  Posted by John Doe · 2 days ago             │
├──────────────────────────────────────────────┤
│  [View on LinkedIn]  [Apply via Email]       │
└──────────────────────────────────────────────┘
```

**Why?** Users see exactly what they'll find on LinkedIn. No fake descriptions.

---

## SEO Architecture

### URL Structure

```
/jobs                           → All jobs
/jobs/[category]                → /jobs/frontend
/jobs/[category]/[level]        → /jobs/frontend/senior
/job/[slug]                     → Individual job page
/companies/[slug]               → Company page
/remote-[category]-jobs         → SEO landing pages
```

### Programmatic Pages

50+ categories × 30+ locations × levels = **13,500+ unique pages**

Examples:
- `/remote-react-developer-jobs-germany`
- `/senior-devops-engineer-jobs-remote`

---

## NPM Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:push      # Push schema to database
npm run db:seed      # Seed initial data
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Reset DB + reseed
```

---

## Deployment

### Option 1: PM2 (recommended)

```bash
# Первая установка
cd /opt
git clone https://github.com/Fedor-K/Freelanly2.git freelanly2
cd freelanly2

npm install
cp .env.example .env
nano .env  # заполнить переменные

npx prisma db push
npm run build

# Запуск на порту 3001
pm2 start npm --name "freelanly" -- start -- -p 3001
pm2 save
pm2 startup  # автозапуск после перезагрузки
```

### Обновление (PM2)

```bash
cd /opt/freelanly2
git pull
npm install           # если изменились зависимости
npx prisma db push    # если изменилась схема БД
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

### Обновление (Docker)

```bash
cd /opt/freelanly
git pull
docker compose up -d --build
```

### С Nginx + SSL

```bash
apt install nginx certbot python3-certbot-nginx -y
cp deploy/nginx.conf /etc/nginx/sites-available/freelanly
ln -s /etc/nginx/sites-available/freelanly /etc/nginx/sites-enabled/
certbot --nginx -d your-domain.com
nginx -t && systemctl reload nginx
```

See full guide: [deploy/DEPLOY.md](deploy/DEPLOY.md)

---

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | Job listings page |
| GET | `/job/[slug]` | Job detail page |
| GET | `/companies` | Companies page |

### Internal (require auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cron/fetch-linkedin` | Trigger LinkedIn import |

---

## Monetization

| Feature | Free | Pro ($19/mo) |
|---------|------|--------------|
| View jobs | 20/day | Unlimited |
| Applications | 5/month | 100/month |
| Salary insights | Limited | Full |
| Email tracking | No | Yes |

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## Files Overview

| File | Purpose |
|------|---------|
| `PLAN.md` | Detailed project plan and architecture |
| `deploy/DEPLOY.md` | VPS deployment guide |
| `deploy/nginx.conf` | Nginx configuration |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Initial data seeding |

---

## Current Status

- [x] Project structure
- [x] Database schema
- [x] Basic pages (Home, Jobs, Job Detail)
- [x] DeepSeek integration
- [x] Apify integration
- [x] DashaMail integration
- [x] LinkedIn processor service
- [x] Docker deployment
- [ ] Authentication (NextAuth)
- [ ] Stripe payments
- [ ] User dashboard
- [ ] Application tracking
- [ ] SEO landing pages generator

---

## License

Private project. All rights reserved.
