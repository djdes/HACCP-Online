/**
 * Заголовки, которые middleware выставляет на входящий запрос, чтобы
 * серверный код (getServerSession, аудит) знал метод/путь запроса и
 * партнёрский режим без доступа к объекту Request.
 *
 * Все три всегда перезаписываются middleware — клиент подделать не может.
 */
export const PARTNER_HEADER_METHOD = "x-wesetup-method";
export const PARTNER_HEADER_PATH = "x-wesetup-path";
/** `<partnerId>` — выставляется только когда JWT-claim партнёра активен. */
export const PARTNER_HEADER_PARTNER_ID = "x-wesetup-partner";

export const PARTNER_REQUEST_HEADERS = [
  PARTNER_HEADER_METHOD,
  PARTNER_HEADER_PATH,
  PARTNER_HEADER_PARTNER_ID,
] as const;
