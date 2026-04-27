# WeSetup — Brainstorm 100+ идей для автоматизации и удобства

> Цель файла — широкий пул идей, не ограниченный «что нужно прямо сейчас». Каждая запись содержит зачем (бизнес-выгода), что (фича), как (один-два предложения о технике), сложность (S/M/L/XL).
>
> **Как использовать:** каждый Claude-batch берёт оттуда 1-3 идеи (приоритет — S и M), реализует, удаляет / переносит в основной `FEATURES_AND_AUTOMATION.md` § Recently shipped с SHA. Не делать L и XL без отдельного брифа от пользователя.
>
> **Дата:** 2026-04-27. **Состояние:** свежий сборник от ночной QA-сессии после 12-фич-batch'а.

## ✅ Уже реализовано в этой ночной сессии (2026-04-27)

После QA-теста compliance flow (35/35 задач выполнены, 100% compliance подтверждён через worker-flow):

| ID | SHA | Что |
|---|---|---|
| B1 | `b867baf` | Auto-CAPA при критических deviations (брак / не допущен / ККТ) |
| E3 | `b867baf` | Strugglers leaderboard на /dashboard |
| M1 | `0cd32bd` | Look-ahead auto-create на 7 дней + cron |
| F4 | `0cd32bd` | 8 готовых сценариев CAPA в /capa/new |
| E2 | `294a8ad` | Heatmap по дням недели на /reports |
| E10 | `294a8ad` | Photo evidence rate виджет |
| E5 | `294a8ad` | Top-5 продуктов и причин потерь на /losses |
| F2 | `294a8ad` | Push owner'у при первом login (через events.signIn + AuditLog dedupe) |
| N1 | `f5faa1d` | CopyIdButton + применён к /settings/equipment |
| A2 | `f5faa1d` | Кнопка «✓ Всё в норме» в task-fill |
| M2 | `f5faa1d` | Cron auto-archive documents > 365 дней |
| M3 | `f5faa1d` | Cron purge AuditLog с tiered retention |
| A8 | `2c7d8f9` | NFC docs (`docs/nfc-tags-howto.md`) |
| I8 | `2c7d8f9` | Rate-limit на AI-чат (10/мин/user) |
| I10 | `2c7d8f9` | Brute-force защита login (5/email/5мин) |
| A7 | `2c7d8f9` | Auto-fill HH:MM в time-полях |
| N3 | `d779e82` | bulk-close API для CAPA (UI после) |
| M9 | `d779e82` | Публичный /api/health для uptime-monitor |

**Bug-fixes из этой же сессии (найденные при QA, не из brainstorm):**
| SHA | Фикс |
|---|---|
| `40cf90c` | cold-equipment-document.ts — детерминистские id для default seeds |
| `a533af5` | disinfectant/metal_impurity/traceability адаптеры — config={} resilience |

Остальные идеи ниже остаются актуальными для будущих batch'ей.


---

## Категория A — Уменьшение количества тапов сотрудника

Каждая идея целится снизить число действий рабочего на одну запись журнала. Сейчас «заполнить hygiene + cold_equipment + climate + finished_product» = ~25 тапов в день при идеальном UX. Цель — меньше 10.

### A1. Auto-fill «копировать вчерашнее» по умолчанию для невременных полей
- **Зачем:** сотрудник 90% дней повторяет вчерашние значения «healthy / approved / ok». Уже частично сделано (smart-defaults), но только для отдельных журналов.
- **Что:** во всех журналах (text/select/boolean) подставлять `defaultValue` из вчерашней записи если поле не temperature и не number.
- **Как:** расширить `getYesterdayEntryData()` чтобы проходился по всем `JournalDocumentEntry.data` keys. Адаптерам — единый `withYesterdayDefaults` wrapper.
- **Сложность:** S

### A2. Group submit «всё ОК» для обходов
- **Зачем:** при чистом обходе кухни 8 единиц оборудования всё в норме — сейчас надо тапнуть 8 раз. Дать одну кнопку «всё в норме» которая подставит средние значения нормы.
- **Что:** в task-fill UI при наличии полей с `min/max` — кнопка вверху «Всё в норме (1 тап)» — подставляет midpoint и сабмитит.
- **Как:** UI-only добавление в `task-fill-client.tsx`. Server без изменений.
- **Сложность:** S

### A3. Pinned «частые поломки» для finished_product brakeraj
- **Зачем:** замечания в бракераже повторяются — «недосолено», «вышел срок размораживания», «корочка тёмная». Сейчас текстовое поле каждый раз новое.
- **Что:** dropdown с топ-10 частых замечаний (учится на истории org), плюс «Своё».
- **Как:** SELECT type с auto-loaded options из последних 100 entries.data.comment.
- **Сложность:** M

### A4. Voice → form через Whisper
- **Зачем:** руки заняты, ноги в перчатках — голос быстрее любого тапа. «Все в норме» / «температура витрины 5 градусов».
- **Что:** микрофон-кнопка в task-fill, отправляет аудио через Whisper API → парсит в значения через Claude Haiku.
- **Как:** Web Speech API → /api/ai/parse-voice → прокси на Whisper или Anthropic Voice. Расход: ~$0.003 за заполнение.
- **Сложность:** M

### A5. QR-сканер на оборудование с pre-fill контекста
- **Зачем:** уже есть QR-наклейки на оборудовании (есть feature). Ускорить: сканирую QR → сразу открывается журнал именно по этому холодильнику с подставленным id.
- **Что:** улучшить `/equipment-fill/[id]` — учесть Equipment.lastReadingAt и pre-fill температурой ±2°C от него (физически невозможно поменять резко).
- **Как:** в getEquipmentFillForm подгружать lastValue, ставить как defaultValue с пометкой «вчера было XX°C».
- **Сложность:** S

### A6. Авто-рассыпание задач по сменам через WorkShift
- **Зачем:** сейчас bulk-assign шлёт всем сотрудникам. Если повар не на смене — задача висит впустую и портит compliance.
- **Что:** перед созданием TF-задачи проверять WorkShift.status сегодня; если off/vacation/sick — пропускать.
- **Как:** в `tasksflow-bulk-assign.ts` фильтровать кандидатов через `listOnDutyToday()`.
- **Сложность:** S

### A7. Smart-time подстановка
- **Зачем:** «Время выпуска» / «Время приёмки» — сотрудник вписывает время сейчас. Подставлять `now()` с возможностью править.
- **Что:** для всех `time` полей в TaskFormSchema — defaultValue = current HH:MM.
- **Как:** `buildCompletionValidator` уже принимает значения. Адаптерам — добавить `defaultValue: ()=>new Date().toISOString().slice(11,16)`.
- **Сложность:** S

