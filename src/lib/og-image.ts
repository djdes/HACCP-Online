/**
 * Адреса OG-картинок под страницу — чистые функции для метаданных и JSON-LD.
 * Картинку рисует маршрут `/og` (ImageResponse), здесь только URL и текст.
 */
export type OgKind = "page" | "article" | "journal" | "feature" | "landing" | "changelog" | "glossary" | "compare" | "calc";

export const OG_KIND_LABEL: Record<OgKind, string> = {
  page: "WeSetup",
  article: "Блог",
  journal: "Журнал",
  feature: "Возможности",
  landing: "Электронные журналы",
  changelog: "Что нового",
  glossary: "Глоссарий",
  compare: "Сравнение",
  calc: "Калькулятор",
};

const SITE = "https://wesetup.ru";

export function clampOgText(value: string | null | undefined, max: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function ogImageUrl(input: { title: string; subtitle?: string | null; kind?: OgKind }): string {
  const params = new URLSearchParams();
  params.set("t", clampOgText(input.title, 90));
  const subtitle = clampOgText(input.subtitle, 140);
  if (subtitle) params.set("s", subtitle);
  if (input.kind && input.kind !== "page") params.set("k", input.kind);
  return `${SITE}/og/image?${params.toString()}`;
}

export function ogImages(input: { title: string; subtitle?: string | null; kind?: OgKind }) {
  return [{ url: ogImageUrl(input), width: 1200, height: 630, alt: clampOgText(input.title, 90) }];
}

export function twitterImages(input: { title: string; subtitle?: string | null; kind?: OgKind }) {
  return [ogImageUrl(input)];
}
