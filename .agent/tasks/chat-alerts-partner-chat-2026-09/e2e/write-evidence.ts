import fs from "node:fs";
import path from "node:path";

/** Собирает evidence.md / evidence.json из e2e-results.json и списка скриншотов. */
const dir = path.resolve(process.cwd(), ".agent/tasks/chat-alerts-partner-chat-2026-09");
const results = JSON.parse(fs.readFileSync(path.join(dir, "e2e-results.json"), "utf8")) as Array<{
  ac: string;
  ok: boolean;
  note: string;
}>;
const shots = fs.readdirSync(path.join(dir, "shots")).filter((f) => f.endsWith(".png") && !f.startsWith("dbg-"));
const checks = {
  tsc: process.env.EV_TSC ?? "unknown",
  lint: process.env.EV_LINT ?? "unknown",
  tests: process.env.EV_TESTS ?? "unknown",
  migrateDiff: process.env.EV_DIFF ?? "unknown",
};
const byAc = new Map<string, { pass: number; fail: number; notes: string[] }>();
for (const r of results) {
  const key = r.ac.split("/")[0].split(":")[0].trim();
  const entry = byAc.get(key) ?? { pass: 0, fail: 0, notes: [] };
  if (r.ok) entry.pass += 1;
  else entry.fail += 1;
  entry.notes.push(`${r.ok ? "PASS" : "FAIL"} — ${r.note}`);
  byAc.set(key, entry);
}
const allPass = results.every((r) => r.ok) && Object.values(checks).every((v) => v === "PASS");

const md: string[] = [];
md.push("# Evidence — чат: звук/всплывашка, партнёрские переписки, рассылка, ночная тема лендинга");
md.push("");
md.push(`Дата: ${new Date().toISOString()} · dev-сервер localhost:3020 · локальная БД (PGlite 5433)`);
md.push("");
md.push("## Проверки");
md.push("");
md.push("| Проверка | Результат |");
md.push("|---|---|");
md.push(`| \`npx tsc --noEmit --skipLibCheck\` (без .next/types и чужого payment/route.ts) | ${checks.tsc} |`);
md.push(`| \`eslint\` по затронутым файлам | ${checks.lint} |`);
md.push(`| \`npm test\` | ${checks.tests} |`);
md.push(`| \`prisma migrate diff\`: только ADD COLUMN / CREATE INDEX по Support* | ${checks.migrateDiff} |`);
md.push("");
md.push("## Критерии приёмки (e2e, Playwright)");
md.push("");
for (const [ac, entry] of [...byAc.entries()].sort()) {
  md.push(`### ${ac} — ${entry.fail === 0 ? "PASS" : "FAIL"} (${entry.pass}/${entry.pass + entry.fail})`);
  for (const n of entry.notes) md.push(`- ${n}`);
  md.push("");
}
md.push("## Скриншоты (`shots/`)");
md.push("");
for (const s of shots) md.push(`- ${s}`);
md.push("");
md.push(`## Итог: ${allPass ? "PASS" : "FAIL"}`);
fs.writeFileSync(path.join(dir, "evidence.md"), md.join("\n"));
fs.writeFileSync(
  path.join(dir, "evidence.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), checks, results, shots, verdict: allPass ? "PASS" : "FAIL" }, null, 2)
);
console.log("evidence written, verdict:", allPass ? "PASS" : "FAIL");
