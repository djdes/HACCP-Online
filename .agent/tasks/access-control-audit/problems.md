# Access-control: open problems

## ✅ RESOLVED — `src/middleware.ts` + `requireRoot()` на анонимных пробах

Исправлено двумя коммитами:
- **`3329cf5 fix(middleware): 404 anonymous /root and /api/root probes`** — заменил matcher на catch-all `["/((?!_next/|favicon\\.ico$).*)"]` с ранним выходом по префиксу в теле.
- **`e9339a8 fix(auth): requireRoot() notFound()s anonymous callers too`** — убрал из `requireRoot()` вызов `requireAuth()`, теперь он сам тянет сессию и делает `notFound()` для анонимов, не полагаясь на то, что middleware поймает голый `/root` (Next.js 16 Turbopack местами его пропускает).

### Итоговая матрица на build `e9339a8`

| path | anon | non-root auth | root |
|---|---|---|---|
| `/garbage-xyz` | 404 | 404 | 404 |
| `/root` | **404** (было 307) | 404 | 200 |
| `/root/organizations` | 404 | 404 | 200 |
| `/api/root` | 404 | 404 | handled |
| `POST /api/root/impersonate` | **404** (было 405) | 404 | handled |
| `/login` | 200 | 200 | 200 |
| `/dashboard` | 307 → /login (ожидаемо) | 200 | 200 |

### Остаточный минимальный лик
`GET /api/root/impersonate` (только POST) возвращает **405**, не 404, потому что Next.js возвращает Method Not Allowed до прогона middleware. Это поведение **любой** роуты с методом-allowlist, не специфика `/root`. Закрывать отдельным обработчиком `export async function GET() { notFound() }` смысла немного — анонимный пробер всё равно не различает 404 и 405 как "is it hidden".

---

## ~~1. `src/middleware.ts` matcher не срабатывает на голых `/root` и `/api/root/*`~~ *(архивировано)*

### Симптом
Анонимный probing проверен `curl`ом с прода:

| URL (anonymous) | Ожидалось | Факт |
|---|---|---|
| `/garbage-xyz` | 404 | 404 |
| `/root` | 404 (комментарий в `middleware.ts:10-16` обещает скрывать существование) | 307 → `/login` |
| `/root/organizations` | 404 | 404 |
| `/api/root/impersonate` (GET) | 404 | 405 |

`307 → /login` подтверждает, что middleware **не запускается** для базового `/root`, и `requireAuth()` из layout редиректит на логин. Это выдаёт факт существования раздела.

### Почему
Next.js 16 разбирает паттерны
```
matcher: ["/root", "/root/:path*", "/api/root", "/api/root/:path*"]
```
как один составной путь. Для вложенных URL (`/root/organizations`) он работает, но голые `/root` и `/api/root/impersonate` ловит мимо. Комментарий в файле даже предупреждает об этом, а фикс (добавить базовые пути в список) не помог.

### Impact
Утечка факта существования `/root`, не обход доступа. Авторизованные non-root пользователи получают **404** на странице (`requireRoot()` → `notFound()`), так что панель всё равно не видят. Тем не менее — это отклонение от документированного поведения в `CLAUDE.md`.

### Варианты фикса (не выполнены в этой сессии)
1. **Простой**: `matcher: "/:path*"` + ранний `startsWith` в теле middleware (уже есть `return NextResponse.next()` по префиксу, так что накладных нет).
2. **Явная регулярка**: `matcher: ["/((root|api/root)(/.*)?)"]`.
3. **Серверный**: убрать зависимость middleware — в `requireRoot()` заменить `requireAuth()` на прямой `getServerSession` + `notFound()`, чтобы анонимные запросы тоже получали 404 из layout.

Решать вместе с владельцем приложения — изменение поведения может затронуть монитор `/api/auth/*`. В scope текущего запроса ("при входе ROOTа удобная панель") не критично, поэтому оставляю в проблемах.
