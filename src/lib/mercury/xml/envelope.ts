/**
 * Конверты подсистемы обработки заявок Ветис.API.
 *
 * Протокол псевдоасинхронный и состоит ровно из двух конвертов:
 *
 *   submitApplicationRequest   → { applicationId, status: ACCEPTED }
 *   receiveApplicationResult   → { status: IN_PROCESS }        ← повторяем
 *                              → { status: COMPLETED, result } ← разбираем
 *                              → { status: REJECTED, errors[] }
 *
 * Тело конкретной операции (`GetVetDocumentListRequest` и т.п.) собирают
 * `build-*.ts` и подставляются сюда как `applicationDataXml`.
 */
import { MERCURY_SERVICE_ID, NS } from "../ns";
import { escapeXml, toXsdDateTime } from "./escape";

/**
 * `submitApplicationRequest`.
 *
 * `issuerId` — ГУИД хозяйствующего субъекта клиента; `apiKey` передаётся
 * отдельным полем конверта, а не заголовком. Оба обязательны: по паре
 * (APIKey, issuerId) шлюз понимает, чья это система и от чьего имени
 * действие.
 */
export function buildSubmitApplication(input: {
  apiKey: string;
  issuerId: string;
  /** XML тела операции — уже экранированный, собирается build-*.ts. */
  applicationDataXml: string;
  issueDate?: Date;
}): string {
  const issueDate = toXsdDateTime(input.issueDate ?? new Date());
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS.soap}" xmlns:apldef="${NS.apldef}" xmlns:apl="${NS.apl}">
  <soapenv:Header/>
  <soapenv:Body>
    <apldef:submitApplicationRequest>
      <apldef:apiKey>${escapeXml(input.apiKey)}</apldef:apiKey>
      <apldef:application>
        <apl:serviceId>${escapeXml(MERCURY_SERVICE_ID)}</apl:serviceId>
        <apl:issuerId>${escapeXml(input.issuerId)}</apl:issuerId>
        <apl:issueDate>${issueDate}</apl:issueDate>
        <apl:data>
${input.applicationDataXml}
        </apl:data>
      </apldef:application>
    </apldef:submitApplicationRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** `receiveApplicationResultRequest` — забор результата по id заявки. */
export function buildReceiveApplicationResult(input: {
  apiKey: string;
  issuerId: string;
  applicationId: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS.soap}" xmlns:apldef="${NS.apldef}">
  <soapenv:Header/>
  <soapenv:Body>
    <apldef:receiveApplicationResultRequest>
      <apldef:apiKey>${escapeXml(input.apiKey)}</apldef:apiKey>
      <apldef:issuerId>${escapeXml(input.issuerId)}</apldef:issuerId>
      <apldef:applicationId>${escapeXml(input.applicationId)}</apldef:applicationId>
    </apldef:receiveApplicationResultRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}
