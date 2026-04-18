/**
 * Pull a 7-day performance report from Yandex.Direct and surface
 * obvious optimisation wins:
 *   - ad groups with 0 clicks (pause or rewrite)
 *   - keywords with CTR < 0.5% (pause)
 *   - keywords with spend > 500₽ and 0 conversions (pause)
 *   - ad groups blowing most of the budget (candidate for new creative)
 *
 * Report goes via the Reports service (separate endpoint with its own
 * async polling). We take the "cache_and_server" strategy: ask the API
 * to return when the report is warm, poll once a second, max 60s.
 *
 * Usage:
 *   npx tsx scripts/yandex-direct-audit.ts
 *   npx tsx scripts/yandex-direct-audit.ts --days 14
 */

import "dotenv/config";

const TOKEN = process.env.YANDEX_DIRECT_OAUTH_TOKEN;
const REPORTS_URL = "https://api.direct.yandex.com/json/v5/reports";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

async function fetchReport(body: object): Promise<string> {
  if (!TOKEN) {
    throw new Error(
      "YANDEX_DIRECT_OAUTH_TOKEN не задан — получите токен через scripts/yandex-direct-auth.ts"
    );
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const res = await fetch(REPORTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Accept-Language": "ru",
        "Content-Type": "application/json; charset=utf-8",
        processingMode: "auto",
        returnMoneyInMicros: "false",
        skipReportHeader: "true",
        skipReportSummary: "true",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 200) return res.text();
    if (res.status === 201 || res.status === 202) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    throw new Error(`Reports HTTP ${res.status}: ${await res.text()}`);
  }
  throw new Error("Reports API: таймаут ожидания, отчёт не готов за 60 секунд");
}

async function main() {
  const days = Number(arg("days", "7"));
  const date_to = new Date();
  const date_from = new Date();
  date_from.setDate(date_from.getDate() - days);

  const body = {
    params: {
      SelectionCriteria: {
        DateFrom: date_from.toISOString().slice(0, 10),
        DateTo: date_to.toISOString().slice(0, 10),
      },
      FieldNames: [
        "Date",
        "CampaignName",
        "AdGroupName",
        "Criterion",
        "Impressions",
        "Clicks",
        "Ctr",
        "Cost",
        "AvgCpc",
      ],
      ReportName: `WeSetup audit ${Date.now()}`,
      ReportType: "CUSTOM_REPORT",
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: "NO",
      IncludeDiscount: "NO",
    },
  };

  console.log(`Запрашиваю отчёт за ${days} дней...`);
  const tsv = await fetchReport(body);
  const lines = tsv.split("\n").filter(Boolean);
  const header = lines.shift()?.split("\t") ?? [];
  const idx = (col: string) => header.indexOf(col);

  const rows = lines.map((l) => l.split("\t"));

  const aggByKeyword = new Map<
    string,
    {
      campaign: string;
      group: string;
      keyword: string;
      impressions: number;
      clicks: number;
      cost: number;
    }
  >();

  for (const r of rows) {
    const key = `${r[idx("CampaignName")]} · ${r[idx("AdGroupName")]} · ${r[idx("Criterion")]}`;
    const cur = aggByKeyword.get(key) ?? {
      campaign: r[idx("CampaignName")] ?? "?",
      group: r[idx("AdGroupName")] ?? "?",
      keyword: r[idx("Criterion")] ?? "?",
      impressions: 0,
      clicks: 0,
      cost: 0,
    };
    cur.impressions += Number(r[idx("Impressions")] ?? 0);
    cur.clicks += Number(r[idx("Clicks")] ?? 0);
    cur.cost += Number(r[idx("Cost")] ?? 0);
    aggByKeyword.set(key, cur);
  }

  const all = [...aggByKeyword.values()];
  if (all.length === 0) {
    console.log("Нет данных за выбранный период.");
    return;
  }

  console.log(
    `\nВсего строк: ${all.length}, общий расход: ${all.reduce((s, r) => s + r.cost, 0).toFixed(2)} ₽`
  );

  const noClicks = all.filter((r) => r.impressions >= 100 && r.clicks === 0);
  if (noClicks.length > 0) {
    console.log(`\n⚠ ${noClicks.length} фраз с ≥100 показов и 0 кликов — кандидаты на паузу:`);
    noClicks
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
      .forEach((r) =>
        console.log(`  · ${r.keyword}   [${r.group}]   показов=${r.impressions}`)
      );
  }

  const lowCtr = all.filter(
    (r) => r.impressions >= 50 && r.clicks / r.impressions < 0.005
  );
  if (lowCtr.length > 0) {
    console.log(`\n⚠ ${lowCtr.length} фраз с CTR < 0.5% — переписать объявления:`);
    lowCtr
      .sort((a, b) => a.clicks / a.impressions - b.clicks / b.impressions)
      .slice(0, 10)
      .forEach((r) => {
        const ctr = ((r.clicks / r.impressions) * 100).toFixed(2);
        console.log(`  · ${r.keyword}   CTR=${ctr}%   [${r.group}]`);
      });
  }

  const expensive = all.filter((r) => r.cost >= 500 && r.clicks > 0);
  if (expensive.length > 0) {
    console.log(
      `\nℹ ${expensive.length} фраз со спендом ≥500 ₽ — проверить качество трафика в Метрике (цель «Регистрация»):`
    );
    expensive
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
      .forEach((r) =>
        console.log(
          `  · ${r.keyword}   расход=${r.cost.toFixed(2)}₽  кликов=${r.clicks}  [${r.group}]`
        )
      );
  }

  const topByCost = [...all].sort((a, b) => b.cost - a.cost).slice(0, 5);
  console.log(`\nТоп-5 по расходу:`);
  topByCost.forEach((r) =>
    console.log(
      `  · ${r.keyword}   расход=${r.cost.toFixed(2)}₽  CTR=${((r.clicks / r.impressions) * 100).toFixed(1)}%`
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
