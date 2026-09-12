import path from "node:path";

export const BASE = "https://wesetup.ru";
export const HERE = path.dirname(
  new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
export const STORAGE = path.join(HERE, "storage.json");
export const EMAIL = "Admin@wesetup.ru";

/** Тестовый партнёр: владелец — тот же admin@wesetup.ru, что и ROOT. */
export const E2E_PARTNER_ID = "cmtlwmc5900003o9m45t64yfc";
export const E2E_PARTNER_SLUG = "e2e-partner";
/** Чужой партнёр — для проверок «чужого клиента не трогаем». */
export const OTHER_PARTNER_SLUG = "ooo-bfs";

export type Check = { name: string; ok: boolean; detail?: string };
