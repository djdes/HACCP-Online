import { db } from "@/lib/db";

/**
 * Статус сервиса и объявления — данные, которыми управляет ROOT:
 * баннер «плановые работы / инцидент / новость» с окном показа и
 * история инцидентов для страницы /status. Хранятся в PlatformSetting
 * одним JSON; чистые функции — отдельно, чтобы тестировались без базы.
 */
export type AnnouncementKind = "info" | "maintenance" | "incident";

export type Announcement = {
  id: string;
  kind: AnnouncementKind;
  text: string;
  /** Куда ведёт «Подробнее»; пусто — на /status. */
  link: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  updatedAt: string;
};

export type Incident = {
  id: string;
  kind: "incident" | "maintenance";
  title: string;
  note: string | null;
  startedAt: string;
  resolvedAt: string | null;
};

export type PlatformStatusSettings = {
  announcement: Announcement | null;
  incidents: Incident[];
};

export type ServiceState = "operational" | "degraded" | "maintenance";

const SETTING_KEY = "platform.status";
export const INCIDENT_HISTORY_LIMIT = 30;

export const EMPTY_STATUS: PlatformStatusSettings = { announcement: null, incidents: [] };

/** Баннер показывается, если включён и попадает в окно (границы необязательны). */
export function isAnnouncementActive(a: Announcement | null, now: Date): boolean {
  if (!a || !a.active || !a.text.trim()) return false;
  if (a.startsAt && now < new Date(a.startsAt)) return false;
  if (a.endsAt && now > new Date(a.endsAt)) return false;
  return true;
}

/** Открытый инцидент — «есть проблемы»; открытые работы — «плановые работы»; иначе всё работает. */
export function serviceState(incidents: Incident[], dbOk = true): ServiceState {
  if (!dbOk) return "degraded";
  const open = incidents.filter((i) => !i.resolvedAt);
  if (open.some((i) => i.kind === "incident")) return "degraded";
  if (open.some((i) => i.kind === "maintenance")) return "maintenance";
  return "operational";
}

export const SERVICE_STATE_LABEL: Record<ServiceState, string> = {
  operational: "Все системы работают",
  degraded: "Есть проблемы",
  maintenance: "Идут плановые работы",
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export function normalizeStatus(raw: unknown): PlatformStatusSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const a = r.announcement && typeof r.announcement === "object" ? (r.announcement as Record<string, unknown>) : null;
  const announcement: Announcement | null = a
    ? {
        id: str(a.id) || "announcement",
        kind: a.kind === "maintenance" || a.kind === "incident" ? a.kind : "info",
        text: str(a.text),
        link: strOrNull(a.link),
        startsAt: strOrNull(a.startsAt),
        endsAt: strOrNull(a.endsAt),
        active: a.active === true,
        updatedAt: str(a.updatedAt) || new Date(0).toISOString(),
      }
    : null;
  const incidents: Incident[] = Array.isArray(r.incidents)
    ? r.incidents
        .map((item): Incident | null => {
          const i = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
          if (!i || !str(i.id) || !str(i.title) || !str(i.startedAt)) return null;
          return {
            id: str(i.id),
            kind: i.kind === "maintenance" ? "maintenance" : "incident",
            title: str(i.title),
            note: strOrNull(i.note),
            startedAt: str(i.startedAt),
            resolvedAt: strOrNull(i.resolvedAt),
          };
        })
        .filter((i): i is Incident => i !== null)
        .slice(0, INCIDENT_HISTORY_LIMIT)
    : [];
  return { announcement, incidents };
}

export async function readPlatformStatus(): Promise<PlatformStatusSettings> {
  const row = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return EMPTY_STATUS;
  try {
    return normalizeStatus(JSON.parse(row.value));
  } catch {
    return EMPTY_STATUS;
  }
}

export async function writePlatformStatus(next: PlatformStatusSettings): Promise<PlatformStatusSettings> {
  const value = normalizeStatus(next);
  await db.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return value;
}

/** Баннер для layout'ов: null, если сейчас показывать нечего. */
export async function currentAnnouncement(now = new Date()): Promise<Announcement | null> {
  const { announcement } = await readPlatformStatus().catch(() => EMPTY_STATUS);
  return isAnnouncementActive(announcement, now) ? announcement : null;
}
