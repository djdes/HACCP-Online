import { db } from "@/lib/db";

/**
 * Видел ли человек разовое уведомление.
 *
 * Отметки лежат в `User.seenNoticesJson` — в аккаунте, а не в браузере:
 * «показать один раз» относится к человеку, и переход с ноутбука на
 * телефон не должен показывать то же самое заново.
 */
export async function hasSeenNotice(
  userId: string,
  key: string,
): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { seenNoticesJson: true },
    });
    const seen = user?.seenNoticesJson;
    if (!seen || typeof seen !== "object" || Array.isArray(seen)) return false;
    return (seen as Record<string, unknown>)[key] === true;
  } catch {
    // Не смогли прочитать — считаем, что не видел: лишний показ лучше
    // молчания про изменившееся поведение журнала.
    return false;
  }
}
