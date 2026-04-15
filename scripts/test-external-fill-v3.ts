/**
 * Part-3 verification script.
 *
 * For each canonical journal code:
 *   1. POST a realistic payload via /api/external/entries
 *   2. Persist the exact curl + response pair to evidence folder
 *   3. Verify via DB introspection that the entry actually landed
 *   4. Emit per-code evidence.md + evidence.json
 *
 * DB verification is run server-side via ssh/psql (done by the caller after this
 * script via verify-part3.sh), so here we only handle the HTTP exchange.
 *
 * Env:
 *   EXTERNAL_API_BASE       — https://wesetup.ru
 *   EXTERNAL_API_TOKEN      — bearer
 *   EXTERNAL_API_ORG_ID     — target organisation id
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.EXTERNAL_API_BASE?.replace(/\/$/, "") || "https://wesetup.ru";
const TOKEN = process.env.EXTERNAL_API_TOKEN || "";
const ORG_ID = process.env.EXTERNAL_API_ORG_ID || "";
const OUT_DIR = ".agent/tasks/journals-external-api-part3";

if (!TOKEN || !ORG_ID) {
  console.error("Missing EXTERNAL_API_TOKEN or EXTERNAL_API_ORG_ID env.");
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);

/** Realistic payloads per code. `data` is what lands inside JournalDocumentEntry.data. */
function payloadFor(code: string): Record<string, unknown> {
  switch (code) {
    case "hygiene":
      return { status: "healthy", temperatureAbove37: false };
    case "health_check":
      return { signed: true, measures: "Осмотр проведён, здоров" };

    case "climate_control":
      return {
        measurements: [
          { time: "10:00", temperature: 22.4, humidity: 54 },
          { time: "17:00", temperature: 23.1, humidity: 56 },
        ],
        roomName: "Склад",
        note: "Параметры в норме",
      };

    case "cold_equipment_control":
      return {
        readings: [
          { equipmentName: "Холодильник №1", temperature: 3.5, time: "08:00" },
          { equipmentName: "Морозильник №1", temperature: -18.2, time: "08:00" },
        ],
        note: "Показания в норме",
      };

    case "cleaning":
    case "general_cleaning":
    case "cleaning_ventilation_checklist":
    case "equipment_cleaning":
    case "sanitary_day_control":
      return {
        done: true,
        performer: "Повар горячего цеха",
        note: "Уборка выполнена по графику",
      };

    case "uv_lamp_runtime":
      return {
        runtimeMinutes: 30,
        status: "ok",
        lampId: "uv-1",
        note: "Лампа отработала плановый цикл",
      };

    case "fryer_oil":
      return {
        tpm: 18,
        qualityScore: 3,
        action: "continue",
        equipment: "Фритюрница №1",
        oilType: "Подсолнечное",
        productType: "Картофель фри",
        note: "TPM в пределах нормы",
      };

    case "finished_product":
      return {
        productName: "Суп куриный с лапшой",
        quantity: 10,
        unit: "л",
        organoleptic: "Запах, вкус, цвет в норме",
        result: "pass",
        note: "Партия к реализации допущена",
      };

    case "perishable_rejection":
      return {
        productName: "Салат оливье",
        quantity: 2,
        unit: "кг",
        reason: "Истёк срок хранения",
        action: "утилизация",
        result: "reject",
      };

    case "incoming_control":
    case "incoming_raw_materials_control":
      return {
        supplier: "ООО «Мясокомбинат»",
        productName: "Курица охлаждённая",
        quantity: 15,
        unit: "кг",
        temperature: 2.5,
        packageOk: true,
        docsOk: true,
        result: "pass",
        note: "Приёмка разрешена",
      };

    case "med_books":
      return {
        employeeName: "Иванов И.И.",
        medBookNumber: "МК-00123",
        lastExam: "2026-01-15",
        nextExam: "2026-07-15",
        vaccinations: [
          { name: "Дифтерия", status: "done", date: "2025-03-10" },
          { name: "Гепатит А", status: "done", date: "2025-06-20" },
        ],
        note: "Медосмотр пройден",
      };

    case "training_plan":
      return {
        topic: "Санитарные требования при обработке сырья",
        scheduledAt: today,
        durationHours: 2,
        format: "очно",
        note: "План на квартал",
      };

    case "staff_training":
      return {
        topic: "Входной инструктаж по СанПиН",
        trainerName: "Шеф-повар",
        durationHours: 1,
        trainees: ["Иванов И.И.", "Петров П.П."],
        signed: true,
        note: "Инструктаж проведён",
      };

    case "disinfectant_usage":
      return {
        productName: "Септабик",
        concentration: "0.1%",
        volumeLiters: 5,
        area: "Горячий цех",
        purpose: "Дезинфекция поверхностей",
        note: "Применено по инструкции",
      };

    case "equipment_maintenance":
      return {
        equipmentName: "Пароконвектомат №1",
        workType: "Плановое ТО",
        result: "Исправно",
        technician: "Сервис-инженер",
        note: "Следующее ТО — через 3 мес.",
      };

    case "breakdown_history":
      return {
        equipmentName: "Холодильник №1",
        breakdownType: "Утечка хладагента",
        repairAction: "Заменён компрессор",
        downtimeHours: 4,
        cost: 12000,
        note: "Восстановлено в срок",
      };

    case "equipment_calibration":
      return {
        equipmentName: "Термогигрометр №1",
        method: "Сличение с эталоном",
        deviation: 0.3,
        verdict: "Годен",
        nextDate: "2027-04-13",
      };

    case "ppe_issuance":
      return {
        employeeName: "Иванов И.И.",
        ppeType: "Перчатки нитриловые",
        quantity: 2,
        unit: "пара",
        signed: true,
      };

    case "accident_journal":
      return {
        happenedAt: today,
        location: "Горячий цех",
        description: "Поскользнулся на мокром полу",
        injury: "Ушиб локтя",
        firstAid: "Обработка, холодный компресс",
        measures: "Установлен знак 'Осторожно, мокрый пол'",
      };

    case "complaint_register":
      return {
        date: today,
        source: "клиент",
        content: "Жалоба на пересол блюда",
        action: "Корректировка рецептуры",
        responsible: "Шеф-повар",
        resolved: true,
      };

    case "product_writeoff":
      return {
        productName: "Молоко 3.2%",
        quantity: 5,
        unit: "л",
        reason: "Истёк срок хранения",
        commission: ["Управляющий", "Шеф-повар", "Кладовщик"],
        note: "Утилизация по акту",
      };

    case "audit_plan":
      return {
        auditTopic: "Проверка процессов приёмки сырья",
        scheduledAt: today,
        auditor: "Технолог",
        scope: "Склад, горячий цех",
      };

    case "audit_protocol":
      return {
        auditTopic: "Проверка соблюдения температурных режимов",
        conductedAt: today,
        auditor: "Технолог",
        findings: "Незначительные отклонения не выявлены",
        score: 95,
      };

    case "audit_report":
      return {
        reportPeriod: `${today.slice(0, 7)}`,
        summary: "За период нарушений не выявлено",
        nonconformities: 0,
        recommendations: "Провести плановое обучение в следующем квартале",
      };

    case "traceability_test":
      return {
        batchCode: "BATCH-2026-04-0001",
        productName: "Суп куриный",
        supplierChain: ["ООО «Мясокомбинат»", "ООО «Овощебаза»"],
        result: "пройдено",
        note: "Прослеживаемость восстановлена за 15 минут",
      };

    case "metal_impurity":
      return {
        rawMaterial: "Мука пшеничная",
        supplier: "ООО «Мукомол»",
        quantity: 50,
        unit: "кг",
        detectorStatus: "работает",
        result: "примесей не обнаружено",
      };

    case "intensive_cooling":
      return {
        productName: "Гуляш",
        startTime: "12:00",
        endTime: "13:30",
        startTemp: 75,
        endTemp: 4,
        equipmentName: "Шкаф интенсивного охлаждения",
        result: "pass",
      };

    case "glass_items_list":
      return {
        items: [
          { name: "Стеклянная банка", area: "Склад", count: 5 },
          { name: "Мерный стакан", area: "Горячий цех", count: 2 },
        ],
        note: "Перечень актуализирован",
      };

    case "glass_control":
      return {
        area: "Горячий цех",
        result: "целостно",
        checkedItems: 7,
        damaged: 0,
        note: "Визуальный осмотр без замечаний",
      };

    case "pest_control":
      return {
        area: "Склад",
        treatmentType: "дератизация",
        agent: "приманочная станция",
        result: "следов вредителей не обнаружено",
        performer: "ООО «СЭС-Сервис»",
      };

    default:
      return { note: "external-v3 generic", today, code };
  }
}

