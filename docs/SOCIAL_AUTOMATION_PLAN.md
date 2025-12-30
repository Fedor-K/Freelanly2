# Freelanly Social Media Automation Plan

## Цель
Автоматическое продвижение вакансий через нетекстовые соцсети с минимальным ручным участием.

**Принцип: Максимально бесплатные/open-source решения через n8n.**

---

## Бесплатные альтернативы Creatomate для n8n

### Сравнительная таблица

| Сервис | Бесплатный лимит | Интеграция с n8n | Тип |
|--------|------------------|------------------|-----|
| **Short Video Maker** | Безлимитно | REST API + MCP | Self-hosted, Open Source |
| **Shotstack** | 20 мин видео + 100 картинок/мес | HTTP Request | Cloud API |
| **APITemplate.io** | 50 рендеров/мес | Нативная нода | Cloud API |
| **JSON2Video** | Есть (с водяным знаком) | HTTP Request | Cloud API |
| **Bannerbear** | 30 картинок | Нативная нода | Cloud API |

---

## Рекомендуемый стек (100% бесплатно)

### Для видео: Short Video Maker (Self-Hosted)

**GitHub:** https://github.com/gyoridavid/short-video-maker

**Что это:**
- Open-source инструмент для генерации коротких видео
- TTS через Kokoro (бесплатно)
- Субтитры через Whisper (бесплатно)
- Фоновые видео через Pexels API (бесплатно)
- Рендеринг через Remotion + FFmpeg

**Требования для VPS:**
- 3GB RAM (рекомендуется 4GB)
- 2 vCPU
- 5GB диска
- Docker

**Запуск:**
```bash
docker run -it --rm -p 3123:3123 \
  -e PEXELS_API_KEY=your_key \
  gyoridavid/short-video-maker:latest-tiny
```

**REST API пример:**
```bash
curl -X POST http://localhost:3123/api/video \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Senior Developer needed at TechCorp. Remote position. Apply now at freelanly.com",
    "voice": "en-us-1"
  }'
```

### Для картинок: Shotstack или APITemplate.io

**Вариант A: Shotstack (20 мин видео + 100 картинок бесплатно)**
- Нет нативной ноды, но работает через HTTP Request
- Хороший для картинок и простых видео

**Вариант B: APITemplate.io (50 рендеров бесплатно)**
- Есть нативная нода в n8n
- Drag-and-drop редактор шаблонов
- Лучше для статичных картинок

---

## Архитектура n8n Workflows

### Workflow 1: Генерация картинок для Pinterest/Instagram

```
[Cron: каждые 4 часа]
        ↓
[HTTP: GET freelanly.com/api/jobs/featured]
  (возвращает JSON с топ вакансией)
        ↓
[APITemplate.io / Shotstack: Render Image]
  (шаблон: job-card-pinterest 1000x1500)
        ↓
[Pinterest API: Create Pin]
[Instagram Graph API: Post Image]
```

### Workflow 2: Генерация видео для TikTok/Reels/Shorts

```
[Cron: 2 раза в день]
        ↓
[HTTP: GET freelanly.com/api/jobs/top?limit=3]
        ↓
[Code Node: Составить скрипт]
  "Hiring now! [Title] at [Company].
   Salary: [Salary]. Location: [Location].
   Apply at freelanly.com"
        ↓
[HTTP: POST short-video-maker:3123/api/video]
  (генерация видео с TTS и субтитрами)
        ↓
[Wait: 2 минуты]
        ↓
[HTTP: GET статус видео]
        ↓
[Parallel:]
  ├─ [TikTok API: Upload]
  ├─ [Instagram API: Post Reel]
  └─ [YouTube API: Upload Short]
```

---

## Необходимые API endpoints на Freelanly

### GET /api/jobs/featured
Возвращает "лучшую" вакансию для контента:
```json
{
  "id": "xxx",
  "title": "Senior Developer",
  "company": "TechCorp",
  "companyLogo": "https://...",
  "salary": "$120K/yr",
  "location": "Remote (EU)",
  "level": "Senior",
  "type": "Full-time",
  "url": "https://freelanly.com/company/techcorp/jobs/senior-developer"
}
```

