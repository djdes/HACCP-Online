/**
 * Принимает ли домен почту.
 *
 * Спрашиваем не системный резолвер, а DNS-over-HTTPS. Причина
 * практическая: резолвер прод-сервера на несуществующие домены отвечает
 * `ETIMEOUT` вместо NXDOMAIN, и отличить «домена нет» от «резолвер
 * молчит» по коду ошибки невозможно — мусорные адреса проходили
 * регистрацию. DoH возвращает явный статус ответа.
 *
 * Принцип — fail-open: блокируем только при однозначном ответе «такого
 * домена нет». Недоступен DoH, таймаут, кривой JSON — пропускаем.
 * Ошибка нашей инфраструктуры не должна закрывать людям регистрацию;
 * цена ошибки в другую сторону мала, опечатки популярных доменов всё
 * равно ловятся в форме.
 */

const DOH_URL = "https://dns.google/resolve";
const DOH_TIMEOUT_MS = 4000;

/** RCODE 3 (NXDOMAIN) — домена не существует. */
const NXDOMAIN = 3;
/** RCODE 0 (NOERROR) — домен есть, записи запрошенного типа могут отсутствовать. */
const NOERROR = 0;

type DohAnswer = { Status?: number; Answer?: Array<{ data?: string }> };

async function resolveDoh(
  name: string,
  type: "MX" | "A",
): Promise<DohAnswer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`,
      { signal: controller.signal, headers: { accept: "application/dns-json" } },
    );
    if (!res.ok) return null;
    return (await res.json()) as DohAnswer;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function domainAcceptsMail(domain: string): Promise<boolean> {
  if (!domain) return false;

  const mx = await resolveDoh(domain, "MX");
  // DoH недоступен — не мешаем регистрации.
  if (!mx) return true;
  if (mx.Status === NXDOMAIN) return false;
  if (mx.Status === NOERROR && (mx.Answer?.length ?? 0) > 0) return true;

  // MX нет, но домен существует: часть доменов принимает почту прямо на
  // A-запись (RFC 5321).
  const a = await resolveDoh(domain, "A");
  if (!a) return true;
  if (a.Status === NXDOMAIN) return false;
  if (a.Status === NOERROR && (a.Answer?.length ?? 0) > 0) return true;

  // Домен зарегистрирован, но ни MX, ни A — письмо доставить некуда.
  return false;
}