async function writeFileSafe(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

async function runOne(code: string) {
  const dir = path.join(OUT_DIR, code);
  await fs.mkdir(dir, { recursive: true });

  const data = payloadFor(code);
  const payload = {
    organizationId: ORG_ID,
    journalCode: code,
    date: today,
    source: "employee_app" as const,
    data,
  };
  const payloadJson = JSON.stringify(payload, null, 2);
  await writeFileSafe(path.join(dir, "request.json"), payloadJson);

  const requestSh = [
    "#!/usr/bin/env bash",
    "# Masked token — set EXTERNAL_API_TOKEN env before running.",
    "set -euo pipefail",
    `curl -sS -X POST "${BASE}/api/external/entries" \\`,
    `  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \\`,
    '  -H "content-type: application/json" \\',
    `  -d '${JSON.stringify(payload).replace(/'/g, "'\\''")}'`,
    "",
  ].join("\n");
  await writeFileSafe(path.join(dir, "request.sh"), requestSh);

  const started = Date.now();
  const res = await fetch(`${BASE}/api/external/entries`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: payloadJson,
  });
  const rawText = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  const elapsedMs = Date.now() - started;

  await writeFileSafe(path.join(dir, "response.json"), rawText);

  const ok = Boolean(parsed?.ok) && res.status === 200;
  const entriesWritten = Number(parsed?.entriesWritten ?? 0);
  const documentId = typeof parsed?.documentId === "string" ? parsed.documentId : null;

  const evidence = {
    code,
    httpStatus: res.status,
    ok,
    documentId,
    entriesWritten,
    createdDocument: parsed?.createdDocument ?? null,
    templateCode: parsed?.templateCode ?? null,
    elapsedMs,
    ranAt: new Date().toISOString(),
    payload,
  };
  await writeFileSafe(
    path.join(dir, "evidence.json"),
    JSON.stringify(evidence, null, 2)
  );

  const md = [
    `# ${code} — external POST verification — ${evidence.ranAt}`,
    "",
    `- HTTP: **${res.status}**`,
    `- ok: **${ok}**`,
    `- documentId: \`${documentId ?? "-"}\``,
    `- entriesWritten: **${entriesWritten}**`,
    `- createdDocument: ${String(parsed?.createdDocument)}`,
    `- elapsedMs: ${elapsedMs}`,
    "",
    "## Request",
    "```bash",
    "$ bash request.sh",
    "```",
    "",
    "## Response (verbatim)",
    "```json",
    rawText.trim(),
    "```",
    "",
    "## Payload data shape sent",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
    "",
    "## Verdict",
    ok && documentId && entriesWritten >= 1 ? "PASS (HTTP layer)" : "FAIL (HTTP layer)",
    "",
    "> DB-residue verification lives in `_summary/db-verification.md` — it reads",
    "> the prod `JournalDocumentEntry` row for this documentId and confirms the",
    "> `data` column equals the payload above.",
    "",
  ].join("\n");
  await writeFileSafe(path.join(dir, "evidence.md"), md);

  return { code, ok, documentId, entriesWritten, httpStatus: res.status };
}

