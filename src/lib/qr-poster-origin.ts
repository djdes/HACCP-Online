/**
 * Домен ссылок в QR-плакатах.
 *
 * `?origin=` нужен только для проверки на стенде (плакаты со ссылками на
 * localhost). На проде принимается лишь свой домен: иначе присланная кому-то
 * ссылка «распечатайте плакаты» с чужим доменом выдала бы подписанные токены
 * постороннему сайту.
 */
export function resolveQrPosterOrigin(params: {
  requested?: string | null;
  configured?: string | null;
  production: boolean;
}): string {
  const configured = (params.configured || "https://wesetup.ru").trim().replace(/\/+$/, "");
  const requested = (params.requested ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/?#]+$/.test(requested)) return configured;
  if (params.production && requested !== configured) return configured;
  return requested;
}
