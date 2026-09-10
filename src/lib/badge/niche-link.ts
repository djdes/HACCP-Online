/** Сфера организации → нишевый лендинг для ссылки с публичной страницы бейджа. */
const SPHERE_TO_NICHE: Record<string, string> = {
  restaurant: "dlya-kafe",
  cafe: "dlya-kafe",
  bar: "dlya-bara",
  canteen: "dlya-stolovoy",
  fastfood: "dlya-fastfuda",
  bakery: "dlya-pekarni",
  catering: "dlya-keyteringa",
  hotel: "dlya-otelya",
  retail: "dlya-magazina",
  gas_station: "dlya-azs",
  education: "dlya-detskogo-sada",
  medical: "dlya-medcentra",
  production: "dlya-proizvodstva",
};

export function nicheLandingForSphere(sphere: string | null | undefined): string {
  return sphere && SPHERE_TO_NICHE[sphere] ? `/${SPHERE_TO_NICHE[sphere]}` : "/journals-info";
}
