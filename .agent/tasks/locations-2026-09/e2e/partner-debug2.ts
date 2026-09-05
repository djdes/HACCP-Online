/* eslint-disable no-console */
import { chromium } from "playwright";
import fs from "node:fs";
import { decode } from "next-auth/jwt";
const BASE = process.env.BASE ?? "http://localhost:3020";
const partner = JSON.parse(fs.readFileSync(".agent/tasks/locations-2026-09/e2e/creds.json", "utf8"));
const state = JSON.parse(fs.readFileSync(".agent/tasks/locations-2026-09/e2e/state.json", "utf8"));
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#email").fill(partner.email);
  await page.locator("#password").fill(partner.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
  const open = await page.request.post(`${BASE}/api/partner/clients/${state.org}/open`);
  console.log("open", open.status());
  const cookies = await ctx.cookies(BASE);
  const raw = cookies.find((c) => c.name === "haccp-online.session-token")?.value;
  if (raw && process.env.NEXTAUTH_SECRET) {
    const t = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET }).catch((e) => ({ err: String(e) }));
    console.log("token", JSON.stringify({ activeOrganizationId: (t as any)?.activeOrganizationId, partnerAccess: (t as any)?.partnerAccess, err: (t as any)?.err }));
  }
  const root = await page.request.get(`${BASE}/api/root/organizations`);
  console.log("GET /api/root/organizations (404 = middleware ran):", root.status());
  const deny = await page.request.post(`${BASE}/api/organizations`, { data: {} });
  console.log("POST /api/organizations (denylist):", deny.status(), (await deny.text()).slice(0, 120));
  const cb = await page.request.post(`${BASE}/api/settings/buildings`, { data: { name: "Партнёрская точка 3" } });
  console.log("POST /api/settings/buildings:", cb.status(), (await cb.text()).slice(0, 120), "diag:", cb.headers()["x-proxy-diag"]);
  const doc = await page.request.post(`${BASE}/api/journal-documents`, { data: { templateCode: "hygiene", dateFrom: "2026-11-01", dateTo: "2026-11-15" } });
  console.log("POST /api/journal-documents:", doc.status(), (await doc.text()).slice(0, 100));
  await page.request.post(`${BASE}/api/partner/exit`);
  await browser.close();
})();
