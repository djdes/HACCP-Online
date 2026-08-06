/**
 * Константы Робокассы, безопасные для клиента.
 *
 * Вынесены отдельно от `lib/robokassa.ts`: тот модуль тянет node:crypto
 * и читает пароли из env, поэтому импортировать его в браузерный бандл
 * нельзя. Здесь — только публичный адрес скрипта iFrame-оплаты.
 */
export const ROBOKASSA_IFRAME_SCRIPT_URL =
  "https://auth.robokassa.ru/Merchant/bundle/robokassa_iframe.js";
