import { cache } from "react";
import { db } from "@/lib/db";
import { ORG_NAME_FALLBACK } from "@/lib/journal-constants";

/**
 * Название текущей организации — первое звено хлебных крошек.
 *
 * Отдельный помощник, потому что крошки нужны на каждой странице раздела
 * журналов, а название лежит в БД: в сессии оно может отставать (админ
 * переименовал организацию) и не учитывает impersonation ROOT'а, где
 * активная организация не та, что в JWT.
 *
 * `cache` — на один серверный рендер: страница документа и без того
 * читает организацию для шапки бланка, и второй запрос за тем же именем
 * ни к чему.
 */
export const getCrumbOrganizationName = cache(
  async (organizationId: string): Promise<string> => {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    return org?.name || ORG_NAME_FALLBACK;
  },
);
