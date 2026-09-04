# «Как заполнить?» — пошаговый гайд по интерфейсу и спотлайт-тур журналов

Дата: 2026-09-04. Статус: утверждено владельцем (brainstorming-сессия).
Первый охват: `hygiene`, `climate_control`; механика рассчитана на раскатку
на все журналы.

## Проблема

У журнала есть «Инструкция» (`/journals/<code>/guide`, правила заполнения
по СанПиН) и круглая кнопка «Как заполнять» на странице документа (тоже
правила). Нигде не объясняется интерфейс: как создать документ, где клетка,
что делает тумблер «Автоматически заполнять журнал». Новый сотрудник
догадывается — нарушение принципов UX 2 и 3 из CLAUDE.md.

## Решения

- Живой спотлайт на реальном интерфейсе + мини-копии контролов в окне.
  PNG-скриншоты отвергнуты: устаревают при каждой правке UI, для 40
  журналов на двух платформах — сотни файлов.
- Окно открывается само один раз на пользователя и журнал. Флаг — в
  аккаунте (`User.seenNoticesJson`, ключ `fill-guide:<code>`), а не в
  localStorage: переход ноутбук → телефон не показывает окно заново.
- На странице документа вход — существующая круглая кнопка; она открывает
  новое окно с вкладками «Куда нажимать» и «Правила». Один вход на
  страницу, ничего не дублируется.
- v1 тура — не интерактивный: клики заблокированы, пользователь смотрит,
  закрывает и делает сам. Интерактивный режим — отдельная итерация.

## Архитектура

```text
src/lib/tour-anchors.ts                      реестр значений data-tour (as const) + тип TourAnchor
src/lib/journal-ui-walkthroughs.ts           шаги по журналам + фильтры (страница, мобильный)
src/lib/spotlight-geometry.ts                чистая геометрия: вырез, SVG-path, размещение карточки
src/lib/use-seen-notice.ts                   {seen, markSeen} поверх GET/POST /api/me/notices
src/components/ui/spotlight-tour.tsx         оверлей-спотлайт (портал в body, z-70)
src/components/journals/journal-doc-guide-body.tsx  секции «Правил» (вынос из GuideSheet)
src/components/journals/walkthrough-previews.tsx    мини-копии контролов по ключу preview
src/components/journals/fill-guide-dialog.tsx       окно с двумя вкладками
src/components/journals/fill-guide-launcher.tsx     кнопка/FAB + окно + тур + seen + ?tour=
src/components/journals/journal-doc-guide.tsx       FAB: есть walkthrough → launcher, иначе GuideSheet
```

### Контент

`WalkthroughStep { id, page: "list" | "document", anchor?, fallbackAnchor?,
title, body, forManager?, mobileOnly?, preview? }`. Тексты — императив,
1–2 предложения, из реального поведения кода (15-дневный период гигиены,
цикл Зд. → В → Б/л → От → Отп, автозаполнение 06:00, автозаполнение
климата создаёт строку на каждый день). Все шаги видны всем ролям, пилюля
«Руководитель» — подсказка «кто это делает», не гейт.

### Анкоры

Значения `data-tour` только из `TOUR` (`tour-anchors.ts`): опечатка —
ошибка typecheck. Общие анкоры стоят в разделяемых компонентах
(`CreateDocumentDialog` через `triggerDataTour`, карточки документов,
`DocumentActionsBar`, полоса автозаполнения, `MobileViewToggle`), поэтому
для нового журнала остаются 1–3 специфичных. В гигиене клетки помечаются
только у строки текущего пользователя (или первого сотрудника с именем) и
сегодняшней даты (`todayKey` в зоне организации; если «сегодня» вне
периода — первая дата).

### Спотлайт

Портал в `document.body` (в Mini App `.mini-root > *` создаёт stacking
context и ловит `fixed` внутри shell-контейнера). Слои: click-catcher → SVG
с одним `path fill-rule="evenodd"` (внешний прямоугольник + скруглённый
вырез, padding 6, radius 12) → пульсирующее кольцо → карточка шага. Цель —
первый видимый `[data-tour=…]`, затем `fallbackAnchor`, иначе шаг
пропускается; перед стартом анкор ждём до 3 с (mini-список грузится
клиентски). `scrollIntoView({block:"center", inline:"center"})`, пересчёт
на scroll / resize / visualViewport / ResizeObserver. Скролл тела не
блокируем. Карточка: `vw < 640` → bottom-sheet; иначе под целью, если есть
место, иначе над; clamp в viewport. На корне портала — font-family
Manrope (`.app-shell` не передаёт шрифт в портал).

### Окно и входы

Окно — образец `whats-new-modal.tsx` / `confirm-dialog.tsx`: `max-w-[560px]
max-h-[90vh]`, header/footer `shrink-0`, тело скроллится, bottom-sheet на
мобиле, `z-[60]`. Вкладка «Куда нажимать»: карточки шагов с номером,
пилюлей, мини-копией, подписью места и ссылкой «Показать на экране →».
Шаг другой страницы → переход с `?tour=<stepId>` (список → первый
активный документ; документ → список), параметр стирается через
`history.replaceState(window.history.state, …)` без серверного
round-trip. Вкладка «Правила» — `JournalDocGuideBody`.

Входы: `JournalTopBar` и шапка `tracked-documents-client` (сайт, список);
`JournalDocGuideOverlay` (сайт, документ); `DocumentJournalBody` в
`/mini/journals/[code]` вместо устаревшего info-box «заполнение доступно
на сайте»; `/mini/documents/[id]` монтирует оверлей с явным `code` и
`bottomOffset` над нижней навигацией.

## Сопутствующее

- CTA «К заполнению →» на `/journals/<code>/guide` вёл на
  `/journals/<code>/new`, который для document-шаблонов отдаёт 404 — ведём
  на список.
- Наблюдение (вне scope): `.mini-root > * { position: relative; z-index: 1 }`
  в `mini-theme.css` — unlayered и по правилам cascade layers перебивает
  Tailwind `.fixed`; проверить `MiniNav`/`MiniTour` в DevTools.
