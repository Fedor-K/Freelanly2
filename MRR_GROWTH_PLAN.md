# Freelanly 2.0 — План достижения $10,000 MRR к маю 2026

## Текущее состояние (декабрь 2024)

| Метрика | Значение |
|---------|----------|
| **MRR** | $0 |
| **Вакансий в базе** | 1,000+ |
| **Категорий** | 21 |
| **Аутентификация** | ❌ Нет |
| **Платежи (Stripe)** | ❌ Нет |
| **Email отправка** | ❌ Нет (только UI) |
| **Аналитика** | ❌ Нет |
| **SEO** | ✅ Хорошая структура |
| **Salary Insights** | ✅ Готово (BLS + Adzuna) |

---

## Целевая структура дохода: $10,000 MRR

| Источник | Цена | Кол-во | Доход |
|----------|------|--------|-------|
| Job Seeker Pro | $19/мес | 350 | $6,650 |
| Employer Job Post | $99/вакансия | 35 | $3,465 |
| **Итого** | | | **$10,115** |

**Требуемые конверсии:**
- 50,000 visitors/мес → 0.7% → 350 Pro подписок
- 500 компаний в базе → 7% → 35 платных размещений

---

## Фаза 1: Монетизация (декабрь 2024 — январь 2025)

**Цель:** Запустить оплату и начать генерировать первые $$$

### 1.1 Аутентификация пользователей
- [ ] Установить NextAuth.js с Email Magic Link
- [ ] Создать страницы: `/login`, `/signup`, `/profile`
- [ ] Добавить OAuth: Google, GitHub, LinkedIn
- [ ] Session middleware для защищённых роутов

### 1.2 Stripe интеграция
- [ ] Установить `@stripe/stripe-js` + `stripe`
- [ ] Создать Stripe Products:
  - Job Seeker Pro: $19/month
  - Employer Basic: $99/job posting (one-time)
  - Employer Pro: $299/month (5 jobs)
- [ ] Webhooks для обработки подписок
- [ ] Billing Portal для управления подпиской
- [ ] Paywall logic: ограничение просмотров/откликов

### 1.3 Система лимитов
- [ ] Free: 20 просмотров/день, 5 откликов/месяц
- [ ] Счётчик в middleware с Redis/DB
- [ ] Upgrade prompts при достижении лимита

**Ожидаемый MRR после Фазы 1:** $500-1,000

---

## Фаза 2: Ценностное предложение (январь — февраль 2025)

**Цель:** Дать Pro пользователям реальную ценность

### 2.1 Система откликов через email
- [ ] Интеграция с Resend/SendGrid для отправки
- [ ] Email tracking (opens, clicks)
- [ ] Статус откликов в дашборде пользователя
- [ ] Уведомления об ответах

### 2.2 AI Cover Letter Generator
- [ ] Интеграция DeepSeek для генерации
- [ ] Персонализация под вакансию + резюме
- [ ] A/B шаблоны
- [ ] Только для Pro пользователей

### 2.3 Saved Searches & Alerts
- [ ] Сохранение поисковых запросов
- [ ] Daily/Weekly email digest
- [ ] Push notifications (optional)

### 2.4 Advanced Filters (Pro only)
- [ ] Фильтр по зарплате (требует данные)
- [ ] Фильтр по размеру компании
- [ ] Скрыть просмотренные вакансии
- [ ] Сортировка по релевантности (AI)

**Ожидаемый MRR после Фазы 2:** $2,000-3,000

---

## Фаза 3: Рост трафика (февраль — март 2025)

**Цель:** 50,000+ monthly visitors через SEO

### 3.1 Программные Landing Pages
- [ ] Генератор страниц: категория × страна × уровень
- [ ] Уникальный контент для каждой (AI-generated)
- [ ] Internal linking strategy
- [ ] Таргет: 5,000+ проиндексированных страниц

### 3.2 Google Indexing API
- [ ] Завершить аутентификацию
- [ ] Автоматический submit новых вакансий
- [ ] Мониторинг индексации

### 3.3 Content Marketing
- [ ] Blog: 2-4 статьи/месяц
- [ ] Темы: "Remote Work in [Country]", "Salary Guide [Role]"
- [ ] Guest posting на relevant платформах

### 3.4 Аналитика
- [ ] Google Analytics 4
- [ ] Mixpanel/PostHog для product analytics
- [ ] Conversion funnels
- [ ] A/B testing framework

