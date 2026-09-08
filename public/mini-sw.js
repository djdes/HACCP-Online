/**
 * Service worker рабочего кабинета (/mini).
 *
 * Написан руками, а не через Workbox: Workbox хочет владеть сборкой, а
 * здесь `next build --webpack` со своим distDir. Полторы сотни строк
 * читаются целиком и не приносят в проект генератор.
 *
 * ГЛАВНОЕ ПРАВИЛО, и оно про безопасность, а не про скорость:
 * авторизованный HTML не кешируется НИКОГДА. На кухне одна трубка на
 * три смены. Если отдать повару второй смены страницу, отрисованную для
 * повара первой, журнал подпишется чужим именем — а журнал это
 * доказательство на проверке.
 *
 * Поэтому кешируется ровно одно: статика с хешем в имени, которая по
 * определению не зависит от того, кто вошёл. Навигации, RSC-запросы,
 * `/api/*` и всё, что не GET, идут мимо воркера.
 *
 * Обновление НЕ применяется само: новый воркер ждёт, страница показывает
 * «Доступно обновление». Внезапная перезагрузка посреди заполнения
 * журнала стоила бы человеку набранных данных.
 */

const CACHE = "wesetup-mini-static-v1";

/** Наши ли это кеши — чтобы чистить только своё. */
function isOurCache(name) {
  return name.startsWith("wesetup-mini-");
}

self.addEventListener("install", (event) => {
  // Без skipWaiting: новый воркер ждёт, пока страница сама попросит.
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => isOurCache(k) && k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Единственная команда: «применяй обновление». Её шлёт тост со
  // страницы после явного нажатия человеком.
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/**
 * Кешируем только то, чьё имя содержит хеш содержимого, — такой файл
 * не может «протухнуть», а значит cache-first безопасен.
 *
 * `/icons/` и `/brand/` хеша не имеют, но это логотипы: меняются раз в
 * годы, и показать вчерашний не страшно. Им дан свой заголовок
 * кеширования в next.config.ts, воркер их только подстраховывает.
 */
function isCacheableStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  );
}

const OFFLINE_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Нет связи — WeSetup</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100dvh; display:flex; align-items:center;
         justify-content:center; background:#0a0b0f; color:#f2f3f7;
         font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         padding:24px }
  .card { max-width:380px; text-align:center }
  h1 { font-size:22px; font-weight:600; margin:0 0 10px; letter-spacing:-.01em }
  p { margin:0 0 20px; opacity:.7; font-size:15px }
  button { height:52px; width:100%; border:0; border-radius:16px;
           background:#5566f6; color:#fff; font-size:16px; font-weight:500 }
</style></head>
<body><div class="card">
  <h1>Нет связи</h1>
  <p>Кабинет не открывается без интернета. Проверьте подключение и попробуйте ещё раз — набранное в открытых вкладках не потеряется.</p>
  <button onclick="location.reload()">Повторить</button>
</div></body></html>`;

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Не-GET не трогаем вообще: отправка записи в журнал должна дойти до
  // сервера или честно упасть. Молча проглоченный POST — это потерянная
  // запись, которую человек считает сохранённой.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (isCacheableStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        // Кладём только удачные ответы: закешированная 404 держалась бы
        // до следующей версии воркера.
        if (response.ok && response.status === 200) {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      })(),
    );
    return;
  }

  // Навигации — всегда из сети. Кеш здесь означал бы чужую смену на
  // экране. Оффлайн отдаём заглушку, чтобы вместо неё не появился
  // системный «динозавр» — из установленного приложения он выглядит как
  // «приложение сломалось».
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OFFLINE_HTML, {
            status: 503,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          }),
      ),
    );
    return;
  }

  // Всё остальное — RSC-запросы, `/api/*`, картинки вложений — воркер
  // не перехватывает: пусть работает как без него.
});
