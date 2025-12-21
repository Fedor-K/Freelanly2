# Подключение Google Sheets для аналитики

## Шаг 1: Создай копию шаблона

**Ссылка на шаблон:** [Создай таблицу по структуре ниже]

Или создай новую таблицу с двумя листами:

---

## Лист 1: "Config" (основные данные)

| key | value |
|-----|-------|
| domain | freelanly.com |
| launch_date | 2024-01-15 |
| current_mrr | 0 |
| current_users | 0 |
| paid_users | 0 |
| | |
| **LinkedIn Personal** | |
| linkedin_personal_url | https://linkedin.com/in/yourname |
| linkedin_personal_followers | 500 |
| | |
| **LinkedIn Company** | |
| linkedin_company_url | |
| linkedin_company_followers | 0 |
| | |
| **TikTok** | |
| tiktok_url | |
| tiktok_followers | 0 |
| | |
| **Instagram** | |
| instagram_url | |
| instagram_followers | 0 |
| | |
| **Twitter** | |
| twitter_url | |
| twitter_followers | 0 |
| | |
| **Telegram** | |
| telegram_url | |
| telegram_followers | 0 |
| | |
| **Traffic (last 30 days)** | |
| traffic_total | 0 |
| traffic_unique | 0 |
| traffic_pageviews | 0 |
| traffic_avg_duration | 0:00 |
| traffic_bounce_rate | 0 |
| | |
| **Traffic Sources (%)** | |
| source_organic | 0 |
| source_direct | 0 |
| source_social | 0 |
| source_referral | 0 |
| source_email | 0 |
| | |
| **SEO** | |
| seo_impressions | 0 |
| seo_clicks | 0 |
| seo_avg_position | 0 |
| seo_indexed_pages | 0 |
| | |
| **Email** | |
| email_total | 0 |
| email_active | 0 |
| email_job_alerts | 0 |
| email_open_rate | 0 |
| email_click_rate | 0 |
| | |
| **Content** | |
| jobs_total | 0 |
| jobs_active | 0 |
| companies_total | 0 |
| | |
| **Resources** | |
| hours_per_week | 10 |
| monthly_budget | 0 |
| | |
| **Priorities (1-5)** | |
| priority_paying_users | 5 |
| priority_traffic | 4 |
| priority_email | 3 |
| priority_content | 3 |
| priority_product | 2 |

---

## Лист 2: "Weekly" (еженедельные метрики)

| week | visitors | signups | job_views | applications | email_subs | linkedin | tiktok |
|------|----------|---------|-----------|--------------|------------|----------|--------|
| 2024-W51 | 100 | 5 | 500 | 10 | 3 | 500 | 0 |
| 2024-W52 | 150 | 8 | 750 | 15 | 5 | 520 | 0 |
| 2025-W01 | 200 | 12 | 1000 | 20 | 8 | 550 | 100 |

*Добавляй новую строку каждую неделю*

---

## Шаг 2: Сделай таблицу публичной

1. Открой таблицу в Google Sheets
2. Нажми **Файл → Поделиться → Опубликовать в интернете**
3. Выбери "Весь документ" и "CSV"
4. Нажми "Опубликовать"
5. Скопируй ID таблицы из URL

**URL таблицы:**
```
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
                                        ↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                                        Это твой Sheet ID
```

---

## Шаг 3: Добавь Sheet ID в проект

Добавь в `.env`:

```
ANALYTICS_SHEET_ID=твой_sheet_id_здесь
```

Или через админку (если настроишь):
```
/admin/settings → Analytics Sheet ID → Сохранить
```

---

## Как это работает

```
Google Sheets (ты заполняешь)
         ↓
    Публикация как CSV
         ↓
    Freelanly забирает данные
         ↓
    CEO Dashboard показывает
         ↓
    Я анализирую и даю рекомендации
```

---

## Автоматическое обновление

Данные обновляются каждые 5 минут (кэш).

Ты можешь:
- Обновлять таблицу вручную когда угодно
- Подключить Яндекс.Метрику/GA через Zapier → Sheets (бесплатный план)
- Писать данные из других источников

---

## Пример заполнения

### Если только начинаешь:

| key | value |
|-----|-------|
| domain | freelanly.com |
| current_mrr | 0 |
| linkedin_personal_followers | 100 |
| traffic_total | 50 |
| hours_per_week | 15 |
| priority_paying_users | 5 |

### Через месяц:

| key | value |
|-----|-------|
| domain | freelanly.com |
| current_mrr | 0 |
| linkedin_personal_followers | 500 |
| traffic_total | 2000 |
| hours_per_week | 20 |
| priority_paying_users | 5 |

---

## Какие данные критичны (заполни в первую очередь)

1. ✅ `hours_per_week` — сколько времени есть
2. ✅ `priority_*` — на чём фокусироваться
3. ✅ Соцсети которые есть (URL + followers)
4. ✅ `traffic_total` — текущий трафик
5. ✅ `email_total` — подписчики

Остальное можно заполнить позже по мере появления данных.