**Ожидаемый MRR после Фазы 3:** $4,000-5,000

---

## Фаза 4: B2B Монетизация (март — апрель 2025)

**Цель:** Добавить employer revenue stream

### 4.1 Employer Dashboard
- [ ] Регистрация компаний
- [ ] Управление вакансиями
- [ ] Аналитика: просмотры, отклики
- [ ] Candidate management (ATS-lite)

### 4.2 Paid Job Posting
- [ ] Self-serve posting flow
- [ ] Featured placement (+$50/week)
- [ ] Boost expiring jobs
- [ ] Bulk posting discounts

### 4.3 Company Profiles
- [ ] Verified badge ($199 one-time)
- [ ] Custom branding
- [ ] Team page
- [ ] Culture content

### 4.4 Outreach Campaign
- [ ] Email campaign to companies in DB
- [ ] LinkedIn outreach (HR managers)
- [ ] Partnership с remote-first компаниями

**Ожидаемый MRR после Фазы 4:** $7,000-8,000

---

## Фаза 5: Оптимизация и масштаб (апрель — май 2025)

**Цель:** Достичь $10,000 MRR

### 5.1 Conversion Optimization
- [ ] A/B тесты pricing page
- [ ] Onboarding flow optimization
- [ ] Reduce churn (email sequences)
- [ ] Upgrade prompts optimization

### 5.2 Referral Program
- [ ] Job seekers: Give $5, Get $5
- [ ] Employers: 10% commission
- [ ] Viral loops

### 5.3 API Access (Enterprise)
- [ ] REST API для доступа к вакансиям
- [ ] Usage-based pricing
- [ ] Rate limiting
- [ ] Documentation

### 5.4 Mobile App (optional)
- [ ] PWA optimization
- [ ] Push notifications
- [ ] Quick apply

**Целевой MRR к маю 2026:** $10,000+

---

## Технические приоритеты (в порядке важности)

### CRITICAL (блокирует revenue)
1. ⚡ NextAuth.js аутентификация
2. ⚡ Stripe интеграция (подписки + one-time)
3. ⚡ Paywall middleware
4. ⚡ Email sending (откликов)

### HIGH (увеличивает конверсию)
5. AI Cover Letter генератор
6. Email tracking
7. Saved searches + alerts
8. User dashboard

### MEDIUM (рост трафика)
9. Google Analytics
10. Landing page generator
11. Google Indexing API
12. Blog/Content system

### LOW (nice to have)
13. Employer dashboard
14. API access
15. Mobile PWA

---

## KPI и метрики для отслеживания

### Weekly
- [ ] New signups
- [ ] Trial → Paid conversion
- [ ] Churn rate
- [ ] Revenue (MRR)

### Monthly
- [ ] Traffic (visitors, pageviews)
- [ ] SEO rankings (target keywords)
- [ ] Application success rate
- [ ] NPS score

### Quarterly
- [ ] CAC (Customer Acquisition Cost)
- [ ] LTV (Lifetime Value)
- [ ] LTV/CAC ratio (target: >3)
- [ ] Revenue per employee

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Низкая конверсия в Pro | Высокая | A/B тесты, value-add features |
| Высокий churn | Средняя | Email retention, better UX |
| SEO конкуренция | Средняя | Niche focus, quality content |
| API costs (DeepSeek, Adzuna) | Низкая | Caching, rate limits |
| Stripe compliance | Низкая | Proper KYC, terms |

---

## Ресурсы и бюджет

### Инфраструктура ($/мес)
- Vercel Pro: $20
- Neon DB: $25
- Redis (Upstash): $10
- Resend: $20
- Apify: $50
- DeepSeek: $20
- **Total:** ~$150/мес

### При $10K MRR
- Margin: ~98.5%
- Net profit: ~$9,850/мес

---

## Следующие шаги (на этой неделе)

1. **[СЕГОДНЯ]** Установить NextAuth.js
2. **[СЕГОДНЯ]** Создать Stripe account и products
3. **[ЗАВТРА]** Реализовать login/signup flow
4. **[ЗАВТРА]** Интегрировать Stripe Checkout
5. **[НЕДЕЛЯ]** Paywall + limits система
6. **[НЕДЕЛЯ]** Базовый user dashboard

---

## Команда

- **Claude (AI)**: Full-stack development, architecture
- **Fedor**: Product decisions, business strategy, marketing

---

*План обновляется по мере прогресса. Последнее обновление: декабрь 2024*
