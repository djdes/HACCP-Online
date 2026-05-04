# Loop entry-point prompt

**Назначение:** этот файл — короткий промпт для запуска `/loop 10m` сессии. Скопируй содержимое блока ниже и вставь в `/loop 10m <prompt>`.

---

## Промпт для `/loop 10m`

```
Прочитай docs/PIPELINE-VISION.md и docs/LOOP-NEXT.md полностью. Дальше:

1. Найди следующий приоритетный пункт по правилу: P0 → P1 → P2.
2. Если это UI-задача — сначала зайди на https://lk.haccp-online.ru/docs/login (test4/test8), посмотри как у них реализовано через WebFetch или playwright, скопируй паттерн с адаптацией под наш design-system (см. .claude/skills/design-system).
3. Реализуй пункт. Используй superpowers skills:
   - wesetup-design для UI
   - superpowers:test-driven-development для багов
   - superpowers:systematic-debugging для P0
4. Запусти `npx tsc --noEmit --skipLibCheck` — должен быть clean. Запусти ESLint если применимо.
5. Сделай git commit с русским сообщением и git push origin master. Дождись деплоя через polling SSH (cat .build-sha == HEAD).
6. Smoke-test через curl https://wesetup.ru/login → 200.
7. Обнови docs/LOOP-NEXT.md: пункт пометь как DONE с git-sha и timestamp в МСК. Добавь в Lessons learned если что-то нетривиальное всплыло. Если это P0/P1 финал — добавь Owner notification.
8. Если P0 + P1 + P2 все закрыты, или ты сделал 1000 P2-пунктов — выведи финальный отчёт и не ставь следующий ScheduleWakeup.
9. Иначе — продолжай в следующей итерации loop'а.

ВАЖНО:
- НЕ делай git push --force, НЕ делай git reset --hard.
- НЕ запускай npx prisma migrate dev локально — только generate. db push выполнится в deploy.yml на проде.
- НЕ ломай прод. Если build/typecheck падает — откати, разберись, переделай. Если сломал прод — немедленно откати.
- Тестируй на проде, не локально (memory: «Test on prod, not localhost»).
- НЕ вызывай /loop рекурсивно (memory: «No auto-loop / ScheduleWakeup»). ScheduleWakeup можно использовать только в рамках текущего /loop.
- При типе сообщения от меня — стоп, отвечай.
```

---

## Что владельцу делать

1. Открыть Claude Code.
2. Набрать `/loop 10m` и в качестве prompt'а вставить **весь текст из блока выше**.
3. Опус сам прочитает файлы, сделает следующий пункт, обновит трекер, задеплоит, и через 10 мин (или меньше) запустит следующую итерацию.
4. Чтобы остановить — просто ввести любое сообщение в чат. Loop сам прекратится.

---

## Альтернатива: если хочешь dynamic-pacing вместо строгих 10m

Запусти `/loop` без префикса:

```
/loop <тот же промпт что выше>
```

Тогда опус сам выбирает delay (60-3600 сек) исходя из того, дожидается ли он деплоя или уже начинает следующую задачу.

---

## Текущий статус (на момент создания)

- HEAD: `1f9becbe` (фото-доказательство wave B)
- P0 open: 2
- P1 open: 10
- P2 open: 50
- Прод: green @ wesetup.ru
