import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { chromium, type Page } from "playwright";

type Target = {
  name: string;
  url: string;
  waitMs?: number;
};

type Args = {
  loginUrl: string;
  targetsFile: string;
  outDir: string;
  profileDir: string;
  headless: boolean;
  pauseForLogin: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    loginUrl: "https://lk.haccp-online.ru/",
    targetsFile: "tmp-source-journals/targets-25-27.json",
    outDir: "tmp-source-journals/capture-25-27",
    profileDir: ".tmp/playwright-profile",
    headless: false,
    pauseForLogin: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) continue;

    if (key === "--headless") {
      args.headless = true;
      continue;
    }
    if (key === "--no-login-pause") {
      args.pauseForLogin = false;
      continue;
    }

    if (!value || value.startsWith("--")) continue;

    if (key === "--login-url") args.loginUrl = value;
    if (key === "--targets") args.targetsFile = value;
    if (key === "--out") args.outDir = value;
    if (key === "--profile") args.profileDir = value;
    i += 1;
  }

  return args;
}

function sanitizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function waitForEnter(message: string) {
  return new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function readTargets(filePath: string): Promise<Target[]> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Targets file must contain an array");
  }

  const targets = parsed
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "",
      url: typeof item.url === "string" ? item.url : "",
      waitMs: typeof item.waitMs === "number" ? item.waitMs : 1200,
    }))
    .filter((item) => item.name && item.url);

  if (targets.length === 0) {
    throw new Error("No valid targets in file");
  }

  return targets;
}

async function captureOne(page: Page, target: Target, outDir: string) {
  await page.goto(target.url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(target.waitMs ?? 1200);

  const safeName = sanitizeName(target.name);
  const screenshotPath = path.join(outDir, `${safeName}.png`);
  const htmlPath = path.join(outDir, `${safeName}.html`);
  const metaPath = path.join(outDir, `${safeName}.json`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await fs.writeFile(htmlPath, await page.content(), "utf8");

  const pageInfo = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll(
        'button, [role="button"], a, input[type="button"], input[type="submit"]'
      )
    )
      .map((node) => {
        if (node instanceof HTMLInputElement) {
          return (node.value || "").trim();
        }
        return (node.textContent || "").trim();
      })
      .filter(Boolean)
      .slice(0, 300);

    return {
      title: document.title,
      h1: (document.querySelector("h1")?.textContent || "").trim(),
      buttons,
    };
  });

  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        name: target.name,
        url: page.url(),
        capturedAt: new Date().toISOString(),
        ...pageInfo,
      },
      null,
      2
    ),
    "utf8"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = await readTargets(args.targetsFile);
  const outDir = path.resolve(args.outDir);
  const profileDir = path.resolve(args.profileDir);

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: args.headless,
    viewport: { width: 1920, height: 1080 },
  });

  const page = context.pages()[0] ?? (await context.newPage());

  console.log(`Open login page: ${args.loginUrl}`);
  await page.goto(args.loginUrl, { waitUntil: "domcontentloaded" });
  if (args.pauseForLogin) {
    await waitForEnter("Log in manually in the opened browser, then press Enter here...");
  }

  for (const target of targets) {
    console.log(`Capture: ${target.name}`);
    await captureOne(page, target, outDir);
  }

  await context.close();
  console.log(`Done. Files saved to: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
