# Freelanly — Процедура матчинга (production)

> Цель: процедура «профиль юзера ↔ вакансия», которая работает в системе. Спроектирована на **фактических данных** (реальные листинги + профили из прода) и на том, **как эту задачу решают аналогичные проекты** (LinkedIn, open-source, академия).

## 0. Жёсткие ограничения (заданы владельцем)

1. **Достоверны только сырые данные: вакансии** (`title`/`description`/`skills`) **и профили юзеров** (`parsedProfile`). Всё производное (`matchBreakdown`, `contentQuality`, ответы рекрутеров) — НЕ истина, в дизайне и калибровке **не используется**.
2. **Нет размеченных исходов.** Нет «правильно/неправильно» от рекрутеров. ⇒ **обучать supervised relevance-модель не на чем** (это половина индустриального решения — см. §2 — и она нам недоступна). Работаем в **zero-shot / unsupervised** режиме.
3. **Асимметрия стоимости.** Отклик = списание квоты юзера + письмо живому рекрутеру. Ложно-положительный (отправили мимо) дороже ложно-отрицательного (не отправили). ⇒ **precision-first, строгие гейты, при сомнении — не слать.**

## 1. Что показали фактические данные (прод)

Сняты реальные выборки (3 188 профилей, 34 602 активных листинга):

- **`listing.skills` ненадёжен:** у «Gujarati-English Interpreter» skills = `{i5 Processor, Stable WiFi, 8GB RAM}` (требования к железу), у переводческих часто `{}`, у THIN — раздутый catch-all. Есть у 76% листингов, `country` — лишь у 48%. **Авторитетный сигнал листинга — `title`+`description`, не массив skills.**
- **Профиль шумный:** `field` — free-text (часто = title дословно, мультироль через `|`); `skills` содержат soft-skills, **мультиязычные дубли** («Customer Support» = «Atención al cliente» = «Soporte técnico»), опечатки («Automation Anyhwere», «Verbal&Writtencommunication»).
- **Вывод:** центральная проблема — **vocabulary mismatch** (разный вокабуляр у одного смысла). Это же — главная проблема, которую в индустрии решают **нормализацией к таксономии** (§2).

## 2. Как это решают аналогичные проекты (research)

Сходимость очень высокая:

| Источник | Что делает | Что берём |
|---|---|---|
| **LinkedIn** (Learning to Retrieve / Semantic Search) | Two-stage: **retrieval (high recall, дёшево) → rerank (precision, дорого)**. **Hard-constraints отдельно от relevance**: термовый индекс (TBR) гейтит локацию/квалификацию как pre/post-фильтр; эмбеддинги (EBR) дают семантику; гибрид бьёт чистый вариант. | Двухстадийность; **гейты ПЕРЕД скорингом**; гибрид «термы+эмбеддинги» |
| **ESCO / O*NET / SOC** (knowledge-graph matching, arXiv 2109.02554, ScienceDirect O\*NET) | Нормализация title/skills к **стандартной таксономии профессий и навыков**; skill-extraction как retrieval против определений ESCO. Решает vocabulary mismatch, мультиязычность. | **Таксономия как канонический словарь** профессий и навыков |
| **Smart-Hiring** (explainable pipeline, arXiv 2511.02537) | Extract → attribute-match; навыки через эмбеддинг-косинус, опыт/образование/локация — прямое сравнение; **explainability-слой подсвечивает совпавшие навыки**. | Объяснимость = подсветка доказанных совпадений (то, что видит рекрутер) |
| **Zero-shot LLM matching** (MDPI 2024; structured prompting + embeddings) | Без обучающих меток: структурированный промпт + семантические эмбеддинги. | Режим без меток — **наш случай** |
| **Open-source** (srbhr/Resume-Matcher, *-job-matching) | sentence-transformers (`all-MiniLM-L6-v2`, `all-mpnet-base-v2`) + косинус; гибрид keyword+semantic. | Конкретные **pre-trained эмбеддинги, без обучения** |

**Ключевой урок:** индустрия делит сигнал на **(A) жёсткие ограничения** (термы/таксономия, детерминированно) и **(B) семантическую релевантность** (эмбеддинги). Лучшие системы ещё и **обучают** relevance на исходах найма — **нам недоступно (нет меток)**, поэтому берём только незатратные на метки части: таксономия + pre-trained эмбеддинги + детерминированные гейты + доказательный overlap.

