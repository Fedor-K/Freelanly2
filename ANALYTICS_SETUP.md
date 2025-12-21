# Настройка аналитики Freelanly

## Автоматический сбор данных

Система автоматически собирает данные из:
- ✅ **Яндекс.Метрика API** — трафик, поведение, цели
- ✅ **DashaMail API** — подписчики, рассылки, open/click rate
- ✅ **Google Sheets** — ручные данные (соцсети, etc.)
- ✅ **Внутренняя БД** — вакансии, компании, пользователи

---

## Шаг 1: Создай счётчики (5 минут)

### Яндекс.Метрика
1. Зайди на https://metrika.yandex.ru
2. Добавить счётчик → Имя: "Freelanly"
3. Включи: Вебвизор, Карта кликов, Аналитика форм
4. Скопируй **номер счётчика** (например: 12345678)

### Google Analytics 4
1. Зайди на https://analytics.google.com
2. Admin → Create Property → "Freelanly"
3. Create Web Stream → твой домен
4. Скопируй **Measurement ID** (например: G-XXXXXXXXXX)

### Google Search Console
1. Зайди на https://search.google.com/search-console
2. Add property → URL prefix → твой домен
3. Verify через HTML tag или DNS

### Microsoft Clarity (опционально, но полезно)
1. Зайди на https://clarity.microsoft.com
2. New Project → "Freelanly"
3. Скопируй **Project ID**

---

## Шаг 2: Получи API токены

### Яндекс.Метрика API Token (для автоматического сбора данных)

1. Зайди на https://oauth.yandex.ru/client/new
2. Создай приложение:
   - Название: "Freelanly Analytics"
   - Платформы: Веб-сервисы
   - Callback URL: `https://oauth.yandex.ru/verification_code`
3. Права: `metrika:read`
4. Получи **Client ID**
5. Перейди по ссылке:
   ```
   https://oauth.yandex.ru/authorize?response_type=token&client_id=ВАШ_CLIENT_ID
   ```
6. Скопируй **access_token** из URL после авторизации

### DashaMail API

API ключ уже должен быть в настройках DashaMail:
1. Зайди в DashaMail → Настройки → API
2. Скопируй API ключ

---

## Шаг 3: Добавь в .env

```bash
# ===== FRONTEND (для скриптов на странице) =====

# Яндекс.Метрика
NEXT_PUBLIC_YANDEX_METRIKA_ID=12345678

# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Microsoft Clarity (опционально)
NEXT_PUBLIC_CLARITY_ID=xxxxxxxxxx

# ===== BACKEND (для API запросов) =====

# Яндекс.Метрика API (для автоматического сбора)
YANDEX_METRIKA_TOKEN=ваш_oauth_токен
YANDEX_METRIKA_COUNTER_ID=12345678

# DashaMail (уже должен быть)
DASHAMAIL_API_KEY=ваш_ключ
DASHAMAIL_LIST_ID=id_списка

# Google Sheets (опционально)
ANALYTICS_SHEET_ID=id_таблицы
```

---

## Шаг 3: Добавь скрипты в layout

В `src/app/layout.tsx`:

```tsx
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <AnalyticsScripts />
      </body>
    </html>
  );
}
```

---

## Шаг 4: Настрой цели в Яндекс.Метрике

Зайди в Метрику → Настройка → Цели → Добавить цель

### Критичные цели (🔴 настрой первыми):

| Название | Тип | Идентификатор |
|----------|-----|---------------|
| Подписка на вакансии | JavaScript-событие | `job_alert_subscribe` |
| Клик Apply | JavaScript-событие | `job_apply_click` |
| Клик Upgrade | JavaScript-событие | `upgrade_click` |
| Регистрация | JavaScript-событие | `signup` |

### Важные цели (🟡):

| Название | Тип | Идентификатор |
|----------|-----|---------------|
| Просмотр вакансии | JavaScript-событие | `job_view` |
| Сохранение вакансии | JavaScript-событие | `job_save` |
| Поиск | JavaScript-событие | `job_search` |

---

## Шаг 5: Включи в GA4 Enhanced Measurement

Google Analytics → Admin → Data Streams → твой stream → Enhanced measurement

Включи:
- ✅ Page views
- ✅ Scrolls
- ✅ Outbound clicks
- ✅ Site search
- ✅ Form interactions

---

## Шаг 6: Настрой конверсии в GA4

Admin → Events → Mark as conversion:

- ✅ `job_alert_subscribe`
- ✅ `job_apply_click`
- ✅ `upgrade_click`
- ✅ `signup`

---

## Как использовать трекинг в коде

```tsx
import { track } from '@/lib/analytics';

// При просмотре вакансии
track({
  name: 'job_view',
  params: {
    job_id: job.id,
    category: job.category.slug,
    level: job.level,
    company: job.company.name,
  },
});

// При клике на Apply
track({
  name: 'job_apply_click',
  params: {
    job_id: job.id,
    method: 'email', // или 'url', 'linkedin'
  },
});

// При подписке на alerts
track({
  name: 'job_alert_subscribe',
  params: {
    category: 'frontend',
    keywords: 'react',
  },
});

// При апгрейде
track({
  name: 'upgrade_click',
  params: {
    source: 'paywall', // откуда пришёл
  },
});
```

---

## Что отслеживать в дашбордах

### Ежедневно (5 мин):

**Яндекс.Метрика:**
- Визиты и посетители
- Источники трафика
- Топ страницы
- Вебвизор (2-3 записи)

**Google Analytics:**
- Users / Sessions
- Engagement rate
- Top events

### Еженедельно (15 мин):

**Метрика:**
- Достижение целей (воронка)
- Карта кликов на главной и /jobs
- Аналитика форм (где бросают)

**Search Console:**
- Impressions / Clicks
- Top queries
- Index coverage

### Ежемесячно (30 мин):

- Сравнение с прошлым месяцем
- Анализ трендов
- Корректировка стратегии

---

## Воронка конверсии

```
Visitor
   ↓ (100%)
Job Page View
   ↓ (~30%)
Job Alert Signup OR Apply Click
   ↓ (~5-10%)
Registration
   ↓ (~2-5%)
Pro Upgrade
```

**Цель:** оптимизировать каждый шаг воронки.

---

## Готово!

После настройки данные начнут собираться автоматически.
Первые insights появятся через 24-48 часов.
