/**
 * Безопасная сериализация JSON-LD для inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` не экранирует символы `<`, `>` и `&`, поэтому если в
 * данных встретится `</script>`, payload «выйдет» из тега и атакующий
 * получит произвольный JS на странице. Аналогичная проблема — `<!--`
 * (HTML-комментарий).
 *
 * Используется на любой странице, где в JSON-LD попадают значения из
 * пользовательского ввода или из БД (например, `article.title` из
 * `/root/blog`). Для constant-конфигов риск минимальный, но применяем
 * helper всегда — это дешевле, чем в каждом месте отдельно решать.
 *
 * U+2028/U+2029 (line/paragraph separator) при необходимости сериализуются
 * самим `JSON.stringify` через ` `/` ` для строк → отдельная
 * замена не нужна.
 */
export function jsonLdSafeString(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
