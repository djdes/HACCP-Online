import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

type BehaviorEntry = {
  code: string;
  route: string;
  createFlow: boolean;
  openFlow: boolean;
  editFlow: boolean;
  deleteFlow: boolean;
  archiveCloseFlow: boolean;
  saveFlow: boolean;
  buttonProofStatus: string;
};

type PrintEntry = {
  code: string;
  route: string;
  listPrint: string;
  detailPrint: string;
  printStatus: string;
};

type SweepEntry = {
  code: string;
  route: string;
  list: {
    ok: boolean;
    url: string;
    title: string;
    h1: string;
    documentLinks: string[];
    printButtonCount: number;
    hasCreateButton: boolean;
  };
  detail: {
    ok: boolean;
    url: string | null;
    title: string;
    h1: string;
    bodyTextSnippet?: string;
    inputCount: number;
    hasSaveButton: boolean;
    printButtonCount: number;
    docId: string | null;
  };
  print: {
    expected: boolean;
    mode: string;
    ok: boolean | null;
    httpStatus: number | null;
    contentType: string | null;
    looksLikePdf: boolean | null;
    sizeBytes: number | null;
    error: string | null;
  };
  notes: string[];
};

type RuntimeSnapshot = {
  generatedAt: string;
  baseUrl: string;
  total: number;
  passedList: number;
  passedDetail: number;
  passedPrintExpected: number;
  entries: SweepEntry[];
};

const OUTPUT_JSON = ".agent/tasks/journals-full-parity-2026-04-11/raw/local-runtime-sweep.json";
const OUTPUT_MD = ".agent/tasks/journals-full-parity-2026-04-11/raw/local-runtime-sweep.md";
const BEHAVIOR_MATRIX = ".agent/tasks/journals-full-parity-2026-04-11/raw/behavior-matrix.json";
const PRINT_MATRIX = ".agent/tasks/journals-full-parity-2026-04-11/raw/print-matrix.json";

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(path.resolve(filePath), "utf8");
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(normalized) as T;
}

