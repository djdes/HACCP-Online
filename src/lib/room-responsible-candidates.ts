/**
 * Кандидаты в уборщики / проверяющие помещения — группировка для
 * MultiUserPicker («Рекомендуем / Можно / Не рекомендуем»).
 *
 * Чистая логика без React. Ключевые слова должностей — те же, что у
 * слотов журнала уборки в journal-responsible-schemas.ts (supervisor /
 * controller), tier — как в /settings/journal-responsibles.
 */
import type { RoomResponsibleRole } from "@/lib/cleaning-room-responsibles";

export type RoomResponsibleUser = {
  id: string;
  name: string;
  role: string;
  isRoot?: boolean;
  positionTitle?: string | null;
  jobPosition?: { name: string } | null;
};

export type CandidateGroupKey = "recommended" | "ok" | "notRecommended";

export type RoomResponsibleCandidate = {
  user: RoomResponsibleUser;
  positionName: string | null;
  group: CandidateGroupKey;
  /** Короткая причина для подсказки справа. */
  reason: string;
  tier: number;
};

export type RoomResponsibleCandidateGroups = Record<
  CandidateGroupKey,
  RoomResponsibleCandidate[]
>;

const CLEANER_KEYWORDS = ["уборщ", "клинер", "старш"];
const VERIFIER_KEYWORDS = ["менеджер", "управляющ", "технолог"];

/**
 * 3 = admin (isRoot или legacy owner), 2 = manager, 1 = head_chef /
 * technologist, 0 = остальные.
 */
export function roleTier(user: Pick<RoomResponsibleUser, "role" | "isRoot">): number {
  if (user.isRoot) return 3;
  switch (user.role) {
    case "owner":
      return 3;
    case "manager":
      return 2;
    case "head_chef":
    case "technologist":
      return 1;
    default:
      return 0;
  }
}

export function positionNameOf(user: RoomResponsibleUser): string | null {
  const fromPosition = user.jobPosition?.name?.trim();
  if (fromPosition) return fromPosition;
  const fromTitle = user.positionTitle?.trim();
  return fromTitle ? fromTitle : null;
}

function matchesKeywords(user: RoomResponsibleUser, keywords: string[]): boolean {
  const haystack = `${positionNameOf(user) ?? ""} ${user.name}`.toLowerCase();
  return keywords.some((k) => haystack.includes(k));
}

function classify(
  user: RoomResponsibleUser,
  role: RoomResponsibleRole,
): { group: CandidateGroupKey; reason: string } {
  const tier = roleTier(user);
  if (role === "cleaner") {
    if (matchesKeywords(user, CLEANER_KEYWORDS)) {
      return { group: "recommended", reason: "должность подходит" };
    }
    if (tier === 0) return { group: "ok", reason: "сотрудник" };
    return { group: "notRecommended", reason: "руководитель — обычно проверяет" };
  }
  if (tier >= 2) {
    return { group: "recommended", reason: tier === 3 ? "администратор" : "руководитель" };
  }
  if (tier === 1 || matchesKeywords(user, VERIFIER_KEYWORDS)) {
    return { group: "ok", reason: "может принимать результат" };
  }
  return { group: "notRecommended", reason: "обычно убирает, а не проверяет" };
}

/**
 * Группирует сотрудников для роли. Внутри группы — по имени (ru).
 * `roomsPerUser` — сколько помещений уже закреплено (для подсказки).
 */
export function groupRoomResponsibleCandidates(
  users: ReadonlyArray<RoomResponsibleUser>,
  role: RoomResponsibleRole,
  roomsPerUser?: Map<string, number>,
): RoomResponsibleCandidateGroups {
  const groups: RoomResponsibleCandidateGroups = {
    recommended: [],
    ok: [],
    notRecommended: [],
  };
  for (const user of users) {
    const { group, reason } = classify(user, role);
    const n = roomsPerUser?.get(user.id) ?? 0;
    const loadHint =
      n > 0
        ? `${role === "cleaner" ? "убирает" : "проверяет"} ${n} ${pluralRooms(n)}`
        : null;
    groups[group].push({
      user,
      positionName: positionNameOf(user),
      group,
      reason: loadHint ? `${reason} · ${loadHint}` : reason,
      tier: roleTier(user),
    });
  }
  const byName = (a: RoomResponsibleCandidate, b: RoomResponsibleCandidate) =>
    a.user.name.localeCompare(b.user.name, "ru");
  groups.recommended.sort(byName);
  groups.ok.sort(byName);
  groups.notRecommended.sort(byName);
  return groups;
}

export function pluralRooms(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "помещение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "помещения";
  return "помещений";
}
