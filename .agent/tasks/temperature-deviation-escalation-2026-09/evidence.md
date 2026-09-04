# Evidence — отклонения температуры: ответственному, затем руководству

Дата проверки: 2026-09-04. Коммиты: `47fa0332` (функционал),
`80c74bd7` (SHA заметок). Прод `.build-sha` = `80c74bd7`, PM2 online.

## Как было (проверено по коду до правки)

- Алерт слал `notifyOrganization(..., ["owner","technologist"], "temperature")`
  всем управляющим — одинаково в `tuya/collect`, `journals` (temp_control)
  и `equipment-fill`. Ответственный за журнал (`JournalDocument.responsibleUserId`)
  не использовался нигде.
- Дедупа не было: каждое out-of-range показание = новый пуш.
- Эскалации не было вообще.
- `cron/tuya-pull` (основной mapping-driven путь) не слал алерт совсем.
- Сеточный журнал `cold_equipment_control` (`journal-documents/[id]/entries`
  PUT и `mini/documents/[id]/entries` POST) не уведомлял никого.
- Прод: 0 `Equipment.tuyaDeviceId`, 0 sensor-mapping'ов, 114 единиц с
  нормами; в crontab не было ни `tuya/collect`, ни `tuya-pull`. То есть
  реальные отклонения приходят из ручных записей — путь, который молчал.

## Результаты по критериям

| AC | Что проверяли | Итог |
|----|----------------|------|
| AC1 | Первое отклонение → инцидент + пуш ответственному; без него — руководству | PASS (unit + прогон на dev-БД) |
| AC2 | Повторное показание не плодит инцидент и не шлёт второй пуш | PASS (`updated`, 1 строка в БД) |
| AC3 | Возврат в норму / комментарий закрывает инцидент | PASS (`resolved`, reason `in_range` / `correction`) |
| AC4 | Эскалация ровно один раз, только при включённом флаге | PASS (unit: 1 сообщение; при выключенном — 0) |
| AC5 | Крон защищён секретом | PASS (без секрета 401, с секретом `{"ok":true,...}`) |
| AC6 | Все 7 входов вызывают обработчик, старые блоки удалены | PASS (`grep "Отклонение температуры!" src/app/api` = 0) |
| AC7 | Настройка сохраняется, валидация 5…1440 | PASS (120 сохранилось; 3 → 400 «от 5 до 1440 минут») |
| AC8 | Лендинг: строка про уведомления | PASS (видна на wesetup.ru) |
| AC9 | typecheck / lint / тесты | PASS (0 ошибок в `src/`, 490 тестов) |
| AC10 | Прод: крон в crontab, эндпоинт 200, страница жива | PASS |

## Прогон жизненного цикла на dev-БД (реальные Prisma-записи)

```
1) отклонение: opened          → ОТВЕТСТВЕННОМУ: «Температура вышла за норму»
2) ещё одно:  updated          → сообщений нет
   открытых инцидентов в БД: 1
3) крон эскалации: {"checked":1,"escalated":1}
                               → РУКОВОДСТВУ: «Отклонение не исправлено» + письмо
4) возврат в норму: resolved   → обоим: «Температура вернулась в норму»
   инцидент: first=16 last=3 notified=true escalated=true resolved=true reason=in_range
5) разбор строки журнала целиком → открытых инцидентов: 1
```

## Прод после деплоя

```
.build-sha                       80c74bd7896ebf13147ac8418bb7a6feb931a619
pm2 haccp-online                 online
GET /api/cron/deviation-escalations           401 (без секрета)
GET  -H Authorization: Bearer …               {"ok":true,"checked":0,"escalated":0}
GET /settings/compliance                      307 (редирект на вход — ожидаемо)
таблица TemperatureDeviationIncident          18 колонок создано
Organization: escalate=t, minutes=60          94 организации
crontab                                       */5 * * * * … /api/cron/deviation-escalations
```

## Побочная правка

Гейт `npm run typecheck` в деплое падал на трёх ошибках Prisma-типов в
`src/lib/tasksflow-adapters/cleaning.ts` из коммита `422456a5` — master
не выкладывался (прогоны `4e559ac0`, `6b0499b4` — failure). Починено
существующим хелпером `toPrismaJsonValue`; после этого деплой прошёл.

## Что вне scope

- Журнал микроклимата (`climate_control`): влажность и температура
  помещений через тот же обработчик не идут — у комнат нет min/max в
  конфиге. Отмечено как отдельная задача.
- CAPA-тикеты (`iot_realtime`, 3-дневный паттерн) остались как были.
