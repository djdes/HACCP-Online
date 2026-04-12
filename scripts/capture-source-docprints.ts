import fs from "fs/promises";
import path from "path";
import { chromium, type Download, type Page } from "playwright";

type Args = {
  loginUrl: string;
  rootDir: string;
  outDir: string;
  username?: string;
  password?: string;
  headless: boolean;
};

type PrintTarget = {
  journalDir: string;
  sourceJson: string;
  href: string;
  absoluteUrl: string;
};

type LinkEntry = {
  href?: string;
  text?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    loginUrl: process.env.SOURCE_SITE_LOGIN_URL ?? "https://lk.haccp-online.ru/docs/login",
    rootDir: "tmp-source-journals/full-crawl",
    outDir: "tmp-source-journals/docprint-crawl",
    username: process.env.SOURCE_SITE_USERNAME,
    password: process.env.SOURCE_SITE_PASSWORD,
    headless: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) continue;
    if (key === "--headed") {
      args.headless = false;
      continue;
    }
    if (!value || value.startsWith("--")) continue;
    if (key === "--login-url") args.loginUrl = value;
    if (key === "--root") args.rootDir = value;
    if (key === "--out") args.outDir = value;
    if (key === "--username") args.username = value;
    if (key === "--password") args.password = value;
    i += 1;
  }

  return args;
}

async function ensureLoggedIn(page: Page, args: Args) {
  await page.goto(args.loginUrl, { waitUntil: "domcontentloaded" });
  const hasPassword = await page.locator('input[type="password"]').count();
  if (!hasPassword) return;
  if (!args.username || !args.password) {
    throw new Error("Missing SOURCE_SITE_USERNAME or SOURCE_SITE_PASSWORD");
  }

  const userField = page
    .locator('input[type="text"], input[name*="login" i], input[name*="user" i]')
    .first();
  const passField = page.locator('input[type="password"], input[name*="pass" i]').first();

  await userField.fill(args.username);
  await passField.fill(args.password);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
}

async function collectTargets(rootDir: string): Promise<PrintTarget[]> {
  const dirs = await fs.readdir(rootDir, { withFileTypes: true });
  const targets: PrintTarget[] = [];

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;
    const journalDir = path.join(rootDir, dirent.name);
    const names = (await fs.readdir(journalDir))
      .filter((name) => name.endsWith(".json") && name !== "summary.json")
      .sort();

    let found: PrintTarget | null = null;

    for (const name of names) {
      const jsonPath = path.join(journalDir, name);
      const raw = await fs.readFile(jsonPath, "utf8");
      const parsed = JSON.parse(raw) as { url?: string; links?: LinkEntry[] };
      const baseUrl = parsed.url ?? "https://lk.haccp-online.ru/docs/1";
      const docprint = (parsed.links ?? []).find((link) => typeof link.href === "string" && link.href.includes("/docprint/"));
      if (!docprint?.href) continue;

      found = {
        journalDir: dirent.name,
        sourceJson: name,
        href: docprint.href,
        absoluteUrl: new URL(docprint.href, baseUrl).toString(),
      };
      break;
    }

    if (found) {
      targets.push(found);
    }
  }

  return targets.sort((a, b) => a.journalDir.localeCompare(b.journalDir));
}

async function captureTarget(page: Page, outDir: string, target: PrintTarget) {
  const journalOutDir = path.join(outDir, target.journalDir);
  await fs.mkdir(journalOutDir, { recursive: true });
  const metaPath = path.join(journalOutDir, "docprint.json");

  try {
    const [download, response] = await Promise.all([
      page.waitForEvent("download", { timeout: 12000 }).catch(() => null),
      page.goto(target.absoluteUrl, { waitUntil: "domcontentloaded" }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Download is starting")) return null;
        throw error;
      }),
    ]);

    if (download) {
      await captureDownload(journalOutDir, metaPath, target, download, response);
      return;
    }

    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(500);

    const screenshotPath = path.join(journalOutDir, "docprint.png");
    const htmlPath = path.join(journalOutDir, "docprint.html");

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await fs.writeFile(htmlPath, await page.content(), "utf8");

    const pageMeta = await page.evaluate(() => {
      const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      return {
        url: location.href,
        title: document.title,
        h1: (document.querySelector("h1")?.textContent || "").trim(),
        tables: document.querySelectorAll("table").length,
        forms: document.querySelectorAll("form").length,
        buttons: Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"))
          .map((node) => {
            if (node instanceof HTMLInputElement) return (node.value || "").trim();
            return (node.textContent || "").trim();
          })
          .filter(Boolean)
          .slice(0, 100),
        textSnippet: text.slice(0, 800),
      };
    });

    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          journalDir: target.journalDir,
          sourceJson: target.sourceJson,
          sourceHref: target.href,
          absoluteUrl: target.absoluteUrl,
          mode: "html",
          httpStatus: response?.status() ?? null,
          contentType: response?.headers()["content-type"] ?? null,
          capturedAt: new Date().toISOString(),
          ...pageMeta,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          journalDir: target.journalDir,
          sourceJson: target.sourceJson,
          sourceHref: target.href,
          absoluteUrl: target.absoluteUrl,
          mode: "error",
          capturedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      ),
      "utf8"
    );
    throw error;
  }
}

async function captureDownload(
  journalOutDir: string,
  metaPath: string,
  target: PrintTarget,
  download: Download,
  response: Awaited<ReturnType<Page["goto"]>> | null
) {
  const tempPath = await download.path();
  const suggested = download.suggestedFilename() || "docprint.pdf";
  const ext = path.extname(suggested) || ".pdf";
  const filePath = path.join(journalOutDir, `docprint${ext}`);

  if (tempPath) {
    await fs.copyFile(tempPath, filePath);
  } else {
    await download.saveAs(filePath);
  }

  const buffer = await fs.readFile(filePath);
  const signature = buffer.subarray(0, 4).toString("utf8");

  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        journalDir: target.journalDir,
        sourceJson: target.sourceJson,
        sourceHref: target.href,
        absoluteUrl: target.absoluteUrl,
        mode: "download",
        httpStatus: response?.status() ?? null,
        contentType: response?.headers()["content-type"] ?? null,
        failure: await download.failure(),
        suggestedFilename: suggested,
        savedPath: filePath,
        sizeBytes: buffer.byteLength,
        signature,
        looksLikePdf: signature === "%PDF",
        capturedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(args.rootDir);
  const outDir = path.resolve(args.outDir);
  await fs.mkdir(outDir, { recursive: true });

  const targets = await collectTargets(rootDir);
  await fs.writeFile(
    path.join(outDir, "targets.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: targets.length,
        targets,
      },
      null,
      2
    ),
    "utf8"
  );

  const browser = await chromium.launch({ headless: args.headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 2200 }, acceptDownloads: true });
  const page = await context.newPage();

  await ensureLoggedIn(page, args);

  for (const target of targets) {
    console.log(`Capture docprint: ${target.journalDir}`);
    await captureTarget(page, outDir, target);
  }

  await context.close();
  await browser.close();
  console.log(`Done. Captured docprints: ${targets.length}. Output: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
