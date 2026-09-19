import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultAuditReportConfig,
  importAuditReportFindingsFromProtocol,
  normalizeAuditReportConfig,
  type AuditReportProtocolSource,
} from "@/lib/audit-report-document";

const protocol: AuditReportProtocolSource = {
  documentId: "protocol-1",
  title: "Протокол внутреннего аудита от 12.02.2026",
  rows: [
    { id: "r1", text: "Записи ККТ ведутся несвоевременно", note: "Цех №2" },
    { id: "r2", text: "Нет отметок о мойке инвентаря", note: "" },
  ],
};

test("перенос несоответствий копирует требование и примечание", () => {
  const { config, added, skipped } = importAuditReportFindingsFromProtocol(
    getDefaultAuditReportConfig(),
    protocol
  );

  assert.equal(added, 2);
  assert.equal(skipped, 0);
  assert.equal(config.sourceProtocolDocumentId, "protocol-1");
  assert.equal(config.sourceProtocolTitle, protocol.title);
  assert.equal(
    config.findings[0]!.nonConformity,
    "Записи ККТ ведутся несвоевременно\nПримечание: Цех №2"
  );
  assert.equal(config.findings[1]!.nonConformity, "Нет отметок о мойке инвентаря");
  assert.deepEqual(
    config.findings.map((item) => item.protocolRowId),
    ["r1", "r2"]
  );
});

test("повторный перенос не создаёт дублей", () => {
  const first = importAuditReportFindingsFromProtocol(
    getDefaultAuditReportConfig(),
    protocol
  );
  const second = importAuditReportFindingsFromProtocol(first.config, protocol);

  assert.equal(second.added, 0);
  assert.equal(second.skipped, 2);
  assert.equal(second.config.findings.length, 2);
});

test("новая строка протокола переносится, уже перенесённые — нет", () => {
  const first = importAuditReportFindingsFromProtocol(
    getDefaultAuditReportConfig(),
    protocol
  );
  const second = importAuditReportFindingsFromProtocol(first.config, {
    ...protocol,
    rows: [...protocol.rows, { id: "r3", text: "Просроченная медкнижка", note: "" }],
  });

  assert.equal(second.added, 1);
  assert.equal(second.skipped, 2);
  assert.equal(second.config.findings.length, 3);
});

test("вручную заведённые несоответствия остаются на месте", () => {
  const base = importAuditReportFindingsFromProtocol(
    getDefaultAuditReportConfig(),
    protocol
  ).config;
  const withManual = {
    ...base,
    findings: [
      ...base.findings,
      { ...base.findings[0]!, id: "manual-1", protocolRowId: undefined, nonConformity: "Своё" },
    ],
  };

  const again = importAuditReportFindingsFromProtocol(withManual, protocol);
  assert.equal(again.added, 0);
  assert.equal(again.config.findings.length, 3);
  assert.ok(again.config.findings.some((item) => item.nonConformity === "Своё"));
});

test("protocolRowId и ссылка переживают нормализацию, старый отчёт — как раньше", () => {
  const { config } = importAuditReportFindingsFromProtocol(
    getDefaultAuditReportConfig(),
    protocol
  );
  const restored = normalizeAuditReportConfig(JSON.parse(JSON.stringify(config)));
  assert.equal(restored.sourceProtocolDocumentId, "protocol-1");
  assert.equal(restored.findings[0]!.protocolRowId, "r1");

  const legacy = normalizeAuditReportConfig({ documentDate: "2026-02-01" });
  assert.equal(legacy.sourceProtocolDocumentId, null);
  assert.equal(legacy.findings.length, 0);
});
