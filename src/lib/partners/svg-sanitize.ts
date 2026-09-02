/**
 * Sanitize SVG-логотипа партнёра. Белого списка тегов нет — вместо него
 * жёсткий чёрный список всего, что исполняет код или ходит наружу.
 * Файл отдаётся браузеру только как `<img src>` (скрипты там и так не
 * выполняются) — sanitize здесь второй рубеж, а не единственный.
 */

export type SvgSanitizeResult =
  | { ok: true; svg: string }
  | { ok: false; error: string };

const FORBIDDEN_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "embed",
  "object",
  "audio",
  "video",
  "animate",
  "set",
  "handler",
  "listener",
];

const MAX_SVG_CHARS = 500 * 1024;

export function sanitizeSvg(input: string): SvgSanitizeResult {
  if (input.length > MAX_SVG_CHARS) {
    return { ok: false, error: "SVG больше 500 КБ" };
  }
  let svg = input.replace(/^﻿/, "");

  // Комментарии и инструкции обработки (в т.ч. xml-stylesheet) — вон.
  svg = svg.replace(/<!--[\s\S]*?-->/g, "");
  svg = svg.replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, "");
  svg = svg.replace(/<\?xml[\s\S]*?\?>/gi, "");
  svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, "");

  if (/<!ENTITY/i.test(svg) || /<!\[CDATA\[/i.test(svg)) {
    return { ok: false, error: "SVG содержит сущности или CDATA — такие файлы не принимаются" };
  }
  if (!/^\s*<svg[\s>]/i.test(svg)) {
    return { ok: false, error: "Файл не начинается с <svg>" };
  }
  for (const tag of FORBIDDEN_TAGS) {
    if (new RegExp(`<\\s*${tag}[\\s>/]`, "i").test(svg)) {
      return { ok: false, error: `SVG содержит запрещённый элемент <${tag}>` };
    }
  }
  // Обработчики событий: on* = …
  if (/\son[a-z]+\s*=/i.test(svg)) {
    return { ok: false, error: "SVG содержит обработчики событий" };
  }
  // javascript:/vbscript:/data:text — в любом атрибуте.
  if (/(javascript|vbscript|data:\s*text)\s*:/i.test(svg.replace(/\s+/g, " "))) {
    return { ok: false, error: "SVG содержит исполняемые ссылки" };
  }
  // Внешние ссылки: href / xlink:href / src / url(...) на http(s) или //.
  if (/(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i.test(svg)) {
    return { ok: false, error: "SVG ссылается на внешние ресурсы" };
  }
  if (/url\(\s*["']?\s*(?:https?:)?\/\//i.test(svg)) {
    return { ok: false, error: "SVG ссылается на внешние ресурсы (url)" };
  }
  if (/@import/i.test(svg)) {
    return { ok: false, error: "SVG содержит @import" };
  }
  // <style> оставляем: градиенты и классы — обычное дело в экспорте из
  // Figma. Внешние url() внутри уже отсечены выше.
  return { ok: true, svg: svg.trim() };
}
