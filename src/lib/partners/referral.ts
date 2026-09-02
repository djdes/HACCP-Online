/**
 * Партнёрская метка регистрации.
 *
 * Страница `/p/<slug>` ставит cookie: человек, пришедший по ссылке
 * партнёра, регистрируется или оплачивает обычным путём, а новая
 * организация автоматически привязывается к партнёру. Метка — не ключ
 * доступа: партнёр получит только то, что даёт уровень «просмотр»
 * (или «редактирование», если клиент выбрал его на странице партнёра),
 * и клиент в любой момент отключит сопровождение в настройках.
 */

import { isPartnerAccessLevel, type PartnerAccessLevel } from "./access-guard";
import { attachOrganizationToPartner, findPartnerForAttach } from "./service";
import { validateSlug } from "./validation";

export const PARTNER_REF_COOKIE = "wesetup.partner-ref";
export const PARTNER_REF_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export type PartnerRef = { slug: string; level: PartnerAccessLevel };

export function encodePartnerRef(ref: PartnerRef): string {
  return `${ref.slug}|${ref.level}`;
}

/** Разбор значения cookie. Мусор → null, без исключений. */
export function parsePartnerRef(raw: string | null | undefined): PartnerRef | null {
  if (!raw) return null;
  const [slugPart, levelPart] = decodeURIComponent(raw).split("|");
  const slug = validateSlug(slugPart ?? "");
  if (!slug.ok) return null;
  const level: PartnerAccessLevel = isPartnerAccessLevel(levelPart) ? levelPart : "view";
  return { slug: slug.slug, level };
}

/** Метка из заголовка Cookie запроса (для API-роутов регистрации и оплаты). */
export function readPartnerRefFromRequest(request: Request): PartnerRef | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PARTNER_REF_COOKIE) return parsePartnerRef(rest.join("="));
  }
  return null;
}

/**
 * Привязка новой организации по метке. Best-effort: любая ошибка
 * (партнёр приостановлен, своя организация, гонка) логируется и не
 * ломает регистрацию — человек уже получил аккаунт.
 */
export async function attachOrganizationByRef(input: {
  ref: PartnerRef | null;
  organizationId: string;
  actorUserId: string | null;
}): Promise<boolean> {
  if (!input.ref) return false;
  try {
    const partner = await findPartnerForAttach({ slug: input.ref.slug });
    if (!partner || partner.status !== "active") return false;
    const result = await attachOrganizationToPartner({
      partnerId: partner.id,
      organizationId: input.organizationId,
      accessLevel: input.ref.level,
      source: "link",
      actorUserId: input.actorUserId,
    });
    return result.created;
  } catch (error) {
    console.error(`partner ref attach failed (slug=${input.ref.slug})`, error);
    return false;
  }
}