## 3. Целевая процедура

Two-stage, как в индустрии, но адаптировано под наши ограничения и под то, что уже есть в коде.

```
A. НОРМАЛИЗАЦИЯ (offline, раз на сущность, кэш)
   профиль  → {occupation*, skills_canon[], languages[], years, location}     (раз на юзера)
   листинг  → {occupation*, required_skills_canon[], languages[], location, years}  (раз на листинг)
        ▲ канон = таксономия (ESCO/O*NET).  Источник листинга = title+description, НЕ skills-массив
        │
   B. RETRIEVAL (high recall, дёшево, без per-pair LLM)
        термовый overlap (TBR)  ⊕  косинус эмбеддингов профиля/листинга (EBR)
        → набор кандидатов на листинг
        │
   C. HARD GATES (детерминированно, precision)  ── fail любой ⇒ reject
        G1 occupation-family совместимы (матрица по таксономии)
        G2 язык (для translation/interpreting ролей)
        G3 локация (только если listing onsite/hybrid И country известна И профиль известен)
        G4 сениорность (грубый разрыв: 5+ лет vs студент)
        │
   D. SCORE + EXPLAIN (одно вычисление = и решение, и «почему» рекрутеру)
        evidence-overlap: каждый required_skill_canon проверить против skills_canon+CV (verifySkill)
        score = f(matched, total, occupation_confidence, embedding_sim)
        apply ⇔ gates ok И matched ≥ K И (total=0 → gates-only) И ratio ≥ R
        borderline → LLM cross-encoder rerank (только на спорных, не на всех парах)
```

### A. Нормализация к таксономии (решает vocabulary mismatch)
- Принять **ESCO** (бесплатна, открыта, **мультиязычна** — закрывает наши «Atención al cliente»=«Customer Support») или **O\*NET/SOC**. Рекомендация: ESCO (фриланс глобальный, мультиязык).
- **Профиль → occupation + canon-skills:** раз на юзера (LLM-extract или эмбеддинг-retrieval против меток ESCO), сохранить в `CandidateProfile`. Нормализует дубли/опечатки/мультиязык, выкидывает чистые soft-skills.
- **Листинг → occupation + required-skills + язык + локация + годы:** раз на листинг из **title+description** (расширенный `parseJD`, уже есть; добавить извлечение **occupation** и **location.mode**). `skills`-массив — только слабый хинт.
- **Эффект на стоимость:** профессия считается **по одному разу на каждую сторону**, не на каждую пару. N+M LLM-вызовов вместо N×M.

### B. Retrieval (гибрид, без меток)
- **Термовый**: нормализованные occupation/skills surface в листинге? (≈ текущий `loopMatchesTargeting`, но на канон-сущностях).
- **Семантический**: косинус между эмбеддингом профиля и эмбеддингом листинга (**pre-trained** `all-MiniLM-L6-v2`/`all-mpnet`, локально или через embedding-API — **обучение не нужно**). Ловит синонимы/перефраз, которые токен-матч пропускает.
- Гибрид (term ∪ embedding-topK) = high recall. Дорогие шаги C/D — только на этом наборе.

### C. Hard gates (детерминированно)
Выносим гейты из гигантского prose-промпта текущего `aiMatchCheck` в **детерминированную логику** поверх нормализованных полей:
- **G1 occupation-family**: обе стороны уже канонизированы → сравнение по матрице совместимости (translation⊇interpreting/localization/subtitling = одна семья; developer ≠ translator даже если «знает язык» — наш частый трап). Низкая уверенность канона с одной стороны → fallback на 1 LLM-арбитраж (редко).
- **G2 язык**: для language-ролей требуем пересечение языков (улучшенный `missingRequiredLanguage`).
- **G3 локация**: гейтим **только** при onsite/hybrid + известная country + известная локация профиля и они различаются. Нет данных → **не гейтим** (факт: 52% листингов без country).
- **G4 сениорность**: `minYears ≥ 5` и кандидат студент/≤1 года → reject.

