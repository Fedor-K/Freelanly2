# Freelanly Autofill — Lever (MVP)

Chrome-расширение (MV3): автозаполнение Lever-форм (`jobs.lever.co/*/apply`) из профиля Freelanly. PRO-фича. **Auto-FILL, не auto-submit** — юзер проверяет и жмёт Submit сам.

## Что делает
- Кнопка «⚡ Autofill with Freelanly» на странице Lever-заявки.
- Стандартные поля: имя, email, phone (messenger), компания, LinkedIn/GitHub/Portfolio, location.
- Резюме: скачивает PDF из Blob-стора и прикрепляет к file-input.
- Кастомные вопросы: AI отвечает из профиля (`/api/extension/answer`); не знает → NEEDS_USER → поле подсвечивается оранжевым.
- Зелёная подсветка = заполнено, оранжевая = «допиши сам».
- FREE-юзер → тост «нужен PRO» + открывается Billing.

## Тест локально (5 минут)
1. `chrome://extensions` → Developer mode ON → **Load unpacked** → выбери папку `extension/lever-autofill`.
2. Залогинься на freelanly.com → открой https://freelanly.com/api/extension/token → скопируй `token`.
3. Клик по иконке расширения → вставь токен → Save (должно показать «Connected — PRO», если аккаунт PRO).
4. Открой любую Lever-вакансию → Apply → жми «⚡ Autofill».

## Backend (уже в проде)
- `GET /api/extension/token` — выдать/показать токен (по сессии).
- `GET /api/extension/profile` — профиль для заполнения (Bearer, PRO-гейт).
- `POST /api/extension/answer` — AI-ответ на вопрос формы (Bearer, PRO-only).

## Дальше (не в MVP)
- Иконки + публикация в Chrome Web Store (ревью ~пара дней).
- Кнопка «получить токен» без JSON-страницы (кабинет → Settings).
- Селекты/радио-кнопки (сейчас — подсветка на ручное).
- Greenhouse/Ashby — после валидации Lever.
