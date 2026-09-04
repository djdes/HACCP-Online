import { db } from "@/lib/db";
import { getCurrentRewardRule } from "./schema-extras";

/**
 * Ставки партнёрской программы для подсказки у логотипа. Только plain-числа:
 * проп уезжает в client-компонент, а `Prisma.Decimal` через границу RSC не
 * сериализуется.
 */
export type PartnerHintRates = {
  subscriptionPercent: number;
  subscriptionMonths: number;
  hardwarePercent: number;
  bonusAmountRub: number;
  bonusAfterPayments: number;
};

export type PartnerHintInput = {
  /** У организации есть партнёр (`PartnerClient.detachedAt = null`). */
  hasActivePartnerClient: boolean;
  /** Пользователь сам состоит в партнёре — у него уже есть кабинет. */
  isPartnerMember: boolean;
  /** В шапке чужой логотип (white-label) — звать под свой бренд странно. */
  hasWhiteLabelLogo: boolean;
  /** Служебная организация платформы (ROOT без impersonation). */
  isPlatformOrg: boolean;
};

/**
 * Показывать ли иконку «партнёрская программа» рядом с логотипом.
 * Чистая функция — правило одно для сайта и Mini App (П-3).
 */
export function decidePartnerHint(input: PartnerHintInput): boolean {
  if (input.hasActivePartnerClient) return false;
  if (input.isPartnerMember) return false;
  if (input.hasWhiteLabelLogo) return false;
  if (input.isPlatformOrg) return false;
  return true;
}

export function platformOrgId(): string {
  return (process.env.PLATFORM_ORG_ID ?? "platform").trim();
}

/**
 * Ставки для подсказки или `null`, если иконку показывать не нужно.
 * Два `count` — дешевле, чем тянуть связи целиком; ошибки БД глушим:
 * подсказка не стоит сломанной шапки.
 */
export async function getPartnerHintRates(args: {
  organizationId: string;
  userId: string;
  hasWhiteLabelLogo: boolean;
}): Promise<PartnerHintRates | null> {
  try {
    const isPlatformOrg = args.organizationId === platformOrgId();
    if (isPlatformOrg || args.hasWhiteLabelLogo) return null;

    const [partnerClients, partnerUsers] = await Promise.all([
      db.partnerClient.count({
        where: { organizationId: args.organizationId, detachedAt: null },
      }),
      db.partnerUser.count({ where: { userId: args.userId } }),
    ]);

    const show = decidePartnerHint({
      hasActivePartnerClient: partnerClients > 0,
      isPartnerMember: partnerUsers > 0,
      hasWhiteLabelLogo: args.hasWhiteLabelLogo,
      isPlatformOrg,
    });
    if (!show) return null;

    const rule = await getCurrentRewardRule();
    return {
      subscriptionPercent: Number(rule.subscriptionPercent),
      subscriptionMonths: Number(rule.subscriptionMonths),
      hardwarePercent: Number(rule.hardwarePercent),
      bonusAmountRub: Number(rule.bonusAmountRub),
      bonusAfterPayments: Number(rule.bonusAfterPayments),
    };
  } catch {
    return null;
  }
}
