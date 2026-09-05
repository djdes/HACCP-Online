# profile-nudge-compact-2026-09 — evidence

Дата: 2026-09-05. Dev-сервер `localhost:3020`, Playwright Chromium (`channel: "chrome"`),
throwaway-менеджер без телефона в org «Кафе Тестовое 1» (анкета показывается по
`?welcome=1`). Скрипт `check.ts` → `results.json`, скриншоты `shots/`.

| AC | Результат | Доказательство |
| --- | --- | --- |
| AC1 форма без скролла на 390×758 / 390×844 / 1280×900 | PASS | `results.json`: `m758.formScroll` 454/454 `fits=true`, `m844` 454/454, `desktop` 442/442; модалка 685px при 758 (`max-h-[94dvh]`); `shots/01-mobile-758.png`, `shots/04-desktop.png` |
| AC2 «Я сотрудник» + «Должность» в одной строке, без галочки поле скрыто | PASS | `positionHiddenWhenUnchecked=true`; `shots/02-mobile-unchecked.png` |
| AC3 пары полей, промо одной строкой, кнопки в ряд | PASS | ряды формы (px): [55, 95 (телефон + промо-строка), 55, 55, 63, 59]; на десктопе промо справа от телефона (95 → 55); `shots/03-mobile-filled.png` |
| AC4 автопароль 6 знаков + перегенерация + ручной ввод | PASS | `regenerate.changed=true`, `pattern=true` (`^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!?#*+=@]).{6}$`); `password-suggest.test.ts` — 3 теста (200 генераций: длина, регистры, цифра, ровно один спецсимвол, без 0/O/1/l/I) |
| AC5 письмо о новом пароле | PASS (код) | `sendPasswordChangedEmail` в `src/lib/email.ts`, вызов после транзакции в `/api/profile/complete` с `.catch` как при регистрации; отправка не проверялась вживую (SMTP-relay только на проде) |
| AC6 typecheck / eslint / tests | PASS | typecheck exit 0; eslint затронутых файлов 0 ошибок; `npm test` — см. лог коммита (pre-commit гейт) |

Примечание: форму в dev не отправляли, чтобы не переписывать название и
телефон тестовой организации; статус «Всё заполнено» и активная «Готово»
проверены (`statusAllFilled=true`, `submitEnabled=true`).

## Итерация 2 (2026-09-05, правки владельца по скриншотам с прода)

Скрипты `check2.ts` → `results-v2.json`, `check3.ts`; скриншоты `shots/05-mobile-v2.png`, `shots/06-after-close.png`.

| Пункт | Результат | Доказательство |
| --- | --- | --- |
| Убрана фраза про пароль в шапке | PASS | `layout.headerText = "Аккаунт создан! Логин: …"` |
| «Точек» и «Пароль для входа» той же высоты, что остальные поля | PASS | `layout.fieldHeights` — девять полей по 55px, `allFieldsSameHeight=true`; форма по-прежнему без скролла на 390×758 (465/465) |
| Промо TasksFlow с подписью «задачи сотрудникам» (прежний компактный блок) | PASS | `layout.promoText = "TasksFlow.ru — задачи сотрудникам WESETUP50 −50 % на первый месяц Перейти"`; однострочный вариант удалён из кода |
| Фон не прокручивается под всплывашками (iOS-safe, по всему сайту) | PASS | `src/lib/use-body-scroll-lock.ts` (body `position: fixed; top: -scrollY`, счётчик вложенности, компенсация полосы прокрутки); при открытой анкете и при открытом «Как заполнить?» `body.position=fixed`, колесо не двигает страницу (`scrollY` 0); после закрытия «Как заполнить?» `position=static`, колесо прокручивает (`scrollY` 600). После закрытия анкеты блокировку удерживает окно «14 дней тестового периода прошли» тестовой организации, стоящее за ней (`check3`: overlays after close), — это корректно |
| Охват | — | 6 самописных окон переведены с `body.style.overflow` на общий lock (ConfirmDialog, prompt-async, «Что нового», «Как заполнить?», sheet гайда, task-fill helper); в 16 оверлеев без блокировки добавлен `<BodyScrollLock />` (mini-tour, photo-uploader, activity-drawer, blog-admin, task-fill ×2, sanpin-chat, bonus-feed, stale-capa-nag, trial-expired, command-palette, create-demo, create-organization, notifications-bell, photo-lightbox, staff-bulk-add, staff-qr-invite). Radix `Dialog`/`Sheet`/`partner-hint` блокируют сами (react-remove-scroll). Оверлей импорта Excel (product-writeoff) и спотлайт-тур намеренно без блокировки |

## Итерация 3 (2026-09-05, второй круг замечаний)

Скрипт `check4.ts` → `results-v3.json`, скриншот `shots/07-mobile-v3.png` (390×758).

