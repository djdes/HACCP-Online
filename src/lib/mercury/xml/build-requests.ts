/**
 * Тела операций Меркурия внутри заявки.
 *
 * Каждая функция возвращает фрагмент XML, который `envelope.ts`
 * подставляет в `<apl:data>`. Ни одна из них не ходит в сеть — всё
 * покрывается golden-тестами (`build-requests.test.ts`).
 */
import { MERCURY_OPERATIONS, NS } from "../ns";
import type { ProcessIncomingInput } from "../types";
import { escapeXml, optionalTag, toXsdDate } from "./escape";

const NS_ATTRS = `xmlns:merc="${NS.merc}" xmlns:bs="${NS.bs}" xmlns:vd="${NS.vd}" xmlns:dt="${NS.dt}"`;

/**
 * Список ВСД предприятия.
 *
 * `count` ограничен сотней: у Ветис есть предел на страницу, а
 * догружаем мы курсором. `status` фильтрует по состоянию — нас
 * интересуют только `CONFIRMED`, то есть оформленные и ждущие гашения.
 */
export function buildGetVetDocumentList(input: {
  enterpriseGuid: string;
  count?: number;
  offset?: number;
  status?: string;
}): string {
  const count = Math.min(input.count ?? 100, 100);
  const offset = input.offset ?? 0;
  return `          <merc:${MERCURY_OPERATIONS.getVetDocumentList} ${NS_ATTRS}>
            <merc:listOptions>
              <bs:count>${count}</bs:count>
              <bs:offset>${offset}</bs:offset>
            </merc:listOptions>
            <merc:enterpriseGuid>${escapeXml(input.enterpriseGuid)}</merc:enterpriseGuid>
            ${optionalTag("merc:vetDocumentStatus", input.status)}
          </merc:${MERCURY_OPERATIONS.getVetDocumentList}>`;
}

/**
 * Изменения ВСД за окно времени — основной инкрементальный запрос.
 *
 * Окно берётся с нахлёстом (см. крон): дешевле перечитать десять минут,
 * чем потерять документ из-за расхождения часов со шлюзом. Повтор
 * безопасен — upsert идемпотентен по (организация, uuid).
 */
export function buildGetVetDocumentChangesList(input: {
  enterpriseGuid: string;
  beginDate: Date | string;
  endDate: Date | string;
  count?: number;
  offset?: number;
}): string {
  const count = Math.min(input.count ?? 100, 100);
  const offset = input.offset ?? 0;
  return `          <merc:${MERCURY_OPERATIONS.getVetDocumentChangesList} ${NS_ATTRS}>
            <merc:listOptions>
              <bs:count>${count}</bs:count>
              <bs:offset>${offset}</bs:offset>
            </merc:listOptions>
            <merc:enterpriseGuid>${escapeXml(input.enterpriseGuid)}</merc:enterpriseGuid>
            <merc:updateDateInterval>
              <bs:beginDate>${toXsdDate(input.beginDate)}</bs:beginDate>
              <bs:endDate>${toXsdDate(input.endDate)}</bs:endDate>
            </merc:updateDateInterval>
          </merc:${MERCURY_OPERATIONS.getVetDocumentChangesList}>`;
}

/**
 * Один ВСД по UUID.
 *
 * Нужен не для показа, а как ЗАЩИТА ОТ ДВОЙНОГО ГАШЕНИЯ: перед повторной
 * отправкой команды спрашиваем актуальный статус, и если документ уже
 * `UTILIZED` — считаем прошлую попытку успешной.
 */
export function buildGetVetDocumentByUuid(input: { uuid: string }): string {
  return `          <merc:${MERCURY_OPERATIONS.getVetDocumentByUuid} ${NS_ATTRS}>
            <merc:uuid>${escapeXml(input.uuid)}</merc:uuid>
          </merc:${MERCURY_OPERATIONS.getVetDocumentByUuid}>`;
}

/** Площадки предприятия — для маппинга на точки WeSetup. */
export function buildGetActivityLocationList(input: {
  enterpriseGuid: string;
  count?: number;
  offset?: number;
}): string {
  const count = Math.min(input.count ?? 100, 100);
  const offset = input.offset ?? 0;
  return `          <merc:${MERCURY_OPERATIONS.getActivityLocationList} ${NS_ATTRS}>
            <merc:listOptions>
              <bs:count>${count}</bs:count>
              <bs:offset>${offset}</bs:offset>
            </merc:listOptions>
            <merc:enterpriseGuid>${escapeXml(input.enterpriseGuid)}</merc:enterpriseGuid>
          </merc:${MERCURY_OPERATIONS.getActivityLocationList}>`;
}

/**
 * Гашение входящей партии.
 *
 * Единственная операция, которая что-то МЕНЯЕТ в Меркурии, и
 * единственная неидемпотентная на их стороне. Поля физического контроля
 * (транспорт, упаковка, документы, температура) приходят из формы
 * приёмки — их вводит человек, машина сама ничего не подтверждает.
 */
export function buildProcessIncomingConsignment(
  input: ProcessIncomingInput,
): string {
  const nonConforming = input.decision !== "ACCEPT";
  return `          <merc:${MERCURY_OPERATIONS.processIncomingConsignment} ${NS_ATTRS}>
            <merc:initiator>
              <dt:login>${escapeXml(input.initiatorLogin)}</dt:login>
            </merc:initiator>
            <merc:enterpriseGuid>${escapeXml(input.enterpriseGuid)}</merc:enterpriseGuid>
            <merc:vetDocumentUuid>${escapeXml(input.vetDocumentUuid)}</merc:vetDocumentUuid>
            <merc:delivery>
              <vd:decision>${escapeXml(input.decision)}</vd:decision>
              <vd:transportConditionCompliance>${input.transportConditionOk}</vd:transportConditionCompliance>
              <vd:packagingCompliance>${input.packagingOk}</vd:packagingCompliance>
              <vd:documentCompliance>${input.documentsOk}</vd:documentCompliance>
              ${optionalTag("vd:productTemperature", input.productTemperature)}
              ${
                input.actualVolume === null || input.actualVolume === undefined
                  ? ""
                  : `<vd:actualVolume>${Number(input.actualVolume)}</vd:actualVolume>` +
                    optionalTag("vd:unit", input.unit)
              }
              ${
                nonConforming
                  ? optionalTag("vd:discrepancyReason", input.discrepancyReason)
                  : ""
              }
            </merc:delivery>
          </merc:${MERCURY_OPERATIONS.processIncomingConsignment}>`;
}
