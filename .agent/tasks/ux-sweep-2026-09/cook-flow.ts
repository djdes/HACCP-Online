import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
const BASE = process.env.SWEEP_BASE ?? "http://localhost:3021"; const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = process.env.SWEEP_OUT!; fs.mkdirSync(OUT, { recursive: true });
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));
(async () => {
  const browser = await chromium.launch({ headless: true }); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
  const errs: string[] = []; page.on("console", (m) => { if (m.type() === "error" && !/hydrat/i.test(m.text())) errs.push(m.text().slice(0, 160)); }); page.on("response", (r) => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().replace(BASE, "")}`); });
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 300000 }); await page.fill("#email", state.users.cookA.email); await page.fill("#password", state.password);
  await page.waitForLoadState("networkidle").catch(() => null); await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 40000 }).catch(async () => { await page.screenshot({ path: path.join(OUT, "login-stuck.png") }); console.log("LOGIN STUCK", page.url()); });
  await page.waitForTimeout(3000); console.log("after login:", page.url().replace(BASE, "")); await page.screenshot({ path: path.join(OUT, "c0-after-login.png") });
  await page.screenshot({ path: path.join(OUT, "c0b-tour.png") });
  const tourNext = page.getByRole("dialog").getByRole("button", { name: /Далее|Понятно|Начать/ }).first();
  for (let k = 0; k < 5 && (await tourNext.isVisible().catch(() => false)); k++) { await tourNext.click(); await page.waitForTimeout(500); }
  const start = page.getByRole("button", { name: /Начать смену/ }).first();
  if (await start.isVisible().catch(() => false)) { await start.click(); await page.waitForTimeout(4000); }
  console.log("after start:", page.url().replace(BASE, "")); await page.screenshot({ path: path.join(OUT, "c1-after-start.png"), fullPage: true });
  let i = 2;
  for (const u of ["mini", "mini/today", "mini/journals/hygiene", "mini/journals/finished_product", "mini/journals/cold_equipment_control", "mini/shift", "journals/hygiene"]) {
    await page.goto(`${BASE}/${u}`, { waitUntil: "load", timeout: 300000 }); await page.waitForTimeout(3000);
    console.log(u, "->", page.url().replace(BASE, "")); await page.screenshot({ path: path.join(OUT, `c${i++}-${u.replace(/\W+/g, "_")}.png`), fullPage: true });
  }
  console.log("ERRS", JSON.stringify(Array.from(new Set(errs)).slice(0, 12), null, 1)); await browser.close();
})().catch((e) => { console.log("FATAL", String(e).slice(0, 300)); process.exit(1); });
