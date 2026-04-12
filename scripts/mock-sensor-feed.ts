/**
 * Mock sensor feed for climate_control and cold_equipment_control.
 * Posts a reading every SENSOR_INTERVAL_MS milliseconds (default 15 min) until
 * stopped or until --ticks=N rounds have fired.
 *
 * Usage:
 *   EXTERNAL_API_BASE=https://wesetup.ru \
 *   SENSOR_API_TOKEN=... \
 *   EXTERNAL_API_ORG_ID=cmnm40ikt00002ktseet6fd5y \
 *   npx tsx scripts/mock-sensor-feed.ts --ticks=3 --interval=60
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.EXTERNAL_API_BASE || "https://wesetup.ru").replace(/\/$/, "");
const TOKEN = process.env.SENSOR_API_TOKEN || process.env.EXTERNAL_API_TOKEN || "";
const ORG_ID = process.env.EXTERNAL_API_ORG_ID || "";

const args = new Map<string, string>(
  process.argv
    .slice(2)
    .map((a) => a.replace(/^--/, "").split("="))
    .filter((pair): pair is [string, string] => pair.length === 2)
    .map(([k, v]) => [k, v])
);
const TICKS = Number(args.get("ticks") || "0") || Number.POSITIVE_INFINITY;
const INTERVAL_SEC = Number(args.get("interval") || "900");
const OUT_DIR = ".agent/tasks/journals-external-api/_sensor";

if (!TOKEN || !ORG_ID) {
  console.error("Missing SENSOR_API_TOKEN or EXTERNAL_API_ORG_ID env.");
  process.exit(2);
}

function climateReading() {
  return {
    temp: 20 + Math.random() * 5,
    humidity: 50 + Math.random() * 10,
    ts: new Date().toISOString(),
    source: "mock-sensor",
  };
}

function fridgeReading() {
  return {
    readings: [
      { equipmentName: "Холодильник 1", temp: 2 + Math.random() * 3, ts: new Date().toISOString() },
      { equipmentName: "Морозильник 1", temp: -20 + Math.random() * 2, ts: new Date().toISOString() },
    ],
    source: "mock-sensor",
  };
}

type TickResult = {
  tick: number;
  when: string;
  climate: { status: number; ok?: boolean; documentId?: string; error?: string };
  fridge: { status: number; ok?: boolean; documentId?: string; error?: string };
};

async function post(journalCode: string, data: unknown) {
  try {
    const res = await fetch(`${BASE}/api/external/entries`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        journalCode,
        source: "sensor",
        date: new Date().toISOString().slice(0, 10),
        data,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      status: res.status,
      ok: Boolean(body.ok),
      documentId: typeof body.documentId === "string" ? body.documentId : undefined,
      error: body.ok === false ? String(body.error ?? "") : undefined,
    };
  } catch (error) {
    return { status: 0, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const log: TickResult[] = [];
  let tick = 0;

  while (tick < TICKS) {
    tick += 1;
    const when = new Date().toISOString();
    const climate = await post("climate_control", climateReading());
    const fridge = await post("cold_equipment_control", fridgeReading());
    const r: TickResult = { tick, when, climate, fridge };
    log.push(r);
    console.log(
      `tick=${tick} climate=${climate.status}/${climate.ok ? "ok" : climate.error ?? "?"} fridge=${fridge.status}/${fridge.ok ? "ok" : fridge.error ?? "?"}`
    );
    await fs.writeFile(
      path.join(OUT_DIR, "feed.json"),
      JSON.stringify({ base: BASE, organizationId: ORG_ID, ticks: log }, null, 2),
      "utf8"
    );
    if (tick >= TICKS) break;
    await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
  }

  const mdLines = [
    `# Mock sensor feed — ${new Date().toISOString()}`,
    `Base: ${BASE}`,
    `Org: ${ORG_ID}`,
    `Ticks: ${log.length}`,
    "",
    "| Tick | When (UTC) | climate | cold_equipment |",
    "|---:|---|---|---|",
    ...log.map(
      (r) =>
        `| ${r.tick} | ${r.when} | ${r.climate.status}/${r.climate.ok ? "ok" : r.climate.error ?? "-"} | ${r.fridge.status}/${r.fridge.ok ? "ok" : r.fridge.error ?? "-"} |`
    ),
  ];
  await fs.writeFile(path.join(OUT_DIR, "feed.md"), mdLines.join("\n"), "utf8");
  console.log(`Done. Wrote ${OUT_DIR}/feed.json + feed.md`);
}

main().catch((error) => {
  console.error(error);
  process.exit(3);
});
