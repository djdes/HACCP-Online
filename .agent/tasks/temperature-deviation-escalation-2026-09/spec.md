# Отклонения температуры: ответственному сразу, руководству — если не исправлено

Заморожено: 2026-09-04. Заказчик: владелец проекта (сообщение в чате
2026-09-04, скриншот блока «Температура пишется сама»).

## Проблема

Лендинг обещает «температура пишется сама». Владелец хочет дописать:
«если есть отклонения — сразу сообщается ответственному за журнал, если
не исправляется — отправка руководству (по желанию)». По коду это
сейчас НЕ так:

- Алерт при выходе за норму уходит всем управляющим (`notifyOrganization`,
  роли manager/head_chef/legacy owner/technologist), а не ответственному
  за журнал (`JournalDocument.responsibleUserId` нигде не используется).
- Эскалации нет: если никто не отреагировал — второго уведомления нет.
- Основной путь пользователей — сеточный журнал «Контроль холодильного
  оборудования» (`/api/journal-documents/[id]/entries` PUT и Mini App
  `/api/mini/documents/[id]/entries` POST) — не уведомляет вообще никого.
- Cron `tuya-pull` (mapping-driven) не шлёт мгновенный алерт, только CAPA.
- На проде: 0 Equipment с `tuyaDeviceId`, 0 sensor-mappings, 114 единиц
  оборудования с нормами; в crontab нет ни `tuya/collect`, ни
  `tuya-pull`. Значит отклонения приходят из ручных записей.

## Решение

Единый обработчик `processTemperatureReading` в
`src/lib/temperature-deviations.ts` + модель `TemperatureDeviationIncident`.

Жизненный цикл инцидента (ключ `subjectKey` = `equipment:<id>` или
`doc:<documentId>:<itemId>`):

1. Показание вне нормы, открытого инцидента нет → создать инцидент,
   найти ответственного (doc.responsibleUserId → активный документ
   cold_equipment_control с `config.equipment[].sourceEquipmentId` →
   `journalResponsibleUsersJson[cold_equipment_control][primary]`),
   отправить ему Telegram с инструкцией. Если ответственного нет или у
   него нет Telegram → сразу руководству (Telegram + e-mail), как раньше.
2. Показание вне нормы, инцидент открыт → обновить lastValue/lastReadingAt.
3. Показание в норме или вписан комментарий «что сделали»
   (`corrections[itemId]`) → закрыть инцидент, сообщить тем, кого
   уведомляли («вернулось в норму»).
4. Cron `/api/cron/deviation-escalations` (каждые 5 минут) и каждый
   вызов обработчика: если инцидент открыт дольше
   `Organization.deviationEscalationMinutes` (default 60) с момента
   уведомления ответственного, `escalateDeviationsToManagement=true`
   (default true) и ещё не эскалирован → руководству Telegram + e-mail,
   `escalatedAt` проставлен (ровно один раз на инцидент).

Настройка — карточка на `/settings/compliance`: Switch «Сообщать
руководству, если ответственный не исправил» + select минут
(30/60/120/240). API `/api/settings/compliance` расширен.

Точки вызова обработчика (все существующие пути ввода температуры):
`tuya/collect`, `cron/tuya-pull`, `external/sensors`,
`equipment-fill/[equipmentId]`, `journals` (temp_control),
`journal-documents/[id]/entries` PUT (cold_equipment_control),
`mini/documents/[id]/entries` POST (cold_equipment_control).
Старые дублированные alert-блоки в первых пяти заменены вызовом.

## Acceptance criteria

- AC1. `processTemperatureReading` при out-of-range и отсутствии открытого
  инцидента создаёт `TemperatureDeviationIncident` и вызывает
  `notifyEmployee(responsibleUserId, …)`; при отсутствии ответственного —
  `notifyOrganization` + e-mail руководству. Покрыто unit-тестом с DI.
- AC2. Повторное out-of-range показание по тому же subject не создаёт
  второй инцидент и не шлёт повторное уведомление ответственному.
- AC3. Показание в норме (или корректирующий комментарий) закрывает
  инцидент (`resolvedAt`) и шлёт «вернулось в норму» уведомлённым.
- AC4. Эскалация: при открытом инциденте старше N минут и включённом
  флаге — ровно одно уведомление руководству (Telegram + e-mail),
  `escalatedAt` проставлен; при выключенном флаге — ничего. Unit-тест.
- AC5. Cron `/api/cron/deviation-escalations` защищён `checkCronSecret`
  (401 без секрета) и вызывает эскалацию по всем открытым инцидентам.
- AC6. Все 7 точек ввода вызывают обработчик; старые alert-блоки
  удалены (grep `Отклонение температуры!` в src/app/api → 0).
- AC7. `/settings/compliance` показывает Switch и select минут;
  PATCH сохраняет `escalateDeviationsToManagement` и
  `deviationEscalationMinutes` (валидация 5…1440).
- AC8. Лендинг: под блоком «Температура пишется сама» строка про
  уведомление ответственному и эскалацию руководству.
- AC9. `npx tsc --noEmit --skipLibCheck` без новых ошибок в `src/`,
  `npm run lint` чисто, `npm test` зелёный.
- AC10. На проде после деплоя: crontab содержит строку для
  `/api/cron/deviation-escalations` (*/5), ручной вызов возвращает 200,
  `/settings/compliance` рендерит новую карточку.

## Ограничения

- Не трогать TasksFlow-интеграцию (П-1…П-19 не затрагиваются).
- Никаких `window.confirm`; UI — токены design-system.
- Mini App и сайт — одинаковое поведение (П-3): хук на обоих entry-роутах.
- Climate-журнал (влажность/температура помещений) — вне scope, отмечено.
