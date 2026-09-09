import { randomInt } from "node:crypto";

/**
 * Публичный бейдж организации — чистые функции: код, цвет, SVG, embed-код.
 * Бейдж обезличен: только факт ведения журналов в WeSetup и процент
 * заполнения за последние 30 дней; ни сотрудников, ни записей.
 */
export const BADGE_DAYS = 30;
export const BADGE_CODE_RE = /^[a-z0-9]{10}$/;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // без l/o/0/1 — легче переписать руками

export function generateBadgeCode(): string {
  let out = "";
  for (let i = 0; i < 10; i += 1) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}

export type BadgeTone = { kind: "ok" | "warn" | "bad" | "none"; color: string; soft: string; label: string };

export function badgeTone(percent: number | null): BadgeTone {
  if (percent === null) return { kind: "none", color: "#6f7282", soft: "#f4f4f7", label: "нет данных" };
  if (percent >= 90) return { kind: "ok", color: "#2e9e5b", soft: "#ecfdf5", label: "журналы в порядке" };
  if (percent >= 60) return { kind: "warn", color: "#d98a00", soft: "#fff8eb", label: "есть пропуски" };
  return { kind: "bad", color: "#d2453d", soft: "#fff4f2", label: "много пропусков" };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Плоский бейдж в стиле shields: слева «ХАССП · WeSetup», справа процент. */
export function renderBadgeSvg(input: { percent: number | null; days?: number }): string {
  const days = input.days ?? BADGE_DAYS;
  const tone = badgeTone(input.percent);
  const left = "ХАССП · WeSetup";
  const right = input.percent === null ? "нет данных" : `${input.percent}% за ${days} дней`;
  const charW = 6.6;
  const leftW = Math.round(left.length * charW + 20);
  const rightW = Math.round(right.length * charW + 20);
  const width = leftW + rightW;
  const height = 22;
  const label = `Электронные журналы ХАССП ведутся в WeSetup: ${right}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${escapeXml(label)}">`,
    `<title>${escapeXml(label)}</title>`,
    `<clipPath id="r"><rect width="${width}" height="${height}" rx="4" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${leftW}" height="${height}" fill="#0b1024"/>`,
    `<rect x="${leftW}" width="${rightW}" height="${height}" fill="${tone.color}"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${leftW / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(left)}</text>`,
    `<text x="${leftW / 2}" y="14">${escapeXml(left)}</text>`,
    `<text x="${leftW + rightW / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(right)}</text>`,
    `<text x="${leftW + rightW / 2}" y="14">${escapeXml(right)}</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
}

export function badgePublicUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/b/${code}`;
}

export function badgeImageUrl(baseUrl: string, code: string): string {
  return `${badgePublicUrl(baseUrl, code)}/badge.svg`;
}

export function badgeEmbedHtml(baseUrl: string, code: string): string {
  return `<a href="${badgePublicUrl(baseUrl, code)}" target="_blank" rel="noopener"><img src="${badgeImageUrl(baseUrl, code)}" alt="Электронные журналы ХАССП ведутся в WeSetup" height="22"></a>`;
}