### A8. NFC-tags вместо QR
- **Зачем:** NFC быстрее QR (тап телефона, не открытие камеры) для оборудования. Лучше для повара в перчатках.
- **Что:** на странице оборудования кнопка «Сгенерировать NFC-URL» — копирует URL для записи на пустой NFC-тег.
- **Как:** один URL `/equipment-fill/<id>` — пользователь сам пишет на NFC через iOS Shortcut / nfc tools.
- **Сложность:** S (только инструкция)

### A9. Photo-первое заполнение для подозрительных партий
- **Зачем:** при `result=rejected` в incoming_control сотрудник должен прикрепить фото. Сейчас фото — отдельный шаг и часто пропускается.
- **Что:** при выборе rejected — сразу запустить камеру (capture=environment).
- **Как:** на UI шаге changes hook on `result === "rejected"` → trigger file input click через ref.
- **Сложность:** S

### A10. Мульти-тач для multi-employee гигиены
- **Зачем:** «отметить здоровье 8 сотрудников» — 8×5 тапов = 40 действий. Сделать таблицу-чекбокс «всех допустить» одним движением.
- **Что:** карточка вместо grid, batch-операции «все healthy», «все signed».
- **Как:** новый mini-ui для hygiene с чекбокс-листом.
- **Сложность:** M

---

## Категория B — Compliance & регулятор

Цель — pass-by-default для аудита РПН/СЭС, минимизация ручных «исправлений» постфактум.

### B1. Авто-CAPA при rejected входной партии
- **Зачем:** сейчас `incoming_control.result=rejected` шлёт push, но не открывает CAPA. Бракованная поставка = нарушение → должен быть тикет с расследованием.
- **Что:** в API `journals/route.ts` — после save с rejected status → создать CapaTicket с category="quality", priority="high", title из productName.
- **Как:** хук в DEVIATION_RULES handler. Дедупликация по batchCode за день.
- **Сложность:** S

### B2. Автоматическое подтверждение прохождения медосмотра
- **Зачем:** сейчас StaffCompetency.expiresAt напоминает за 30/14/3 дня и просрочку. После прохождения медосмотра менеджер должен вручную обновить дату — забывают.
- **Что:** Telegram-кнопка в push «Я прошёл медосмотр сегодня» → автоматическое продление на 1 год.
- **Как:** webhook от bot → patch StaffCompetency.expiresAt = now + 365d. Запросить фото медкнижки — async upload через Telegram bot.
- **Сложность:** M

### B3. Автоматическая блокировка сотрудника при просроченной медкнижке
- **Зачем:** регламент: после истечения медкнижки сотрудник не имеет права работать. Сейчас система пингает но не блокирует.
- **Что:** ежедневный cron — если StaffCompetency истёк > 7 дней без обновления → User.isActive=false + push owner'у.
- **Как:** в `/api/cron/expiry` добавить deactivate-stage. Опциональный toggle Organization.autoBlockOnExpiry.
- **Сложность:** M

