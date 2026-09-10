import ExcelJS from "exceljs";
import JSZip from "jszip";

import { db } from "@/lib/db";
import { generateJournalDocumentPdf } from "@/lib/document-pdf";

/**
 * Архив всех журналов организации за период: по каждому документу PDF (та же
 * печатная форма, что в кабинете) и XLSX с записями; полевые журналы — XLSX по
 * шаблону. Ограничение по числу документов — чтобы выгрузка укладывалась в
 * один запрос.
 */
export const ARCHIVE_MAX_DOCUMENTS = 200;

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "журнал";
}

function cellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

async function entriesSheet(workbook: ExcelJS.Workbook, title: string, rows: Array<{ date: Date; who: string; data: unknown }>): Promise<void> {
  const sheet = workbook.addWorksheet(safeName(title).slice(0, 31) || "Записи");
  const keys = new Set<string>();
  for (const r of rows) if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) for (const k of Object.keys(r.data as object)) keys.add(k);
  const columns = ["Дата", "Кто", ...keys];
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    const data = (r.data && typeof r.data === "object" && !Array.isArray(r.data) ? r.data : {}) as Record<string, unknown>;
    sheet.addRow([r.date.toISOString().slice(0, 10), r.who, ...[...keys].map((k) => cellValue(data[k]))]);
  }
  sheet.columns.forEach((c) => {
    c.width = 18;
  });
}

export async function buildJournalsArchive(organizationId: string, from: Date, to: Date): Promise<{ zip: Buffer; documents: number; fieldJournals: number; truncated: boolean }> {
  const zip = new JSZip();
  const documents = await db.journalDocument.findMany({
    where: { organizationId, dateFrom: { lte: to }, dateTo: { gte: from } },
    orderBy: [{ dateFrom: "asc" }],
    take: ARCHIVE_MAX_DOCUMENTS + 1,
    select: { id: true, title: true, dateFrom: true, dateTo: true, template: { select: { code: true, name: true } } },
  });
  const truncated = documents.length > ARCHIVE_MAX_DOCUMENTS;
  const docs = documents.slice(0, ARCHIVE_MAX_DOCUMENTS);
  const docsFolder = zip.folder("документы")!;
  for (const doc of docs) {
    const base = `${doc.dateFrom.toISOString().slice(0, 10)} ${safeName(doc.title || doc.template.name)}`;
    try {
      const pdf = await generateJournalDocumentPdf({ documentId: doc.id, organizationId });
      docsFolder.file(`${base}.pdf`, pdf.buffer);
    } catch (error) {
      docsFolder.file(`${base} — PDF не собрался.txt`, error instanceof Error ? error.message : "ошибка");
    }
    const entries = await db.journalDocumentEntry.findMany({
      where: { documentId: doc.id },
      orderBy: { date: "asc" },
      select: { date: true, data: true, employee: { select: { name: true } } },
    });
    if (entries.length > 0) {
      const workbook = new ExcelJS.Workbook();
      await entriesSheet(workbook, doc.template.name, entries.map((e) => ({ date: e.date, who: e.employee.name, data: e.data })));
      docsFolder.file(`${base}.xlsx`, Buffer.from(await workbook.xlsx.writeBuffer()));
    }
  }

  const fieldEntries = await db.journalEntry.findMany({
    where: { organizationId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, data: true, templateId: true, filledById: true },
  });
  const templateIds = Array.from(new Set(fieldEntries.map((e) => e.templateId)));
  const userIds = Array.from(new Set(fieldEntries.map((e) => e.filledById)));
  const [templates, users] = await Promise.all([
    templateIds.length ? db.journalTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, code: true, name: true } }) : [],
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
  ]);
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const byTemplate = new Map<string, { name: string; rows: Array<{ date: Date; who: string; data: unknown }> }>();
  for (const e of fieldEntries) {
    const template = templateById.get(e.templateId);
    const key = template?.code ?? e.templateId;
    const bucket = byTemplate.get(key) ?? { name: template?.name ?? key, rows: [] };
    bucket.rows.push({ date: e.createdAt, who: userName.get(e.filledById) ?? "", data: e.data });
    byTemplate.set(key, bucket);
  }
  const fieldFolder = zip.folder("журналы")!;
  for (const [code, bucket] of byTemplate) {
    const workbook = new ExcelJS.Workbook();
    await entriesSheet(workbook, bucket.name, bucket.rows);
    fieldFolder.file(`${safeName(bucket.name)} (${code}).xlsx`, Buffer.from(await workbook.xlsx.writeBuffer()));
  }
  zip.file(
    "ЧИТАЙ.txt",
    [
      `Архив журналов WeSetup за ${from.toISOString().slice(0, 10)} — ${to.toISOString().slice(0, 10)}.`,
      `Документов: ${docs.length}${truncated ? ` (показаны первые ${ARCHIVE_MAX_DOCUMENTS}, сузьте период)` : ""}, полевых журналов: ${byTemplate.size}.`,
      "Папка «документы» — печатные формы PDF и записи XLSX по каждому документу; «журналы» — записи полевых журналов.",
    ].join("\n")
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { zip: buffer, documents: docs.length, fieldJournals: byTemplate.size, truncated };
}
