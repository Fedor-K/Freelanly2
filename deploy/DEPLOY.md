# Деплой Freelanly на VPS

## Требования
- Ubuntu 22.04+ / Debian 12+
- Docker & Docker Compose
- 2GB RAM минимум
- Домен с DNS на IP сервера

## Быстрый старт

### 1. Установка Docker (если нет)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Перелогиниться или: newgrp docker
```

### 2. Клонирование репозитория

```bash
cd /opt
git clone https://github.com/Fedor-K/Freelanly2.git freelanly
cd freelanly
git checkout claude/new-freelance-platform-EbyOD
```

### 3. Настройка переменных окружения

```bash
cp .env.example .env
nano .env
```

Заполни:
```env
DATABASE_URL="postgresql://neondb_owner:xxx@xxx.neon.tech/neondb?sslmode=require"
NEXT_PUBLIC_APP_URL="https://freelanly.com"
STRIPE_SECRET_KEY="sk_live_xxx"
DEEPSEEK_API_KEY="sk-xxx"
APIFY_API_TOKEN="apify_api_xxx"
RESEND_API_KEY="re_xxx"
```

### 4. Запуск

```bash
# Собрать и запустить
docker compose up -d --build

# Проверить логи
docker compose logs -f app
```

### 5. Настройка Nginx + SSL

```bash
# Установить nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# Скопировать конфиг
sudo cp deploy/nginx.conf /etc/nginx/sites-available/freelanly
sudo ln -s /etc/nginx/sites-available/freelanly /etc/nginx/sites-enabled/

# Получить SSL сертификат
sudo certbot --nginx -d freelanly.com -d www.freelanly.com

# Перезапустить nginx
sudo nginx -t && sudo systemctl reload nginx
```

## Команды

```bash
# Перезапуск
docker compose restart app

# Обновление
git pull
docker compose up -d --build

# Логи
docker compose logs -f app

# Войти в контейнер
docker compose exec app sh

# Миграции БД
docker compose exec app npx prisma db push
```

## Без Docker (PM2)

Если предпочитаешь PM2:

```bash
# Установить Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install nodejs -y

# Установить PM2
npm install -g pm2

# Собрать проект
npm install
npm run build

# Запустить
pm2 start npm --name "freelanly" -- start
pm2 save
pm2 startup
```

## Мониторинг

```bash
# Docker
docker stats

# PM2
pm2 monit
```

## Автообновление (GitHub Actions)

Создай `.github/workflows/deploy.yml` для автодеплоя при push в main.
