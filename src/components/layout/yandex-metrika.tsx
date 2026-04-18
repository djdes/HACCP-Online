import Script from "next/script";

/**
 * Yandex.Metrika counter. Mounts in the root layout ONLY when the env
 * variable `NEXT_PUBLIC_YANDEX_METRIKA_ID` is set — an 8-digit counter
 * id from metrika.yandex.ru. Until then, renders nothing, so CI builds
 * and preview deploys don't ship a zero-id tracker.
 *
 * Uses next/script with `strategy="afterInteractive"` so the counter
 * doesn't block first paint. Webvisor is enabled by default because it
 * makes the Yandex dashboard actually useful for debugging sessions.
 */
export function YandexMetrika() {
  const id = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  if (!id || !/^\d{5,12}$/.test(id)) return null;

  const counterId = JSON.stringify(Number(id));

  return (
    <>
      <Script
        id="yandex-metrika"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

            ym(${counterId}, "init", {
                clickmap: true,
                trackLinks: true,
                accurateTrackBounce: true,
                webvisor: true
            });
          `,
        }}
      />
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<div><img src="https://mc.yandex.ru/watch/${Number(id)}" style="position:absolute; left:-9999px;" alt="" /></div>`,
        }}
      />
    </>
  );
}
