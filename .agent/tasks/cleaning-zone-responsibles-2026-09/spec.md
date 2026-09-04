# Журнал уборки: ответственные по зонам

Заморожено 2026-09-04. Полный дизайн: `C:\Users\Two\.claude\plans\declarative-waddling-abelson.md`.

## Scope

Фаза 0 — одна запись `JournalDocumentEntry` на (уборщик, дата) хранит все зоны дня (`data.rooms`).
Фаза 1 — `config.cleanerByRoomId` (roomId → uid[]), единый резолвер, UI в диалоге «Настроить»,
подпись под комнатой в сетке, PDF, оживление дайджеста, fan-out guard, What's New.
Фаза 2 (контролёр по зонам) — вне этого spec.

## Acceptance criteria

- AC1. Два завершения одного уборщика в один день по разным зонам → обе зоны видны через
  `listCleaningRoomCompletions`; легаси-поле `roomId` = последняя зона. Тест.
- AC2. `resolveRoomCleaners`: закрепление заменяет результат для своей зоны; остальные — пул
  (race: все; поровну: индекс в `selectedRoomIds`). Чужие id / комнаты вне выбора отбрасываются
  нормализацией. Тест.
- AC3. Адаптер `buildRoomsModeRows` и `cleaning-cell-override-sync` используют резолвер (нет
  собственной RR-логики).
- AC4. В диалоге «Настроить» есть блок «Закрепить зоны», итог нагрузки; в сетке под комнатой
  подпись «Уборка: Имя (Сn)».
- AC5. PDF печатает код уборщика у комнаты и берёт список кодов из того же резолвера.
- AC6. Дайджест контролёра работает без `controlUserId` (fallback на `controlResponsibles[0]`).
- AC7. Fan-out синтетики не создаётся для cleaning rooms-mode с непустым пулом. Тест.
- AC8. `npm test`, `tsc --noEmit`, `npm run lint` зелёные; `whats-new-notes.ts` обновлён.

## Constraints

Без миграций Prisma. Без правок TF. rowKey не меняются. Все `.tsx` — по design-system.