**Критерии выбора:**
1. Есть зарплата
2. Опубликована за последние 24 часа
3. Случайный выбор из топ-10

### GET /api/jobs/top?limit=5&category=engineering
Возвращает топ вакансий для карусели/видео.

---

## Шаблоны контента

### Job Card (Pinterest/Instagram)
```
┌─────────────────────────┐
│  🔥 HIRING NOW          │
│                         │
│  Senior Developer       │
│  @ TechCorp             │
│                         │
│  💰 €80,000/year        │
│  📍 Remote (EU)         │
│                         │
│  freelanly.com/apply    │
└─────────────────────────┘
```

### Video Script Template
```
"Hot job alert!
[Company] is hiring a [Title].
Salary: [Salary].
Location: [Location].
This is a [Type] [Level] position.
Apply now at freelanly dot com.
Link in bio!"
```

---

## План внедрения

### Шаг 1: Настройка VPS
- [ ] Установить Docker на VPS (198.12.73.168)
- [ ] Запустить Short Video Maker контейнер
- [ ] Получить Pexels API Key (бесплатно)
- [ ] Проверить работу через curl

### Шаг 2: API endpoints на Freelanly
- [ ] Создать `/api/jobs/featured`
- [ ] Создать `/api/jobs/top`
- [ ] Задеплоить на Replit

### Шаг 3: n8n Workflows
- [ ] Создать workflow для картинок (APITemplate.io или Shotstack)
- [ ] Создать workflow для видео (Short Video Maker)
- [ ] Настроить cron расписание

### Шаг 4: Социальные аккаунты
- [ ] Pinterest Business Account + API
- [ ] Instagram Business через Facebook + API
- [ ] TikTok Developer Account + API
- [ ] YouTube Channel + API

---

## Бюджет

| Компонент | Стоимость |
|-----------|-----------|
| Short Video Maker (self-hosted) | **Бесплатно** |
| Pexels API | **Бесплатно** |
| APITemplate.io (50 рендеров/мес) | **Бесплатно** |
| ИЛИ Shotstack (100 картинок/мес) | **Бесплатно** |
| n8n (self-hosted) | **Бесплатно** |
| Pinterest API | **Бесплатно** |
| Instagram API | **Бесплатно** |
| TikTok API | **Бесплатно** |
| YouTube API | **Бесплатно** |
| **Итого** | **$0/мес** |

---

## Ресурсы и ссылки

### Open Source
- [Short Video Maker](https://github.com/gyoridavid/short-video-maker) - Self-hosted видео генерация
- [Remotion](https://remotion.dev) - React-based видео framework
- [n8n](https://n8n.io) - Workflow automation

### Cloud APIs (с бесплатными лимитами)
- [Shotstack](https://shotstack.io/pricing/) - 20 мин + 100 картинок бесплатно
- [APITemplate.io](https://apitemplate.io/pricing/) - 50 рендеров бесплатно
- [JSON2Video](https://json2video.com/pricing/) - Бесплатный план с водяным знаком
- [Bannerbear](https://www.bannerbear.com/pricing/) - 30 картинок бесплатно

### n8n Workflow Templates
- [Faceless Video Generator](https://n8n.io/workflows/3442-fully-automated-ai-video-generation-and-multi-platform-publishing/)
- [Shotstack + AI Videos](https://n8n.io/workflows/6014-create-faceless-videos-with-gemini-elevenlabs-leonardo-ai-and-shotstack/)
- [Bannerbear Integration](https://n8n.io/workflows/544-create-an-image-procedurally-using-bannerbear/)

### Социальные API
- [Pinterest API](https://developers.pinterest.com/)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)
- [TikTok API](https://developers.tiktok.com/)
- [YouTube Data API](https://developers.google.com/youtube/v3)