| Пункт | Результат | Доказательство |
| --- | --- | --- |
| Под телефоном нет текста «Формат: …», невалидный номер подсвечен рамкой | PASS | `hasFormatText=false`, `phoneRedBorder=true` |
| Нет строки «Осталось: …» / «Всё заполнено» | PASS | `hasStatusLine=false` |
| «Показать демо» слева, «Готово» справа, подпись про демо под кнопкой демо | PASS | `demoLeftOfDone=true`, `captionUnderDemo=true`, `caption="Отдельная организация на 7 дней"` |
| Иконка шапки — пользователь с ручкой вместо звёздочек | PASS | `headerIcon="lucide-user-round-pen"` |
| Форма без прокрутки на 390×758 | PASS | `fits=true`, высота модалки 654px |

## Итерация 4 (2026-09-05): «+7» в телефонах и автозаполнение по ИНН

Скрипты `check-phone.ts` → `results-phone.json`, `check-inn.ts` → `results-inn.json`, скриншоты `shots/08-phone-typed.png`, `shots/09-inn-autofill.png`.

| Пункт | Результат | Доказательство |
| --- | --- | --- |
| Телефон: «+7 » при фокусе, формат по мере ввода, лишние цифры, backspace через разделители, «8…», очистка, blur, вставка | PASS | `results-phone.json`: afterFocus `+7 `, afterTyping `+7 999 123-45-67`, extraDigitIgnored, afterBackspace3 `+7 999 123-4`, localFormatTyped `+7 985 123-45-67`, afterClearAll `""`, blurPrefixOnlyClears `""`, pasteFormatted `+7 912 000-11-22`; `phone-input.test.ts` 5 тестов |
| Охват телефона | — | 17 полей в 15 файлах через `phoneInputProps` (анкета, привязка телефона, join, order, обратная связь, виджет поддержки, сотрудники ×3, массовое добавление, настройки организации, партнёрские формы ×2, Mini App staff) |
| `/api/public/inn-lookup`: расширенный ответ + контрольная сумма | PASS | Сбербанк 7707083893 → name, address «г Москва, ул Вавилова, д 19», directorName, kpp, ogrn, ownershipKind `private`, sphere `null` (ОКВЭД 64.19); 1234567890 → 400 «Такого ИНН не бывает»; ИП 500100732259 → найден, type INDIVIDUAL |
| Анкета: автозаполнение по ИНН | PASS | `afterLookup.name = "ПАО СБЕРБАНК"`, индикатор «Найдено в ЕГРЮЛ», тост «Из ЕГРЮЛ: ПАО СБЕРБАНК», selects сохранили значения (сфера не определена по ОКВЭД банка); `customNameKept = "Моё кафе"` — своё название не перетирается вторым ИНН |
| Ключ DaData | — | добавлен в prod `.env` (и `.env.bak`), локально в `.env.local`; в репо только плейсхолдеры (`.env.example`, `.env.shared`, CLAUDE.md) |
| typecheck / lint / tests | PASS | typecheck exit 0, eslint 0 ошибок, `inn.test.ts` + `org-lookup-map.test.ts` зелёные |

## Итерация 5 (2026-09-05): шапка, ФИО и должность из ЕГРЮЛ, профиль организации в настройках

Скрипт `check-legal.ts` → `results-legal.json`, скриншоты `shots/10-inn-person.png`, `shots/11-settings-legal.png`.

| Пункт | Результат | Доказательство |
| --- | --- | --- |
| Линия под шапкой анкеты убрана | PASS | `header.borderBottom = "0px"` |
| Иконка-подсказка в поле ИНН до ввода (лупа), спиннер/галочка/предупреждение после | PASS | `header.idleIcon = true`, ранее `Найдено в ЕГРЮЛ` |
| По ИНН подставляются ФИО и должность руководителя (или сам ИП) | PASS | `autofill.person = "Греф Герман Оскарович"`, `autofill.position = "Президент, Председатель Правления"`, `autofill.org = "ПАО СБЕРБАНК"` |
| Снимок ЕГРЮЛ хранится в организации (`legalProfileJson`, `legalProfileUpdatedAt`) и обновляется анкетой и кнопкой | PASS | `POST /api/settings/organization/legal-profile` → `refreshToast = ["Данные из ЕГРЮЛ обновлены"]`; `/api/profile/complete` вызывает `refreshOrganizationLegalProfile` |
| Секция «Данные из ЕГРЮЛ» в /settings/organization | PASS | `legalRows`: полное название, форма, ОГРН с датой, КПП, юр. адрес, руководитель с должностью, основной ОКВЭД, статус с датой регистрации, филиалы; пустые поля скрыты |
| Маппинг DaData → профиль | PASS | `org-legal-profile.test.ts` 3 теста (юрлицо со статистикой, ИП, регистр имён) |
| Схема | — | `prisma db push` в dev-БД: in sync; на проде колонки добавит деплой (`prisma db push` в step 3/3) |

Ограничение: на текущем тарифе DaData (Suggestions) не приходят численность, капитал, финансы, учредители и названия ОКВЭД — строки появятся автоматически при переходе на расширенный тариф, код их уже читает.