async function main() {
  const codesPath = ".agent/tasks/journals-external-api/prod-journal-codes.txt";
  const codes = (await fs.readFile(codesPath, "utf8"))
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: Array<Awaited<ReturnType<typeof runOne>>> = [];
  for (const code of codes) {
    process.stdout.write(`[${code}] ... `);
    try {
      const r = await runOne(code);
      results.push(r);
      console.log(`${r.ok ? "OK" : "FAIL"}  doc=${r.documentId ?? "-"} entries=${r.entriesWritten}`);
    } catch (error) {
      console.log(`EXC ${error instanceof Error ? error.message : error}`);
      results.push({
        code,
        ok: false,
        documentId: null,
        entriesWritten: 0,
        httpStatus: 0,
      });
    }
  }

  await writeFileSafe(
    path.join(OUT_DIR, "_summary", "http-results.json"),
    JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, orgId: ORG_ID, results }, null, 2)
  );

  const md = [
    `# External API HTTP results — ${new Date().toISOString()}`,
    `Base: ${BASE}`,
    `Org: ${ORG_ID}`,
    "",
    "| Code | HTTP | ok | documentId | entries |",
    "|---|---:|:-:|---|---:|",
    ...results.map(
      (r) =>
        `| ${r.code} | ${r.httpStatus} | ${r.ok ? "✅" : "❌"} | ${r.documentId ?? "-"} | ${r.entriesWritten} |`
    ),
  ];
  await writeFileSafe(path.join(OUT_DIR, "_summary", "http-results.md"), md.join("\n"));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nOK=${results.length - failed} FAIL=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(3);
});