### D. Score + Explain (единое вычисление)
- Доказательный overlap: `buildBreakdown(required_skills_canon, candidate)` через `verifySkill` (уже есть; токен-идентичность, при сомнении NOT FOUND, асимметрия в пользу precision). Это **одновременно** apply-решение **и** «почему подходит» рекрутеру — конец расхождению «aiMatchCheck решает / breakdown объясняет».
- `apply ⇔ gates ok И matched ≥ K И ratio ≥ R`. При `total=0` (листинг без явных навыков, частый кейс у переводческих) — решение по гейтам (occupation+язык+локация), статус low-confidence/REVIEW.
- **Borderline rerank**: только спорные пары → один LLM cross-encoder (как rerank-стадия LinkedIn), не на каждой паре.

## 4. Калибровка порогов K/R без меток
Меток исходов нет (ограничение §0.2), поэтому:
1. Пересчитать distribution доказательного overlap **на сырых данных с новой нормализацией** (свежо, не старый `matchBreakdown`).
2. Зафиксировать K/R так, чтобы заведомый мусор (0 overlap, cross-occupation) отсекался, а очевидные совпадения проходили.
3. Сверить на **независимом rubric** (декомпозированная проверка occupation/язык/локация/доказанный навык на стратифицированной выборке реальных пар) — это наш суррогат ground-truth вместо ответов рекрутеров.

## 5. Что осознанно НЕ делаем (и почему)
- **Supervised / learned relevance** (LinkedIn two-tower, граф на confirmed-hires) — **нет меток исходов** (§0.2). Вернуться можно, только когда появится разрешённый сигнал-метка.
- **Доверие к `listing.skills` / `profile.field` как таксономии** — данные показали, что это шум.
- **Единый LLM-балл 0-100 на пару как решение** (текущий `aiMatchCheck`) — непрозрачно, дорого (N×M), расходится с тем, что видит рекрутер.

## 6. Что переиспользуем из текущего кода
- `loopMatchesTargeting` → термовая часть retrieval (B).
- `parseJD` → база нормализации листинга (A); расширить: occupation + location.mode.
- `verifySkill` / `buildBreakdown` (`src/lib/match-breakdown/`) → доказательный overlap (D). Уже детерминирован, асимметричен, объясним — точно то, что нужно.
- Caps/fairness/quota (`FANOUT_CAP`, least-served-first, `consumeApplyQuota`) — оставить как distribution/safety-слой поверх матчинга (это не матчинг, это справедливость/защита).
- **Заменяем**: per-pair `aiMatchCheck` → нормализация (A) + детерминированные гейты (C) + единый evidence-скоринг (D); LLM на паре только в borderline-rerank.

## 7. Открытые вопросы для исполнения
- **Таксономия**: ESCO vs O\*NET/SOC (рекомендация ESCO — мультиязычность под наши данные).
- **Эмбеддинги**: локальный `all-MiniLM` (sentence-transformers) vs embedding-API провайдера; где хранить вектора (pgvector на той же Neon).
- **K/R**: финальные значения после калибровки §4.
- **Occupation-таксономия**: маппинг ESCO-occupation ↔ наши 21 категорию (или отказ от своих категорий в пользу ESCO).

---

### Sources
- LinkedIn — [Learning to Retrieve for Job Matching](https://arxiv.org/pdf/2402.13435), [Semantic Search at LinkedIn](https://arxiv.org/pdf/2602.07309), [Embedding-based Recommender for Job↔Candidate at Scale](https://irsworkshop.github.io/2021/publications/IRS2021_paper_6.pdf)
- Taxonomy matching — [Job-Posting-Enriched Knowledge Graph for Skills-based Matching (ESCO)](https://arxiv.org/pdf/2109.02554), [Job matching & skill recommendation with O\*NET](https://www.sciencedirect.com/science/article/pii/S2214579625000048), [Job-Candidate Matching using ESCO Ontology](https://www.researchgate.net/publication/339275831_Job-Candidate_Matching_using_ESCO_Ontology), [Occupation/Skill/Qualification linking with ESCO & EQF](https://arxiv.org/pdf/2512.03195)
- Explainable pipeline — [Smart-Hiring: CV extraction + job matching](https://arxiv.org/html/2511.02537v1)
- Zero-shot (no labels) — [Zero-Shot Resume–Job Matching with LLMs (MDPI)](https://www.mdpi.com/2079-9292/14/24/4960)
- Open-source — [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher), [job-matching topic](https://github.com/topics/job-matching), [skill normalization practices](https://www.jobspikr.com/blog/normalising-data-job-titles-skills-locations/)
