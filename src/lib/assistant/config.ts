import { db } from "@/lib/db";

/**
 * Конфигурация ассистента.
 *
 * Сам сайт к языковой модели НЕ ходит. Он кладёт задание в очередь
 * ProjectsFlow, а отвечает внешний исполнитель — сессия Claude Code. Это
 * не экономия на API-ключе: ключа у нас просто нет, и держать его на
 * проде значит завести ещё один секрет, который может утечь.
 *
 * Настройки читаются сначала из БД (их меняет управляющий платформы в
 * интерфейсе), потом из окружения. Токен и проект меняются чаще, чем
 * выходит релиз.
 */

export const ASSISTANT_SETTING_KEYS = {
  token: "assistant_pf_token",
  projectId: "assistant_pf_project_id",
  apiUrl: "assistant_pf_api_url",
  baseUrl: "assistant_public_base_url",
  enabled: "assistant_enabled",
} as const;

export type AssistantConfig = {
  pfApiUrl: string;
  pfToken: string;
  pfProjectId: string;
  publicBaseUrl: string;
};

const DEFAULT_API_URL = "https://projectsflow.ru/api";
const DEFAULT_BASE_URL = "https://wesetup.ru";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export async function readAssistantSettings(): Promise<
  Record<string, string | null>
> {
  const rows = await db.platformSetting.findMany({
    where: { key: { in: Object.values(ASSISTANT_SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    token: clean(map.get(ASSISTANT_SETTING_KEYS.token)),
    projectId: clean(map.get(ASSISTANT_SETTING_KEYS.projectId)),
    apiUrl: clean(map.get(ASSISTANT_SETTING_KEYS.apiUrl)),
    baseUrl: clean(map.get(ASSISTANT_SETTING_KEYS.baseUrl)),
    enabled: clean(map.get(ASSISTANT_SETTING_KEYS.enabled)),
  };
}

/**
 * Собранная конфигурация или null, если интеграция не настроена.
 *
 * null — это не ошибка, а «ассистент выключен»: без токена и проекта
 * задание некуда положить, и лучше честно сказать это пользователю, чем
 * копить висящие ходы.
 */
export async function resolveAssistantConfig(): Promise<AssistantConfig | null> {
  const stored = await readAssistantSettings().catch(() => null);

  // Выключатель отдельно от настроек: управляющий может погасить
  // ассистента, не стирая токен.
  if (stored?.enabled === "off") return null;

  const pfToken =
    stored?.token ?? clean(process.env.PROJECTSFLOW_AGENT_TOKEN) ?? null;
  const pfProjectId =
    stored?.projectId ??
    clean(process.env.PROJECTSFLOW_WESETUP_PROJECT_ID) ??
    null;
  if (!pfToken || !pfProjectId) return null;

  const pfApiUrl =
    stored?.apiUrl ?? clean(process.env.PROJECTSFLOW_API_URL) ?? DEFAULT_API_URL;
  const publicBaseUrl =
    stored?.baseUrl ??
    clean(process.env.NEXTAUTH_URL) ??
    DEFAULT_BASE_URL;

  return {
    pfApiUrl: stripTrailingSlash(pfApiUrl),
    pfToken,
    pfProjectId,
    publicBaseUrl: stripTrailingSlash(publicBaseUrl),
  };
}