async function ensureLoggedIn(baseUrl: string, email: string, password: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 2200 } });
  const page = await context.newPage();

  const response = await context.request.post(new URL("/api/auth/login", baseUrl).toString(), {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Local API login failed with status ${response.status()}`);
  }

  await page.goto(new URL("/dashboard", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  if (page.url().includes("/login")) {
    throw new Error(`Local session cookie was not accepted, current URL: ${page.url()}`);
  }

  return { browser, context, page };
}

async function captureList(page: import("playwright").Page, routeUrl: string, code: string) {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);

  return page.evaluate(({ code }) => {
    const labels = Array.from(
      document.querySelectorAll("button, a, input[type='button'], input[type='submit']")
    )
      .map((node) => {
        if (node instanceof HTMLInputElement) return (node.value || "").trim();
        return (node.textContent || "").trim();
      })
      .filter(Boolean);
    const docLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(`a[href*="/journals/${code}/documents/"]`)
    )
      .map((node) => node.href)
      .filter(Boolean);

    return {
      url: location.href,
      title: document.title,
      h1: (document.querySelector("h1")?.textContent || "").trim(),
      documentLinks: Array.from(new Set(docLinks)).slice(0, 20),
      printButtonCount: labels.filter((label) => /печать/i.test(label)).length,
      hasCreateButton: labels.some((label) =>
        /(создать|добавить|нов(ый|ая|ое)|открыть журнал|заполнить)/i.test(label)
      ),
    };
  }, { code });
}

async function captureDetail(page: import("playwright").Page, detailUrl: string) {
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const labels = Array.from(
      document.querySelectorAll("button, a, input[type='button'], input[type='submit']")
    )
      .map((node) => {
        if (node instanceof HTMLInputElement) return (node.value || "").trim();
        return (node.textContent || "").trim();
      })
      .filter(Boolean);
    const docIdMatch = location.pathname.match(/\/documents\/([^/]+)/);
    return {
      url: location.href,
      title: document.title,
      h1: (document.querySelector("h1")?.textContent || "").trim(),
      bodyTextSnippet: (document.body?.innerText || "").slice(0, 240),
      inputCount: document.querySelectorAll("input, textarea, select").length,
      hasSaveButton: labels.some((label) => /(сохранить|save)/i.test(label)),
      printButtonCount: labels.filter((label) => /печать/i.test(label)).length,
      docId: docIdMatch?.[1] ?? null,
    };
  });
}

async function probePdf(
  context: import("playwright").BrowserContext,
  baseUrl: string,
  docId: string
) {
  const response = await context.request.get(
    new URL(`/api/journal-documents/${docId}/pdf`, baseUrl).toString()
  );
  const buffer = await response.body();
  const signature = buffer.subarray(0, 4).toString("utf8");

  return {
    ok: response.ok(),
    httpStatus: response.status(),
    contentType: response.headers()["content-type"] ?? null,
    looksLikePdf: signature === "%PDF",
    sizeBytes: buffer.byteLength,
  };
}

async function createDocument(
  context: import("playwright").BrowserContext,
  baseUrl: string,
  templateCode: string
) {
  const today = new Date().toISOString().slice(0, 10);
  const response = await context.request.post(
    new URL("/api/journal-documents", baseUrl).toString(),
    {
      data: {
        templateCode,
        title: `Runtime proof ${templateCode}`,
        dateFrom: today,
        dateTo: today,
      },
    }
  );

  if (!response.ok()) {
    throw new Error(`create document failed with status ${response.status()}`);
  }

  const payload = (await response.json()) as { document?: { id?: string } };
  const documentId = payload.document?.id;
  if (!documentId) {
    throw new Error("create document response did not include document id");
  }

  return documentId;
}

function toMarkdown(snapshot: RuntimeSnapshot) {
  const lines = [
    "# Local Runtime Sweep",
    "",
    `- Generated: ${snapshot.generatedAt}`,
    `- Base URL: ${snapshot.baseUrl}`,
    `- Total journals: ${snapshot.total}`,
    `- List pages OK: ${snapshot.passedList}/${snapshot.total}`,
    `- Detail pages OK: ${snapshot.passedDetail}/${snapshot.total}`,
    `- Print expected and OK: ${snapshot.passedPrintExpected}`,
    "",
    "| Code | List | Detail | Print | Notes |",
    "| --- | --- | --- | --- | --- |",
  ];

  snapshot.entries.forEach((entry) => {
    const printCell = entry.print.expected
      ? entry.print.ok
        ? "PASS"
        : "FAIL"
      : "N/A";
    lines.push(
      `| \`${entry.code}\` | ${entry.list.ok ? "PASS" : "FAIL"} | ${
        entry.detail.ok ? "PASS" : "FAIL"
      } | ${printCell} | ${entry.notes.join("; ") || "ok"} |`
    );
  });

  return lines.join("\n");
}

