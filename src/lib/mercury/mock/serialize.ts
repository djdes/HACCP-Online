/**
 * Мок собирает ОТВЕТЫ в том же XML, что и настоящий шлюз.
 *
 * Это не косметика: благодаря этому боевой парсер (`xml/parse.ts`)
 * проходится end-to-end ещё до получения доступов. Когда придут реальные
 * креды, калибровать останется только имена namespace'ов и набор полей —
 * а не всю цепочку.
 */
import { NS } from "../ns";
import { escapeXml } from "../xml/escape";
import type { MockApplication, MockVetDocument } from "./store";

function vetDocumentXml(doc: MockVetDocument): string {
  return `      <vd:vetDocument>
        <vd:uuid>${escapeXml(doc.uuid)}</vd:uuid>
        <vd:number>${escapeXml(doc.number)}</vd:number>
        <vd:vetDType>${escapeXml(doc.docType)}</vd:vetDType>
        <vd:status>${escapeXml(doc.status)}</vd:status>
        <vd:issueDate>${escapeXml(doc.issueDate)}</vd:issueDate>
        <vd:deliveryDate>${escapeXml(doc.deliveryDate)}</vd:deliveryDate>
        <vd:consignee>
          <ent:guid>${escapeXml(doc.consigneeEnterpriseGuid)}</ent:guid>
        </vd:consignee>
        <vd:consignor>
          <ent:guid>${escapeXml(doc.consignorEnterpriseGuid)}</ent:guid>
          <ent:name>${escapeXml(doc.consignorName)}</ent:name>
          <ent:inn>${escapeXml(doc.consignorInn)}</ent:inn>
        </vd:consignor>
        <vd:consignment>
          <vd:batch>
            <vd:productItem>
              <dt:name>${escapeXml(doc.productName)}</dt:name>
            </vd:productItem>
            <vd:productType>${escapeXml(doc.productType)}</vd:productType>
            <vd:volume>${doc.volume ?? ""}</vd:volume>
            <vd:unit>
              <dt:name>${escapeXml(doc.unit)}</dt:name>
            </vd:unit>
            <vd:batchId>${escapeXml(doc.batchNumber)}</vd:batchId>
            <vd:dateOfProduction>
              <bs:firstDate>${escapeXml(doc.productionDate)}</bs:firstDate>
            </vd:dateOfProduction>
            <vd:expiryDate>
              <bs:firstDate>${escapeXml(doc.expiryDate)}</bs:firstDate>
            </vd:expiryDate>
            <vd:origin>
              <ent:name>${escapeXml(doc.manufacturerName)}</ent:name>
            </vd:origin>
          </vd:batch>
        </vd:consignment>
        <vd:transportInfo>
          <vd:transportNumber>${escapeXml(doc.transportInfo)}</vd:transportNumber>
        </vd:transportInfo>
        <vd:referencedDocument>
          <vd:type>ТТН</vd:type>
          <vd:number>${escapeXml(doc.accompanyingDocs)}</vd:number>
        </vd:referencedDocument>
      </vd:vetDocument>`;
}

export function mockSubmitResponseXml(app: MockApplication): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS.soap}" xmlns:apldef="${NS.apldef}" xmlns:apl="${NS.apl}">
  <soapenv:Body>
    <apldef:submitApplicationResponse>
      <apldef:application>
        <apl:applicationId>${escapeXml(app.id)}</apl:applicationId>
        <apl:status>${escapeXml(app.status)}</apl:status>
      </apldef:application>
    </apldef:submitApplicationResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function mockReceiveResponseXml(
  app: MockApplication,
  documents: MockVetDocument[],
): string {
  const errors =
    app.errors.length > 0
      ? `<apl:errors>${app.errors
          .map(
            (e) =>
              `<apl:error code="${escapeXml(e.code ?? "")}">${escapeXml(e.message)}</apl:error>`,
          )
          .join("")}</apl:errors>`
      : "";

  const body =
    app.status !== "COMPLETED"
      ? ""
      : app.resultXml
        ? `<merc:result xmlns:merc="${NS.merc}">${app.resultXml}</merc:result>`
        : `<merc:vetDocumentList xmlns:merc="${NS.merc}" xmlns:vd="${NS.vd}" xmlns:ent="${NS.ent}" xmlns:dt="${NS.dt}" xmlns:bs="${NS.bs}">
      <bs:total>${documents.length}</bs:total>
      <bs:offset>0</bs:offset>
      <bs:count>${documents.length}</bs:count>
${documents.map(vetDocumentXml).join("\n")}
    </merc:vetDocumentList>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS.soap}" xmlns:apldef="${NS.apldef}" xmlns:apl="${NS.apl}">
  <soapenv:Body>
    <apldef:receiveApplicationResultResponse>
      <apldef:application>
        <apl:applicationId>${escapeXml(app.id)}</apl:applicationId>
        <apl:status>${escapeXml(app.status)}</apl:status>
        ${errors}
        ${body}
      </apldef:application>
    </apldef:receiveApplicationResultResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}
