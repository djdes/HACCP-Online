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
