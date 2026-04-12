import fs from "fs/promises";
import path from "path";
import { chromium, type Page } from "playwright";

type Args = {
  loginUrl: string;
  rootDir: string;
  outDir: string;
  username?: string;
  password?: string;
  headless: boolean;
};

type DetailTarget = {
  journalDir: string;
  sourceHtml: string;
  href: string;
  absoluteUrl: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    loginUrl: process.env.SOURCE_SITE_LOGIN_URL ?? "https://lk.haccp-online.ru/docs/login",
    rootDir: "tmp-source-journals/full-crawl",
    outDir: "tmp-source-journals/detail-crawl",
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

function extractFirstDetailHref(html: string) {
  const match = html.match(/location\.href='([^']*\/doc\/1\/\?id=[^']+)'/i);
  return match?.[1] ?? null;
}

async function collectTargets(rootDir: string): Promise<DetailTarget[]> {
  const dirs = await fs.readdir(rootDir, { withFileTypes: true });
  const targets: DetailTarget[] = [];

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;
    const journalDir = path.join(rootDir, dirent.name);
    const names = (await fs.readdir(journalDir)).filter((name) => name.endsWith(".html")).sort();

    let found: DetailTarget | null = null;

    for (const name of names) {
      const htmlPath = path.join(journalDir, name);
      const html = await fs.readFile(htmlPath, "utf8");
      const href = extractFirstDetailHref(html);
      if (!href) continue;

      found = {
        journalDir: dirent.name,
        sourceHtml: name,
        href,
        absoluteUrl: new URL(href, "https://lk.haccp-online.ru").toString(),
      };
      break;
    }

    if (found) {
      targets.push(found);
    }
  }

  return targets.sort((a, b) => a.journalDir.localeCompare(b.journalDir));
}

async function captureTarget(page: Page, outDir: string, target: DetailTarget) {
  const journalOutDir = path.join(outDir, target.journalDir);
  await fs.mkdir(journalOutDir, { recursive: true });

  const response = await page.goto(target.absoluteUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(500);

  const screenshotPath = path.join(journalOutDir, "detail.png");
  const htmlPath = path.join(journalOutDir, "detail.html");
  const metaPath = path.join(journalOutDir, "detail.json");

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
      inputs: document.querySelectorAll("input, textarea, select").length,
      buttons: Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"))
        .map((node) => {
          if (node instanceof HTMLInputElement) return (node.value || "").trim();
          return (node.textContent || "").trim();
        })
        .filter(Boolean)
        .slice(0, 100),
      textSnippet: text.slice(0, 1000),
    };
  });

  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        journalDir: target.journalDir,
        sourceHtml: target.sourceHtml,
        sourceHref: target.href,
        absoluteUrl: target.absoluteUrl,
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });

  await ensureLoggedIn(page, args);

  for (const target of targets) {
    console.log(`Capture detail: ${target.journalDir}`);
    await captureTarget(page, outDir, target);
  }

  await browser.close();
  console.log(`Done. Captured details: ${targets.length}. Output: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