### B4. Pre-flight чек-лист перед каждой сменой (Hard-gate)
- **Зачем:** регулятор требует «перед сменой проверить hygiene + холодильники + наличие воды». Должен быть формальный запуск смены.
- **Что:** TasksFlow ловит «начало смены» (первое открытие задачи) → если hygiene не отмечена — не открывает task.
- **Как:** middleware в TF API tasks/[id] — проверка журналов on-duty.
- **Сложность:** M (пересекается с #3.10.1 в roadmap)

### B5. Пофамильный аудит — кто и что заполнял за период
- **Зачем:** при разборе incidents нужно «кто заполнял этот журнал в день инцидента». Сейчас инфа есть в DB, но нет UI.
- **Что:** в `/reports` добавить вкладку «По сотруднику»: фильтр user → его entries за период с timestamp + values.
- **Как:** новая страница `/reports/by-user/[id]?from&to`. Данные через `JournalEntry` + `JournalDocumentEntry` join'ы.
- **Сложность:** M

### B6. Электронная подпись инспектора
- **Зачем:** инспектор просмотрел журналы → должен подписать. Сейчас audit `InspectorToken.lastAccessedAt` есть, но нет «я ознакомился».
- **Что:** на `/inspector/<token>` кнопка «Подтверждаю просмотр» → создаёт `InspectorVisit` с временем + IP + user-agent.
- **Как:** новая модель InspectorVisit. UI — отдельная подпись на токене у админа: «Иванов И.И. подписал 2026-04-30».
- **Сложность:** L (см. #3.4.2 roadmap)

### B7. Pre-built ХАССП-план PDF
- **Зачем:** при первой проверке инспектор просит «дайте ваш ХАССП-план». Менеджер ищет в Google docs из шаблонов.
- **Что:** на `/sanpin` кнопка «Скачать ХАССП-план для нашей кухни» → AI заполняет шаблон под профиль org (тип, оборудование, штат, журналы).
- **Как:** Claude Sonnet с system-prompt'ом как у sanpin-chat + контекст org → MD → jsPDF в финальный документ.
- **Сложность:** L

### B8. Версионирование журнальных шаблонов
- **Зачем:** РПН выпустил новую редакцию СанПиН → надо обновить требования в журнале гигиены. Сейчас изменение журнала ломает старые записи.
- **Что:** JournalTemplate.version + history. Старые entries рендерятся по своей версии шаблона, новые по текущей.
- **Как:** добавить version int + создать JournalTemplateRevision модель.
- **Сложность:** L

### B9. Авто-генерация appendix для Роспотребнадзора
- **Зачем:** при проверке РПН требует приложения: список оборудования, список сотрудников с медкнижками, журнал на дату X.
- **Что:** на `/inspector` страница «Скачать стандартное приложение РПН» → ZIP с 5 PDF (оборудование, штат, journals_today, capa_tickets, audit_log).
- **Как:** server-side ZIP через archiver. Email или прямая загрузка.
- **Сложность:** M

### B10. Автоматическое замораживание дня после конца смены
- **Зачем:** уже есть «закрытый день» toggle. Расширить: автоматически создать audit-запись при первом изменении прошлого дня.
- **Что:** мы уже логируем `closed_day.override` — добавить email-уведомление owner'у при override.
- **Как:** в существующий audit-route — `notifyEmployee(ownerId, message)`.
- **Сложность:** S

---

## Категория C — Telegram-bot улучшения

### C1. Чат-бот «спросить у бота как заполнить»
- **Зачем:** сотрудник в TF не понимает что писать в поле. Сейчас он закрывает задачу пустой.
- **Что:** в Telegram-боте `/help <название журнала>` отдаёт краткую инструкцию + пример.
- **Как:** static-content table из MD-файлов в /docs/journal-help/<code>.md. Bot читает по коду.
- **Сложность:** S

### C2. Bot-команда `/today` со списком моих задач
- **Зачем:** worker открывает Telegram чтобы посмотреть «что мне делать сегодня». Должен быстрый ответ без открытия Mini App.
- **Что:** /today → бот отвечает списком открытых TF-задач этого юзера + deeplink на каждую.
- **Как:** poll через TasksFlow API + filter by phone match.
- **Сложность:** S

### C3. Bot reminder перед концом смены
- **Зачем:** worker уходит, забывает закрыть журнал температуры (вечерний замер). Compliance падает.
- **Что:** bot шлёт за 30 мин до shiftEndHour: «У вас 3 задачи не закрыты, успейте до 22:00».
- **Как:** новый cron, шлёт filter'ам кто on-duty и не зашёл.
- **Сложность:** S

### C4. Bot-команда `/handover` для передачи смены
- **Зачем:** уходящий повар пишет в WorkShift.handoverNotes — но никто не читает. Заставить через Telegram.
- **Что:** bot пингает входящего повара: «Вам передаёт смену Иван. Заметки: [текст]». Кнопка «Принял».
- **Как:** при создании WorkShift.handoverToId — bot шлёт push.
- **Сложность:** S

### C5. Bot-команда `/sanpin <вопрос>` через AI
- **Зачем:** sanpin-chat есть в дашборде. Воркеры в TF тоже хотят. Но Mini App нет на десктопе менеджера.
- **Что:** bot принимает текстовый вопрос → /api/ai/sanpin-chat → возвращает ответ.
- **Как:** уже есть chat. Добавить grammy handler.
- **Сложность:** S

### C6. Bot-фото OCR для входящих накладных
- **Зачем:** ручной ввод 20 продуктов — 5 минут. Фото накладной → AI извлекает → пред-заполненный incoming_control.
- **Что:** сотрудник шлёт фото → bot отправляет на Claude Vision → возвращает draft с кнопкой «Подтвердить».
- **Как:** Claude Vision → JSON parser → web URL для финального заполнения.
- **Сложность:** L

### C7. Bot-уведомления о CAPA-просрочке
- **Зачем:** CAPA с SLA 24h — менеджер забывает. Auto-escalation cron уже шлёт push, но в личку, не в группу.
- **Что:** добавить групповой чат в Organization.telegramGroupId — туда кричит auto-escalation.
- **Как:** Organization model + UI поле + grammy bot.sendMessage(groupId).
- **Сложность:** M

### C8. Inline-keyboard «принял задачу» в TF-уведомлении
- **Зачем:** сейчас TF-задача открывается через ссылку → форма. Хочется один тап «всё ок» прямо из Telegram.
- **Что:** bot шлёт уведомление с кнопкой «Всё ок (быстро закрыть)» — webhook → close на TF без формы.
- **Как:** generate quick-token, callback_query → mark task complete.
- **Сложность:** M

### C9. Bot отказ — `/skip <task-id> reason` если нет необходимости
- **Зачем:** сегодня выходной → сотрудник не пришёл и не отметил. Должна быть команда «отметь как «Не требуется»».
- **Что:** bot принимает /skip — close-no-events с reason.
- **Как:** wire to /api/task-fill/[id]/close-no-events.
- **Сложность:** S

### C10. Push-уведомления о смене графика
- **Зачем:** менеджер обновил график (WorkShift.status) — сотруднику не доставлено.
- **Что:** при изменении WorkShift через UI — bot шлёт затронутым users push «Ваша смена 28.04 → off».
- **Как:** хук в /api/work-shifts/* PATCH.
- **Сложность:** S

---

## Категория D — Mini App улучшения

### D1. Pull-to-refresh на главной Mini App
- **Зачем:** сейчас юзер не видит обновлений до полной перезагрузки. Pull-to-refresh ожидаем после Telegram-онбординга.
- **Что:** PullToRefreshContainer wrapper, на release → fetch /api/mini/home.
- **Как:** есть библиотека react-pull-to-refresh, или handcrafted с Touch events.
- **Сложность:** S

### D2. Skeleton-loading в Mini App вместо спиннера
- **Зачем:** сейчас «Загрузка…» текст. Skeleton-блоки выглядят живее.
- **Что:** для каждой страницы Mini App — Skeleton-варианты.
- **Как:** shadcn Skeleton component, импорт в SSR-страницы.
- **Сложность:** S

### D3. Offline-indicator + IndexedDB queue
- **Зачем:** в подвале нет интернета. Сейчас отправка падает, юзер думает «сохранил» но нет.
- **Что:** при отсутствии сети — записать в IDB queue, синкнуть при появлении сети.
- **Как:** Service Worker + Background Sync API. Конфликт-resolution: server wins.
- **Сложность:** L (см. #3.11.1)

### D4. Mini App geolocation watcher для зашёл/вышел
- **Зачем:** определять смену автоматически по гео.
- **Что:** при первом тапе Mini App — записать lat/lng. Если рядом с Area.lat/lng → автомаркировка start_shift.
- **Как:** WebApp.locationManager API.
- **Сложность:** M

### D5. Haptic feedback на кнопках
- **Зачем:** Mini App в Telegram поддерживает haptic. Делает интерфейс «живым».
- **Что:** на каждый submit/cancel — `WebApp.HapticFeedback.notificationOccurred("success" | "warning")`.
- **Как:** wrapper hook useHaptic. Drop-in замена для всех Button.onClick.
- **Сложность:** S

### D6. Динамическая theme = Telegram theme
- **Зачем:** Mini App сейчас всегда dark. Если у юзера в Telegram light mode — UI диссонирует.
- **Что:** в layout.tsx читать `WebApp.colorScheme` и использовать как initial theme.
- **Как:** уже есть SiteThemeProvider, надо подцепить к WebApp API.
- **Сложность:** S

### D7. Bottom-sheet вместо modal для форм
- **Зачем:** mobile-native UX — bottom-sheets, не центральные modals. Telegram Mini App ближе к native.
- **Что:** все диалоги (фото-просмотр, выбор сотрудника, и т.д.) — слайд снизу.
- **Как:** vaul lib или handcrafted. Drop-in замена.
- **Сложность:** M

### D8. Glow-loader для длинных операций
- **Зачем:** ai-period-report генерится 20 секунд. Юзер думает «зависло».
- **Что:** progress bar с фейковым but psychological progress + текстом «Анализирую данные…».
- **Как:** Framer Motion progress bar. Тайминги — emperic.
- **Сложность:** S

### D9. Полноэкранный photo-просмотр с pinch-zoom
- **Зачем:** на фотках на странице записи сложно прочитать дату на упаковке. Pinch-zoom — стандарт.
- **Что:** PhotoLightbox: добавить touch-handlers для pinch + double-tap to zoom.
- **Как:** existing component → добавить gesture lib.
- **Сложность:** M

### D10. iOS-style swipe-to-back на детальных страницах
- **Зачем:** Telegram Mini App в iOS не имеет навигационной истории. Свайп вправо = back — ожидание.
- **Что:** wrap каждый /mini/<route> в SwipeableEdge.
- **Как:** custom hook + position tracking.
- **Сложность:** M

---

## Категория E — Аналитика и отчёты

### E1. Compliance trend graph за 12 месяцев
- **Зачем:** сейчас в /reports один день / неделя / месяц. Длинные тренды (год) — видно сезонность.
- **Что:** на /reports график «compliance % по месяцам» c кнопками «1м / 3м / 12м».
- **Как:** агрегаты JournalEntry + JournalDocumentEntry per-month. Recharts LineChart.
- **Сложность:** M

### E2. Heatmap по дням недели — где «слабая суббота»
- **Зачем:** менеджер видит «у нас плохо в субботу». Сейчас heatmap по календарю — не агрегирован.
- **Что:** новая вкладка «По дням недели» с агрегатами Mon-Sun.
- **Как:** group by `getDay()` за 90 дней.
- **Сложность:** S

### E3. Worst employee leaderboard (с реверсом)
- **Зачем:** уже есть лидерборд лучших. Нужен и худших — кому помощь.
- **Что:** на /dashboard переключатель «Лучшие | Аутсайдеры». Aутсайдеры = bottom 3 по entries.
- **Как:** отрисовка с тем же `getWorkerLeaderboard` + `.slice(-3).reverse()`.
- **Сложность:** S

### E4. CAPA dashboard
- **Зачем:** /capa сейчас просто список. Нужен dashboard с метриками: open / inProgress / overdue / closed_30d.
- **Что:** виджеты сверху страницы /capa с цифрами + ссылки на фильтры.
- **Как:** агрегаты + Cards.
- **Сложность:** S

### E5. Лосс-аналитика «топ-причин потерь за месяц»
- **Зачем:** сейчас /losses — список. Бухгалтер не делает анализ. Кратко: «топ-5 причин» / «топ-5 продуктов».
- **Что:** виджет на /losses с pie chart по category и бар по productName.
- **Как:** group by + Recharts.
- **Сложность:** S

### E6. Месячный AI-summary с критическими наблюдениями
- **Зачем:** AI-period-report уже есть. Cron-вариант — каждый понедельник присылать в Telegram «Прошлая неделя: X нарушений, рекомендую Y».
- **Что:** новый cron `/api/cron/weekly-ai-summary` дёргает existing AI и шлёт.
- **Как:** schedule + reuse logic.
- **Сложность:** S

### E7. Compare-mode: «эта неделя vs прошлая»
- **Зачем:** менеджер хочет видеть «лучше или хуже».
- **Что:** в reports добавить toggle compare → две колонки.
- **Как:** дублировать запрос для предыдущего периода.
- **Сложность:** M

### E8. Multi-org rollup для сетей
- **Зачем:** сети из 5+ точек хотят aggregate в одном месте. (Пересекается с #3.3.x roadmap.)
- **Что:** /network/dashboard для parent-org показывает сумму по children.
- **Как:** требует #3.3.1.
- **Сложность:** L

### E9. Прогноз compliance на завтра по weather/holiday
- **Зачем:** в выходные / праздники compliance ниже — фактор. Сейчас не учтён.
- **Что:** статистическая модель «вероятность что завтра упадёт ниже 80%» → push заранее.
- **Как:** простая baseline без ML.
- **Сложность:** M (см. #3.7.2)

### E10. Photo evidence rate — сколько журналов с фото
- **Зачем:** инспектор больше доверяет journals с фото. Метрика «процент с фото» — индикатор качества.
- **Что:** на /reports виджет «Фото-evidence: X% записей за месяц».
- **Как:** count(JournalEntryAttachment) / count(JournalEntry) per month.
- **Сложность:** S

---

## Категория F — Onboarding нового сотрудника / org

### F1. Setup-wizard для нового сотрудника при первом открытии Mini App
- **Зачем:** новенький получает приглашение → открывает Mini App → не понимает.
- **Что:** при первой авторизации (`User.lastLoginAt === null`) — показать тур + чек-лист «отметить медкнижку, прочитать инструкцию по СанПиН».
- **Как:** хук в /mini/page.tsx + 5-шаговый OnboardingChecklist (см. #3.5.1).
- **Сложность:** M

### F2. «Привет, новенький» appearance check для менеджера
- **Зачем:** менеджер не видит когда зашёл новый сотрудник. Информация теряется.
- **Что:** при первом login user'a → push owner'у «Иванов И.И. зашёл в систему первый раз».
- **Как:** detect `lastLoginAt === null` && `user.createdAt < now-1m`.
- **Сложность:** S

### F3. Auto-import продуктов из iiko-экспорта
- **Зачем:** rest пытается import 200 продуктов вручную. Долго.
- **Что:** drag-and-drop iiko XML/Excel → парсер → /settings/products.
- **Как:** добавить format detection в `BulkImport`.
- **Сложность:** M

### F4. Pre-set «типовые» CAPA-сценарии
- **Зачем:** менеджер не знает что писать в CAPA. Дать 10-15 готовых scenario.
- **Что:** в /capa/new — выпадающий «Шаблон» → подставляет title/description/category/preventive.
- **Как:** статический seed array.
- **Сложность:** S

### F5. Wizard «настроить за 5 минут» с прогрессом
- **Зачем:** уже есть `/settings/onboarding`, но нет визуального прогресса.
- **Что:** progress-bar 0-100% «Готовность к работе» с подсказкой «осталось добавить телефоны 3 сотрудников».
- **Как:** вызвать `runOrgHealthCheck()` → перевести в %.
- **Сложность:** S

### F6. Импорт сотрудников через QR-приглашение
- **Зачем:** менеджер раздаёт всем поварам QR-код → каждый сканирует → попадает в bot → автоматически создаётся User.
- **Что:** новая страница /settings/users/qr-invite — большой QR с уникальным token.
- **Как:** generate Token → URL → telegram.me/botname?start=<token> → bot создаёт user.
- **Сложность:** M

### F7. «Демо-погружение» с фейк-данными для оценки
- **Зачем:** новый рестораторщик создал org, не хочет руками всё настраивать чтобы посмотреть как работает. Уже есть seed-demo-org для ROOT — расширить для самообслуживания.
- **Что:** на свежей org кнопка «Заполнить демо-данными» (создаёт 5 сотрудников, 7 дней истории, 2 CAPA).
- **Как:** existing seed logic + UI кнопка.
- **Сложность:** S

### F8. Sample reports «вот так выглядят отчёты на 7-й день»
- **Зачем:** тариф «trial» 14 дней — много кто бросает на 1-3 день не дождавшись «стоит ли продолжать».
- **Что:** на 1-й день — кнопка «Показать пример отчётов» → открывает demo-org через ROOT impersonate.
- **Как:** UI-кнопка с deep-link на demo-org.
- **Сложность:** S

### F9. Welcome-email serie (3 письма)
- **Зачем:** trial-org забывает что подписалась. На день 1, 4, 10 — email со советами.
- **Что:** новый cron, отправка через Resend.
- **Как:** шаблоны + check `user.createdAt`.
- **Сложность:** S

### F10. Dropoff-аналитика для ROOT
- **Зачем:** каждый rest-org проходит часть онбординга и бросает. ROOT хочет видеть «20% не доходят до 3-го шага».
- **Что:** funnel-trcking: User создан → создал журнал → подключил TF → пригласил сотрудника → первое заполнение.
- **Как:** AuditLog action='funnel.<step>' + dashboard.
- **Сложность:** M

---

## Категория G — Производительность и DX

### G1. Server-side кеш для /dashboard
- **Зачем:** /dashboard грузит 8 запросов параллельно. ~600ms на холодную. Можно кешить org-агрегаты на 60s.
- **Что:** Redis или in-memory cache для compliance / health-check / leaderboard.
- **Как:** простой Map с ttl, инвалидация при write.
- **Сложность:** M

### G2. Pagination + virtual scroll для /journals/[code] documents
- **Зачем:** rest с 12-месячной историей имеет 50+ document'ов на одной странице → грузится медленно.
- **Что:** infinite scroll + react-virtual.
- **Как:** API limit/offset + UI хук.
- **Сложность:** M

### G3. Build-time компиляция MD блог-постов
- **Зачем:** /blog рендерит markdown-в-JSX каждый запрос. Медленно для текстов в 5000 слов.
- **Что:** перекомпилировать в HTML на build time.
- **Как:** Next.js `generateStaticParams` + cache.
- **Сложность:** S

### G4. Image optimization для photo attachments
- **Зачем:** photos сейчас отдаются raw. Не resize. Mobile грузит 5MB фоток.
- **Что:** при upload — resize до 1280px width, WebP.
- **Как:** sharp lib в /api/journal-entries/upload.
- **Сложность:** M

### G5. Health endpoint для healthcheck cron
- **Зачем:** PM2 alive не значит app alive. Внешний uptime monitoring (UptimeRobot) хочет endpoint.
- **Что:** GET /api/health → { ok:true, db:ok, version }.
- **Как:** уже есть /api/external/healthz, расширить.
- **Сложность:** S

### G6. Sentry / Bugsnag для production errors
- **Зачем:** сейчас 500-error видим только в pm2 logs. Хочется агрегации.
- **Что:** Sentry SDK init в layout.
- **Как:** `npm i @sentry/nextjs`. Source maps optional.
- **Сложность:** S

### G7. CI: визуальная регрессия (Chromatic / Percy)
- **Зачем:** после моих изменений в дашборде иногда что-то ломается визуально, заметно только в браузере.
- **Что:** на каждый PR — скриншот ключевых экранов сравнить с baseline.
- **Как:** Playwright + folder /screenshots/.
- **Сложность:** M

### G8. Strict TypeScript для всех scripts/_*
- **Зачем:** scripts/_*.ts сейчас могут ломаться без предупреждений в build. Они вне tsc.
- **Что:** tsc --noEmit включает scripts.
- **Как:** уже включает, нужно убедиться.
- **Сложность:** S

### G9. Превратить tsx-команды в npm scripts
- **Зачем:** typing «npx tsx scripts/xxx.ts» — длинно. Хочется `npm run xxx`.
- **Что:** в package.json scripts.
- **Как:** scripts добавить.
- **Сложность:** S

### G10. Auto-format на pre-commit
- **Зачем:** husky + prettier не настроены. Файлы коммитятся в смешанном стиле.
- **Что:** husky install + lint-staged для prettier.
- **Как:** npm install + .husky/pre-commit.
- **Сложность:** S

---

## Категория H — Бизнес-фичи и монетизация

### H1. White-label для франшиз
- **Зачем:** «Магнит-Кафе» хочет своё лого/цвета вместо WeSetup, для своих 50 точек.
- **Что:** Organization.brandColor / logoUrl уже есть. Применять везде в UI + emails.
- **Как:** Provider в layout читает theme + custom CSS vars.
- **Сложность:** M

### H2. Multi-language UI (English, Kazakh, Uzbek)
- **Зачем:** сети в Казахстане/Узбекистане хотят местный язык.
- **Что:** i18n с next-intl.
- **Как:** добавить keys для всех strings, dictionary files.
- **Сложность:** L

### H3. API-marketplace для кастомных адаптеров
- **Зачем:** третьи разработчики хотят интегрировать свои POS / CRM. Нужен публичный API.
- **Что:** OpenAPI doc + Bearer-keys + примеры.
- **Как:** уже есть /api/external/. Расширить + написать docs.
- **Сложность:** L

### H4. Реферальная программа для технологов
- **Зачем:** технолог-консультант приведёт 5 ресторанов = 10% от подписки 12 мес.
- **Что:** Partner модель + UTM-tracking + дашборд для партнёра.
- **Как:** см. #3.13.3.
- **Сложность:** M

### H5. Pay-per-feature billing
- **Зачем:** базовый тариф $20 + IoT $30 + AI $20. Гибко.
- **Что:** activeAddons[] + middleware-checks.
- **Как:** см. #3.13.2.
- **Сложность:** M

### H6. Free-tier «вечно бесплатно» до 5 сотрудников
- **Зачем:** маленькая кофейня = 3 человека = $0 = виральность.
- **Что:** уже частично сделано (per-employee pricing). Оформить как лендинг-bullet.
- **Как:** marketing-копирайт + landing-секция.
- **Сложность:** S

### H7. Gift-subscription «коллега подарит подписку»
- **Зачем:** рестораторщик А рекомендует другу B. Гифт = пробный период оплаченный А.
- **Что:** на /settings/subscription кнопка «Подарить другу 1 месяц».
- **Как:** генерируем gift-code → новая регистрация с code → 30 дней paid.
- **Сложность:** M

### H8. Self-service отказ от подписки
- **Зачем:** сейчас отписка через support. Должна быть кнопка.
- **Что:** /settings/subscription → «Отписаться» → confirm → Organization.subscriptionPlan='cancelled'.
- **Как:** API + UI + email-уведомление.
- **Сложность:** S

### H9. Annual discount автоматически
- **Зачем:** годовая подписка = -20% обычно. Сейчас не предлагается.
- **Что:** на subscription-page «Сэкономить 20% оплатив год вперёд».
- **Как:** UI + ЮKassa annual product.
- **Сложность:** S

### H10. ROI-калькулятор на лендинге
- **Зачем:** рестораторщик не понимает «нужно ли мне это». Показать «сэкономите X часов в неделю / Y₽ на штрафах».
- **Что:** интерактивный slider «сколько у вас сотрудников» → расчёт «сэкономите N часов / N₽».
- **Как:** static React component на /, no backend.
- **Сложность:** S

---

## Категория I — Защита данных и безопасность

### I1. 2FA через Telegram-бот
- **Зачем:** менеджер с правами на штат хочет 2FA. Email-OTP неудобен.
- **Что:** при логине → 6-цифровой код в Telegram → ввод.
- **Как:** одноразовый код через bot.
- **Сложность:** M

### I2. Audit log download для compliance
- **Зачем:** ХАССП-аудитор хочет экспорт «кто что менял за последние 6 месяцев».
- **Что:** на /settings/audit кнопка «Скачать CSV за период».
- **Как:** AuditLog → CSV export.
- **Сложность:** S

### I3. Org data export (GDPR-style)
- **Зачем:** ФЗ-152 о персональных данных требует возможность экспорта всех данных по запросу.
- **Что:** /settings/data-export → ZIP со всеми users/journals/entries.
- **Как:** server-side ZIP с JSON.
- **Сложность:** M

### I4. Account deletion (право на забвение)
- **Зачем:** ФЗ-152, статья 6 — право на удаление.
- **Что:** /settings/account-deletion → DELETE Organization + cascade.
- **Как:** уже есть Cascade в schema.
- **Сложность:** M (нужен confirm с email)

### I5. IP whitelist для admin actions
- **Зачем:** в крупных сетях хотят ограничить admin-доступ только из офиса.
- **Что:** Organization.adminIpWhitelist[] → middleware-проверка.
- **Как:** schema + middleware + UI.
- **Сложность:** M

### I6. Per-action audit logging для admin
- **Зачем:** ROOT impersonate, удаление сотрудника, изменение шаблонов — должны быть в audit.
- **Что:** middleware на admin-actions + AuditLog write.
- **Как:** wrapper-функция withAuditLog().
- **Сложность:** M

### I7. Encryption at rest для sensitive fields
- **Зачем:** телефоны / health data — sensitive. PostgreSQL stores plain.
- **Что:** Prisma middleware encrypt/decrypt для User.phone, StaffCompetency.notes.
- **Как:** AES-256 с key в env.
- **Сложность:** L

### I8. Rate limit на /api/ai/sanpin-chat
- **Зачем:** prevent abuse. Сейчас free-tier 20/мес, paid безлимит — но один юзер может за минуту сожрать.
- **Что:** Redis-based RL: 10 запросов / минуту per user.
- **Как:** уже есть quota system, расширить.
- **Сложность:** S

### I9. Captcha на регистрации
- **Зачем:** сейчас регистрация = форма + email-OTP. Защита от ботов слабая.
- **Что:** Cloudflare Turnstile перед /register/request.
- **Как:** site-key в env, JS виджет.
- **Сложность:** S

### I10. Брут-форс защита для login
- **Зачем:** sign-in/credentials password брутится без задержки.
- **Что:** после 5 неудачных попыток — задержка / lockout.
- **Как:** счётчик в Redis или DB.
- **Сложность:** S

---

## Категория J — Удалённая поддержка и UX-полировка

### J1. In-app screen recording «покажите проблему»
- **Зачем:** support-тикет «не работает» бесполезен без контекста.
- **Что:** рядом с support-widget — кнопка «записать экран» (MediaRecorder).
- **Как:** browser API → upload в support API.
- **Сложность:** M

### J2. Live chat виджет (Crisp / собственный)
- **Зачем:** support через Telegram отвечает за 4 часа. Live chat — 1 минута.
- **Что:** Crisp бесплатный план.
- **Как:** snippet в layout.
- **Сложность:** S

### J3. Dark mode на всём сайте
- **Зачем:** сейчас Mini App dark, dashboard тоже умеет, но не везде.
- **Что:** проверить все surface'ы и доделать.
- **Как:** аудит CSS.
- **Сложность:** M

### J4. Печатный режим (print stylesheet) для отчётов
- **Зачем:** менеджер хочет распечатать compliance-summary. Сейчас при печати — кривая разметка.
- **Что:** @media print CSS.
- **Как:** обработать ключевые компоненты.
- **Сложность:** S

### J5. Keyboard shortcuts для power-users
- **Зачем:** менеджер сидит за PC весь день. Mouse — медленно.
- **Что:** ⌘K — quick search, j/k — навигация по записям, e — edit.
- **Как:** глобальный hotkey-listener.
- **Сложность:** M

### J6. Undo для destructive operations
- **Зачем:** удалили сотрудника по ошибке — потеря всей истории. Cascade жёсткий.
- **Что:** soft-delete + 7-дневный recovery period.
- **Как:** добавить deletedAt + cron purger.
- **Сложность:** L (затрагивает много queries)

### J7. Onboarding UI checklist всегда виден
- **Зачем:** «Здоровье настройки 5/8» виджет уже есть. Сделать его более активным.
- **Что:** при кликнутии «настроить» — открывать прямо в нужном месте через ?focus= параметр.
- **Как:** существующий widget + URL-deep-link.
- **Сложность:** S

### J8. «Что нового» modal после деплоя
- **Зачем:** мы шипим фичи, юзеры не замечают.
- **Что:** при первом login после новой версии — modal «За эту неделю мы добавили: ...».
- **Как:** хранить version в localStorage + сравнивать с .build-sha.
- **Сложность:** S

### J9. Help-tooltips на каждом поле формы
- **Зачем:** worker не знает что писать в `result` поле. Tooltip с примером.
- **Что:** ⓘ icon + popover с подсказкой.
- **Как:** обновить FormField type + UI.
- **Сложность:** M

### J10. Контекстная Help-страница для каждого журнала
- **Зачем:** в `/sanpin` есть общие нормативы. Хочется per-журнал страничку.
- **Что:** /journals/<code>/help → markdown + примеры из истории org.
- **Как:** static MD + dynamic example.
- **Сложность:** M

---

## Категория K — Интеграции с внешними системами

### K1. Google Calendar для смен
- **Зачем:** менеджер ведёт график смен в Google Calendar. Хочется sync.
- **Что:** Org.googleCalendarId → cron подтягивает события → создаёт WorkShift.
- **Как:** Google API OAuth + cron.
- **Сложность:** M

### K2. Bitrix24 для лидов
- **Зачем:** заявки с landing → leads в Bitrix.
- **Что:** webhook на /api/auth/register → POST Bitrix.
- **Как:** см. #3.9.6.
- **Сложность:** M

### K3. iiko / Poster / r_keeper
- **Зачем:** auto-sync блюд в finished_product.
- **Что:** см. #3.9.1.
- **Сложность:** L

### K4. Slack notifications вместо Telegram
- **Зачем:** западные клиенты в Slack.
- **Что:** Org.slackWebhookUrl + альтернатива Telegram.
- **Как:** новая телега-абстракция.
- **Сложность:** M

### K5. WhatsApp Business API
- **Зачем:** регионы где Telegram заблочен.
- **Что:** см. #3.9.3.
- **Сложность:** M

### K6. Xero / QuickBooks для exit-зарубеж
- **Зачем:** эмигрировавшие рестораторщики хотят бух-интеграцию англо-tier.
- **Что:** OAuth + експорт.
- **Сложность:** L

### K7. Asana / Trello для CAPA
- **Зачем:** менеджеры уже работают в Trello. Дублировать CAPA туда.
- **Что:** Asana API → 1-way push.
- **Как:** хук на CAPA create/update.
- **Сложность:** M

### K8. Mail.ru / Yandex domains login
- **Зачем:** многим неудобно gmail/icloud.
- **Что:** OAuth provider for Yandex/Mail.
- **Как:** NextAuth-провайдеры.
- **Сложность:** S

### K9. Альфа-банк / Сбер для приёма платежей
- **Зачем:** ЮKassa пока не охватывает все банки.
- **Что:** альтернатива.
- **Сложность:** L

### K10. Zapier-интеграция через webhooks
- **Зачем:** lazy way для пользовательских интеграций.
- **Что:** Org.webhookUrls[] → выстреливает на journal events.
- **Как:** webhook config + sender.
- **Сложность:** M

---

## Категория L — Машинное обучение и AI (после RAG)

### L1. Predict «вероятность нарушения завтра»
- **Зачем:** менеджер не знает что приоритезировать. Predict даст «у вас 70% что cold_eq упадёт завтра».
- **Что:** простой baseline по historical pattern → push «обратите внимание на X».
- **Как:** SQL-агрегаты + threshold.
- **Сложность:** M

### L2. Anomaly detection в температурах
- **Зачем:** холодильник медленно деградирует — t° слегка выше нормы N дней. Сейчас alert только при критическом отклонении.
- **Что:** detect рост mean t° за 7 дней > 1°C → push «подозрительно».
- **Как:** rolling avg.
- **Сложность:** M

### L3. AI-генератор «инструкции по гигиене для нашей кухни»
- **Зачем:** менеджер пишет инструкцию для новых сотрудников вручную. AI → за 30 сек draft.
- **Что:** Claude Sonnet с org-контекстом → MD-doc.
- **Как:** existing chat infra.
- **Сложность:** S

### L4. Vision-проверка фото записей
- **Зачем:** worker фотает «не то» (палец, размытое). Не видно сразу.
- **Что:** при upload — Claude Vision проверяет «фото содержит еду / продукт / документ»?
- **Как:** existing /api/ocr.
- **Сложность:** M

### L5. AI-suggest продукты при заполнении brakeraj
- **Зачем:** worker пишет productName руками. Часто опечатки.
- **Что:** autocomplete по последним 100 product names в org.
- **Как:** SELECT distinct + frontend.
- **Сложность:** S

### L6. Speech-to-form через Mini App
- **Зачем:** руки заняты. Голос быстрее.
- **Что:** см. A4. Дублирую идею в L (более широкий контекст).
- **Сложность:** M

### L7. AI-переводчик инструкций для иностранных рабочих
- **Зачем:** в РФ много мигрантов. Инструкция на русском — не понимают.
- **Что:** /journal/<code>/help → toggle «таджикский / узбекский».
- **Как:** Claude Sonnet перевод + сохранять переводы в JSON.
- **Сложность:** M

### L8. AI-резюме инцидентов для еженедельного дайджеста
- **Зачем:** weekly-digest показывает цифры. AI-короткий «narrative» — почему упало compliance.
- **Что:** 3-5 предложений «на этой неделе главные проблемы: X, Y, Z, рекомендую: A».
- **Как:** Claude Haiku + контекст.
- **Сложность:** S

### L9. Auto-классификация writeoff причин
- **Зачем:** в losses cause = текст. Хочется автокатегория «expired / damaged / temperature / pest».
- **Что:** при save losses → Claude Haiku → category.
- **Как:** trigger в /api/losses POST.
- **Сложность:** S

### L10. AI-чат-бот для рекрутинга поваров
- **Зачем:** «найти повара через WeSetup» — фантазия, но потенциально.
- **Что:** marketplace вакансий.
- **Сложность:** XL

---

## Категория M — Операционная автоматика

### M1. Auto-create journal documents на следующий месяц
- **Зачем:** уже есть autoJournalCodes. Расширить — за 7 дней до конца месяца автоматически создать на следующий.
- **Что:** cron 25-го числа создаёт документы.
- **Как:** уже есть auto-create — добавить look-ahead.
- **Сложность:** S

### M2. Auto-archive старых документов
- **Зачем:** 12-месячный архив занимает место. После 1 года — архивировать (status=closed, dropdown показ).
- **Что:** ежемесячный cron.
- **Как:** UPDATE status WHERE dateTo < now-365d.
- **Сложность:** S

### M3. Auto-purge старого AuditLog
- **Зачем:** для compliance 30 дней нужно. После — оставлять aggregates, raw деталей удалять.
- **Что:** cron.
- **Как:** уже есть для TelegramLog. Расширить.
- **Сложность:** S

### M4. Schedule-aware compliance
- **Зачем:** сейчас compliance считает все 35 журналов. Если выходной — не нужно ждать заполнение.
- **Что:** учитывать WorkShift при расчёте % — если все на off, journals = N/A.
- **Как:** в today-compliance helper добавить proximity.
- **Сложность:** M

### M5. Auto-rotate ответственных
- **Зачем:** один сотрудник всегда заполняет hygiene. Болеет — никто не подменяет.
- **Что:** round-robin при создании WorkShift или TF-task.
- **Как:** простая прогрессия по userId modulo.
- **Сложность:** S

### M6. Auto-pause podpiski при offline > 30 дней
- **Зачем:** rest закрылся / на ремонте. Не должны платить.
- **Что:** cron — если activity = 0 за 30 дней → freeze.
- **Как:** Org.subscriptionPlan = 'paused'.
- **Сложность:** S

### M7. Auto-recreate cron-tasks через Worker (BullMQ)
- **Зачем:** сейчас cron внешний. Если упадёт — задачи не выполняются. Лучше — внутренний.
- **Что:** BullMQ + Redis для in-app cron.
- **Как:** install BullMQ.
- **Сложность:** L

### M8. Auto-export logs в S3 для архива
- **Зачем:** local DB растёт. Старые TelegramLog — отправлять в cheap-storage.
- **Что:** cron перекидывает >30d records в S3.
- **Как:** S3 SDK + drop strategy.
- **Сложность:** M

### M9. Dead-man switch alert
- **Зачем:** если cron не пинговал systems 24 часа — alert админу.
- **Что:** /api/health.lastPinged + cron-job.org pinger + alert.
- **Как:** добавить timestamp + email при missing.
- **Сложность:** S

### M10. Auto-rename journals на «новогодние»/«майские»
- **Зачем:** на праздники compliance падает. Хочется псевдо-автомат — «майские → закрываем половину журналов автоматически».
- **Что:** holidays-list + auto-toggle disabledJournalCodes.
- **Как:** static JSON с праздниками + cron.
- **Сложность:** M

---

## Категория N — Quality of Life мелочи

### N1. Кнопка «Скопировать ID» рядом с Equipment в админке
- **Зачем:** для DIY-датчиков нужен Equipment.id. Сейчас копировать через Inspector tools.
- **Что:** ⓘ-кнопка в /settings/equipment.
- **Как:** navigator.clipboard.writeText.
- **Сложность:** S

### N2. Sortable columns в /capa и /losses
- **Зачем:** сортировка по дате/приоритету. Сейчас фиксированная.
- **Что:** click-to-sort на header.
- **Как:** UI state + sort fn.
- **Сложность:** S

### N3. Bulk-actions на /capa (multi-select)
- **Зачем:** закрыть 10 старых CAPA одним движением.
- **Что:** checkbox-row + dropdown «Закрыть все».
- **Как:** UI + bulk API.
- **Сложность:** M

### N4. Search bar в /journals
- **Зачем:** 35 журналов, найти «glass» долго.
- **Что:** ⌘K-style fuzzy search.
- **Как:** existing journal-browser + filter.
- **Сложность:** S

### N5. Collapsable sections в /settings
- **Зачем:** /settings — 28 карточек. Сложно навигировать.
- **Что:** группировать по категориям с sticky-header.
- **Как:** UI рефакторинг.
- **Сложность:** S

### N6. Timezone-aware расчёты
- **Зачем:** Москва UTC+3. Сейчас всё в UTC. Менеджер видит «вчера» по UTC, не по местному.
- **Что:** Organization.timezone + перевод дат.
- **Как:** Intl.DateTimeFormat с timezone.
- **Сложность:** M

### N7. Tooltip с avatar при hover на user
- **Зачем:** в журнале «filledById = X» — не видно кто это.
- **Что:** hover → popup с user.name + position + photo.
- **Как:** UserAvatarPopover wrapper.
- **Сложность:** S

### N8. Кнопка «Поделиться» на отчёте
- **Зачем:** менеджер хочет послать compliance-bundle коллеге.
- **Что:** mailto: с pre-filled subject + body.
- **Как:** simple <a href="mailto:...">.
- **Сложность:** S

### N9. Avatars из Telegram при login
- **Зачем:** placeholder «И» вместо лиц. Bot имеет фотки юзеров.
- **Что:** при первом login через TG — pull avatar URL.
- **Как:** bot.api.getUserProfilePhotos.
- **Сложность:** S

### N10. ⌘K command palette
- **Зачем:** power-user быстрая навигация.
- **Что:** ⌘K → search routes / users / docs.
- **Как:** cmdk lib.
- **Сложность:** M

---

## Категория O — Уникальные дифференциаторы (think outside box)

### O1. Goal-setting и gamification
- **Зачем:** worker мотивация. «Сегодня 100% compliance — +500₽ к зарплате».
- **Что:** уже есть BonusEntry. Расширить с UI «Goals: достигни 100% compliance 7 дней подряд → 5000₽».
- **Как:** Goal модель + tracking.
- **Сложность:** M

### O2. Лидерборд между сетевыми точками
- **Зачем:** 50 точек сети — кто лучший по compliance в этом месяце.
- **Что:** на /network/leaderboard ранжирование.
- **Как:** требует #3.3.x.
- **Сложность:** L

### O3. AI-сгенерированный sticker-pack для achievements
- **Зачем:** «Вы выполнили 100 hygiene без пропусков! [стикер]».
- **Что:** Telegram sticker pack achievement.
- **Как:** generate via DALL-E + bot.uploadStickerFile.
- **Сложность:** M

### O4. «Школа повара» курсы прямо в Mini App
- **Зачем:** новенький проходит обучение. Дать встроенный курс в TG.
- **Что:** /mini/learning — 10 видео + quiz.
- **Как:** static content + tracking.
- **Сложность:** L

### O5. Сертификат «знаток ХАССП» после обучения
- **Зачем:** мотивация работника + компании показать «у нас все обучены».
- **Что:** PDF-сертификат с QR.
- **Как:** уже есть certificate gen, расширить.
- **Сложность:** S

### O6. Маркетплейс шаблонов «купи готовую систему ХАССП»
- **Зачем:** другие рестораны успешные → продают конфигурацию.
- **Что:** см. #3.3.4.
- **Сложность:** L

### O7. AR-разметка на холодильниках через Mini App
- **Зачем:** worker наводит камеру → видит «холодильник №3, норма 2..6, последний замер 4°C».
- **Что:** WebXR + camera.
- **Как:** experimental, но можно.
- **Сложность:** XL

### O8. Voice-assistant для слабовидящих
- **Зачем:** accessibility.
- **Что:** screen reader + voice-driven flow.
- **Как:** ARIA-attribute + custom voice handler.
- **Сложность:** L

### O9. «Тёплая» поддержка через AI с эмпатией
- **Зачем:** саппорт-агенты не всегда дружелюбны. AI может быть.
- **Что:** /support widget — Claude отвечает first-line.
- **Как:** existing chat infra с другим system-prompt.
- **Сложность:** M

### O10. Ребенок-моде для домохозяек (HACCP at home)
- **Зачем:** мамы хотят отслеживать срок продуктов в холодильнике.
- **Что:** mini-version WeSetup для домашнего использования.
- **Как:** stripped-down profile.
- **Сложность:** L (новый сегмент рынка)

---

## Приоритизация для следующих ночных batch'ей

**Топ-10 S-задач для немедленной реализации (≤30 мин каждая):**
1. A1 — auto-fill вчерашнего для всех полей
2. A6 — фильтр on-duty при bulk-assign
3. A7 — smart-time подстановка
4. B1 — auto-CAPA при rejected входной партии
5. C1 — bot-команда /help <журнал>
6. E2 — heatmap по дням недели
7. E3 — worst-employee leaderboard
8. F2 — push owner'у при first-login нового сотрудника
9. F4 — pre-set CAPA scenarios
10. M1 — auto-create на следующий месяц за 7 дней

**Топ-5 M-задач для ночных batch'ей (≤90 мин каждая):**
1. A4 — voice-input через Whisper
2. C7 — групповые TG-чаты для CAPA эскалаций
3. D7 — bottom-sheets вместо modal
4. E1 — compliance trend graph
5. M4 — schedule-aware compliance

**Готовые L-задачи на следующее обсуждение:**
1. D3 — offline mode (см. #3.11.1)
2. K3 — iiko (см. #3.9.1)
3. K6 — Xero
4. M7 — BullMQ in-app cron

**Deferred / нужен отдельный продуктовый brief:**
1. H2 — multi-language
2. O7 — AR-разметка
3. O10 — child-mode для домохозяек
4. K9 — банковские интеграции

---

**Конец brainstorm.** Файл — рабочий, обновляется по мере реализации. После реализации — переносить в `FEATURES_AND_AUTOMATION.md` § Recently shipped.
