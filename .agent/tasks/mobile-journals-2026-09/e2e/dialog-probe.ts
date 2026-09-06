/* eslint-disable no-console */
// Почему модалка автосоздания не по центру: ищем предка с transform/filter,
// который делает position:fixed относительным, и меряем карточку.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3020";
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript("window.__name = (fn) => fn;");
  const page = await ctx.newPage();
  const out: Record<string, unknown> = {};
  try {
    await page.goto(`${BASE}/login`, NAV);
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });

    await page.goto(`${BASE}/journals/hygiene`, NAV);
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));

    // Тумблер «Создавать журнал на новый период автоматически».
    const sw = page.locator('button[role="switch"]').first();
    out.switchVisible = await sw.isVisible().catch(() => false);
    await sw.click();
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    await page.screenshot({ path: ".agent/tasks/mobile-journals-2026-09/shots/dlg-autocreate-before.png" });

    out.geometry = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!dialog) return { found: false };
      const card = dialog.querySelector<HTMLElement>(":scope > div:nth-child(2)");
      const r = dialog.getBoundingClientRect();
      const cr = card?.getBoundingClientRect();
      // предки с transform/filter/contain — они ломают position:fixed
      const offenders: string[] = [];
      let cur: HTMLElement | null = dialog.parentElement;
      while (cur && cur !== document.documentElement) {
        const s = getComputedStyle(cur);
        const bad =
          (s.transform && s.transform !== "none") ||
          (s.filter && s.filter !== "none") ||
          (s.backdropFilter && s.backdropFilter !== "none") ||
          (s.perspective && s.perspective !== "none") ||
          (s.contain && /paint|layout|strict|content/.test(s.contain)) ||
          (s.willChange && /transform|filter/.test(s.willChange));
        if (bad) {
          offenders.push(
            `${cur.tagName.toLowerCase()}.${(cur.className || "").toString().slice(0, 60)} → transform:${s.transform} filter:${s.filter} contain:${s.contain} willChange:${s.willChange}`,
          );
        }
        cur = cur.parentElement;
      }
      // Кто именно стал containing block: ищем предка с тем же rect.
      const chain: string[] = [];
      let node: HTMLElement | null = dialog.parentElement;
      while (node && node !== document.documentElement) {
        const st = getComputedStyle(node);
        const nr = node.getBoundingClientRect();
        chain.push(
          `${node.tagName.toLowerCase()}[${(node.className || "").toString().slice(0, 40)}] top=${Math.round(nr.top)} h=${Math.round(nr.height)} pos=${st.position} containerType=${st.containerType} contentVisibility=${st.contentVisibility} contain=${st.contain} transform=${st.transform} translate=${st.translate} scale=${st.scale} rotate=${st.rotate} filter=${st.filter}`,
        );
        node = node.parentElement;
      }
      const cs = getComputedStyle(dialog as HTMLElement);
      const bodyCs = getComputedStyle(document.body);
      const htmlCs = getComputedStyle(document.documentElement);
      const body = card?.querySelector<HTMLElement>("div.overflow-y-auto");
      return {
        found: true,
        dialogRect: { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) },
        cardRect: cr
          ? { top: Math.round(cr.top), bottom: Math.round(cr.bottom), height: Math.round(cr.height) }
          : null,
        vh: window.innerHeight,
        cardFits: cr ? cr.top >= -1 && cr.bottom <= window.innerHeight + 1 : null,
        bodyScrollable: body ? body.scrollHeight > body.clientHeight + 1 : null,
        offenders,
        dialogPosition: cs.position,
        dialogInset: `${cs.top} ${cs.right} ${cs.bottom} ${cs.left}`,
        dialogSize: `${cs.width} x ${cs.height}`,
        dialogDisplay: `${cs.display} align=${cs.alignItems} justify=${cs.justifyContent}`,
        dialogClass: (dialog.getAttribute("class") ?? "").slice(0, 120),
        bodyOverflowX: bodyCs.overflowX,
        htmlOverflowX: htmlCs.overflowX,
        bodyContain: bodyCs.contain,
        scrollY: window.scrollY,
        chain,
      };
    });
  } catch (e) {
    out.error = String(e).slice(0, 300);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
  }
})();
