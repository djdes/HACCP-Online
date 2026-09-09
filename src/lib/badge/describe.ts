import { badgeEmbedHtml, badgeImageUrl, badgePublicUrl } from "@/lib/badge/render";

export type BadgeDescription = {
  enabled: boolean;
  code: string | null;
  publicUrl: string | null;
  imageUrl: string | null;
  embedHtml: string | null;
  percent: number | null;
};

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://wesetup.ru";
}

/** Состояние бейджа и ссылки для вставки — одно и то же для API и страницы настроек. */
export function describeBadge(org: { badgeEnabled: boolean; badgeCode: string | null }, percent: number | null): BadgeDescription {
  const code = org.badgeEnabled && org.badgeCode ? org.badgeCode : null;
  return {
    enabled: org.badgeEnabled,
    code,
    publicUrl: code ? badgePublicUrl(baseUrl(), code) : null,
    imageUrl: code ? badgeImageUrl(baseUrl(), code) : null,
    embedHtml: code ? badgeEmbedHtml(baseUrl(), code) : null,
    percent,
  };
}
