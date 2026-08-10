import { promises as dns } from "node:dns";

/**
 * Принимает ли домен почту.
 *
 * Принцип — fail-open: «не существует» возвращаем только когда DNS
 * ответил однозначно (домена нет / нет записей). Любая другая беда —
 * таймаут, отказ резолвера, отсутствие сети — трактуется как «домен в порядке».
 *
 * Так задумано: ошибка нашей инфраструктуры не должна закрывать людям
 * регистрацию. Цена ошибки в другую сторону мала — опечатку всё равно
 * ловит проверка популярных доменов в форме.
 */

/** Ответы резолвера, означающие именно «такого домена нет». */
const DEFINITIVE = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

function isDefinitiveMiss(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return typeof code === "string" && DEFINITIVE.has(code);
}

export async function domainAcceptsMail(domain: string): Promise<boolean> {
  if (!domain) return false;

  try {
    const mx = await dns.resolveMx(domain);
    if (Array.isArray(mx) && mx.length > 0) return true;
  } catch (error) {
    if (!isDefinitiveMiss(error)) return true;
  }

  // Часть доменов принимает почту на A-запись без MX (RFC 5321).
  try {
    const a = await dns.resolve4(domain);
    return Array.isArray(a) && a.length > 0;
  } catch (error) {
    return !isDefinitiveMiss(error);
  }
}
