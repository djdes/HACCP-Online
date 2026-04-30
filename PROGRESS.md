# PROGRESS

Сессия loop с интервалом 60s, cron `715c1e2c`.

## Приоритет 1 — твои задачи

- [x] **A1**: «Возвращено: <причина>» badge на rejected-карточках TF + endpoint `mark-returned` + WeSetup mirror
- [x] **A2**: Audit-лог в WeSetup при approve/reject (4 действия)
- [x] **A3**: WeSetup-mirror — проверено и явно прокомментировано: only on approve
- [x] **A4**: Migration legacy задач — `verifierWorkerId=NULL` сохраняет old flow

## Заметки по архитектуре

**Migration legacy задач (A4)**: TasksFlow-задачи созданные ДО Phase E
имеют `verifier_worker_id = NULL`. В `/api/tasks/:id/complete` проверка
`typeof task.verifierWorkerId === "number"` — для NULL возвращает
старое one-step complete (transitionToCompleted → balance → mirror).
Backfill'ов не делаем — legacy task'и продолжают работать как раньше.
Новые task'и из bulk-assign-today получают verifier из
`doc.verifierUserId` (fallback на `doc.responsibleUserId`).

**WeSetup-mirror (A3)**: явно запускается только в:
1. `/api/tasks/:id/complete` для legacy (verifier=null) или admin-self
2. `POST /api/tasks/:id/verify` decision="approve" — `attemptOrEnqueue`
3. `POST /journal-documents/<id>/verifier` decision="approve-all"

В submit-ветке `/complete` стоит явный `return res.json` ДО любых
mirror-вызовов (см. routes.ts:1320-1326 комментарий).

## Блок 1 — критические баги лендинга

- [ ] **B1**: Унифицировать число журналов (35/34)
- [ ] **B2**: Скриншоты «Скоро» → реальные
- [ ] **B3**: «С нами работают» — убрать или заполнить
- [ ] **B4**: «Отзывы» — убрать или заполнить

## Блок 2 — UX

- [ ] **C5**: Порядок секций
- [ ] **C6**: Унифицировать CTA → «Начать бесплатно»
- [ ] **C7**: Грамматика «Поднимете → Создайте/Запустите»
- [ ] **C8**: «Софт-подписка» переписать
- [ ] **C9**: Demo-форма (требует значительной работы — отложу)
- [ ] **C10**: Видео заполнения (нет видеоматериалов — пропуск)

## Блок 3 — контент

- [ ] **D11**: Секция «Безопасность данных»
- [ ] **D12**: ROI калькулятор
- [ ] **D13**: Кейс-стади (нет данных — пропуск)
- [ ] **D14**: FAQ дополнить
- [ ] **D15**: СанПиН ссылка наверху
- [ ] **D16**: Email magazinlenina → support@wesetup.ru

## Блок 4 — SEO

- [ ] **E17**: SEO-страницы под ключи
- [ ] **E18**: Блог: категории/поиск/пагинация/CTA/похожие
- [ ] **E19**: Лендинги под ниши (/dlya-kafe и т.д.)
- [ ] **E20**: schema.org разметка

## Блок 5-8 — большие фичи

Многие из них (NFC, ФГИС-Меркурий, мобильное app, маркетинг) — вне scope автоматизированного цикла. Помечу как пропущенные с пояснением.

## Пропущенные / требуют уточнения

- **C10**: видео — нет исходников
- **D13**: кейс-стади — нет реальных данных клиентов
- **Блок 5 (Telegram-бот wizard)** — большая фича, требует архитектурного обсуждения
- **Блок 6 (маркетинг)** — оффлайн-задачи (обход кафе, реклама в Директе)
- **Блок 7-8 (мобилка, NFC, ФГИС, курсы, white-label)** — всё это weeks-of-work проекты

