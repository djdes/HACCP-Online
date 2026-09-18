# evidence — journal-time-edit-2026-09

Дата: 2026-09-18. Стенд: dev `localhost:3020`, БД — туннель в прод,
организация «Кафе „Тестовое 1“», пользователь `e2e-fill-guide@wesetup.local`.
Скрипты: `e2e/snapshot.ts snapshot|check|restore` (документ климата),
`e2e/toggle-journals.ts enable|restore` (временное включение журналов),
`e2e/verify.ts` → `e2e/results.json`. Скриншоты `shots/*.png` (не в git).

| AC | Вердикт | Доказательство |
|----|---------|----------------|
| AC1 | PASS | Климат `cmt6j45ne0hy482ts2ii5wkkd`: внесён замер 21.5 под «10:00» → клик по «10:00» в шапке → окно «Время контроля» → «09:30»: заголовок «10:00» исчез, «09:30» появился, значение 21.5 на месте; после перезагрузки под «09:30» — 21.5 (`ac1_afterReload`). На 390px в карточках чипы «Время контроля: 09:30 · 17:00» (`ac1_mobileChips: 2`). Обратный перенос «09:30 → 10:00» вернул замер (`snapshot.ts check`: `room-0@10:00 temperature 21.5`). |
| AC2 | PASS | «Настройки журнала» идут через тот же `set_control_times` (`handleSaveSettings` → `handleSetControlTimes`); unit-тест `renameClimateControlTimes` покрывает перенос замеров и комментариев, а также переезд на занятое время. |
| AC3 | PASS | Вентиляция `cmt6j45qy0hzf82ts36em34xh`, автозаполнение выключено (`aria-checked=false`): в таблице 540 селектов времени, заблокированных 0; в карточках после раскрытия — 3 подсказки «нажмите, чтобы изменить время», лист с 3 полями `type=time` (`ac3_*`, `05b-vent-sheet.png`). |
| AC4 | PASS | Входной контроль `cmt6j45uq0i0e82tsvi4cnl97`: «Добавить» → «Добавление новой строки» → поле «Время поставки» (`input[type=time]`) рядом с датой (`ac4_timeField`, `06-incoming-dialog.png`). Значение пишется в `deliveryHour/deliveryMinute` через `splitTimeValue`. |
| AC5 | PASS | `node --test src/lib/climate-control-times.test.ts`: 5/5; `npm run typecheck` — чисто; eslint по изменённым файлам — 0 ошибок. |

Откат: `snapshot.ts restore` вернул конфиг и записи документа климата
(включая внесённый замер), `toggle-journals.ts restore` вернул список
отключённых журналов организации.