async function main() {
  const baseUrl = process.env.LOCAL_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const email = process.env.LOCAL_PROOF_EMAIL || "admin@haccp.local";
  const password = process.env.LOCAL_PROOF_PASSWORD || "admin1234";

  const behavior = await loadJsonFile<BehaviorEntry[]>(BEHAVIOR_MATRIX);
  const print = await loadJsonFile<PrintEntry[]>(PRINT_MATRIX);
  const printByCode = new Map(print.map((entry) => [entry.code, entry]));

  const { browser, context, page } = await ensureLoggedIn(baseUrl, email, password);
  const entries: SweepEntry[] = [];

  try {
    for (const item of behavior) {
      const routeUrl = new URL(item.route, baseUrl).toString();
      const printInfo = printByCode.get(item.code);
      const notes: string[] = [];

      const list = await captureList(page, routeUrl, item.code);
      const listOk = !list.url.includes("/login") && (list.documentLinks.length > 0 || list.hasCreateButton);
      if (!listOk) notes.push("list runtime did not expose documents or create controls");

      let detail: SweepEntry["detail"] = {
        ok: false,
        url: null,
        title: "",
        h1: "",
        bodyTextSnippet: "",
        inputCount: 0,
        hasSaveButton: false,
        printButtonCount: 0,
        docId: null,
      };

      if (list.documentLinks.length > 0) {
        detail = await captureDetail(page, list.documentLinks[0]);
        const notFoundSignal = `${detail.title}\n${detail.h1}\n${detail.bodyTextSnippet || ""}`;
        detail.ok =
          !detail.url?.includes("/login") &&
          (detail.h1.trim().length > 0 ||
            detail.inputCount > 0 ||
            detail.hasSaveButton ||
            detail.printButtonCount > 0) &&
          !/404/i.test(notFoundSignal) &&
          !/could not be found/i.test(notFoundSignal);
        if (!detail.ok) notes.push("detail runtime opened but looked like not-found/login state");
      } else if (item.createFlow && list.hasCreateButton) {
        try {
          const documentId = await createDocument(context, baseUrl, item.code);
          detail = await captureDetail(
            page,
            new URL(`/journals/${item.code}/documents/${documentId}`, baseUrl).toString()
          );
          const notFoundSignal = `${detail.title}\n${detail.h1}\n${detail.bodyTextSnippet || ""}`;
          detail.ok =
            !detail.url?.includes("/login") &&
            (detail.h1.trim().length > 0 ||
              detail.inputCount > 0 ||
              detail.hasSaveButton ||
              detail.printButtonCount > 0) &&
            !/404/i.test(notFoundSignal) &&
            !/could not be found/i.test(notFoundSignal);
          if (detail.ok) {
            notes.push("detail created via api for runtime proof");
          } else {
            notes.push("detail created via api but looked like not-found/login state");
          }
        } catch (error) {
          notes.push(
            `no detail link found on list page; auto-create failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else {
        notes.push("no detail link found on list page");
      }

      const printExpected =
        Boolean(printInfo) &&
        !(
          printInfo?.listPrint === "none" &&
          printInfo?.detailPrint === "none" &&
          printInfo?.printStatus === "PASS"
        );

      let printResult: SweepEntry["print"] = {
        expected: printExpected,
        mode: printInfo ? `${printInfo.listPrint}/${printInfo.detailPrint}` : "unknown",
        ok: null,
        httpStatus: null,
        contentType: null,
        looksLikePdf: null,
        sizeBytes: null,
        error: null,
      };

      if (printExpected && detail.docId) {
        try {
          const pdf = await probePdf(context, baseUrl, detail.docId);
          printResult = {
            ...printResult,
            ok: pdf.ok && Boolean(pdf.contentType?.includes("application/pdf")) && pdf.looksLikePdf,
            httpStatus: pdf.httpStatus,
            contentType: pdf.contentType,
            looksLikePdf: pdf.looksLikePdf,
            sizeBytes: pdf.sizeBytes,
            error: null,
          };
          if (!printResult.ok) notes.push("pdf probe failed expected runtime proof");
        } catch (error) {
          printResult.error = error instanceof Error ? error.message : String(error);
          notes.push("pdf probe threw");
        }
      } else if (printExpected) {
        notes.push("print expected but no doc id found");
      } else {
        notes.push("no-print-expected");
      }

      entries.push({
        code: item.code,
        route: item.route,
        list: {
          ok: listOk,
          url: list.url,
          title: list.title,
          h1: list.h1,
          documentLinks: list.documentLinks,
          printButtonCount: list.printButtonCount,
          hasCreateButton: list.hasCreateButton,
        },
        detail,
        print: printResult,
        notes,
      });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const snapshot: RuntimeSnapshot = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    total: entries.length,
    passedList: entries.filter((entry) => entry.list.ok).length,
    passedDetail: entries.filter((entry) => entry.detail.ok).length,
    passedPrintExpected: entries.filter((entry) => !entry.print.expected || entry.print.ok).length,
    entries,
  };

  await fs.writeFile(path.resolve(OUTPUT_JSON), JSON.stringify(snapshot, null, 2), "utf8");
  await fs.writeFile(path.resolve(OUTPUT_MD), `${toMarkdown(snapshot)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputJson: OUTPUT_JSON,
        outputMd: OUTPUT_MD,
        total: snapshot.total,
        passedList: snapshot.passedList,
        passedDetail: snapshot.passedDetail,
        passedPrintExpected: snapshot.passedPrintExpected,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
