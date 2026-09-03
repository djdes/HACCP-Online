/* e2e бумажных журналов по сценарию ТЗ. Локальная БД, dev-сервер на 3020. */
const fs = require("fs");
const path = require("path");
const ROOT = "d:/www/Wesetup.ru";
for (const l of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { Client } = require(path.join(ROOT, "node_modules/pg"));
const bcrypt = require(path.join(ROOT, "node_modules/bcryptjs"));
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));

const BASE = process.env.E2E_BASE || "http://localhost:3020";
const OUT = path.join(__dirname, "e2e");
fs.mkdirSync(OUT, { recursive: true });
const PASSWORD = "e2e-paper-12345";
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail ?? "" });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
}

async function pickCascade(dialog, page, employeeLabel) {
  // Radix Select: первая опция списка — плейсхолдер, поэтому выбираем
  // клавиатурой: Enter открывает, ArrowDown уходит на первую настоящую
  // должность, Enter выбирает. Если у должности один сотрудник, каскад
  // подставляет его сам.
  const trigger = dialog.locator('[role="combobox"]').first();
  if (!(await trigger.count())) return "";
  // Календарь поля даты мог остаться открытым и перекрывать селект:
  // закрываем его кликом по заголовку модалки (клик «мимо»).
  await dialog.getByText("Создание документа").click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  const poppers = await page.locator("[data-radix-popper-content-wrapper]").count();
  if (poppers) console.log("cascade: open poppers before select:", poppers);
  await page.screenshot({ path: path.join(OUT, "cascade-before.png") });
  async function pickByKeyboard(t) {
    // Открываем кликом (как человек), а выбираем клавишами: первая опция
    // списка — плейсхолдер, ArrowDown уводит на первую настоящую.
    await t.click({ timeout: 15000 }).catch(async () => {
      await page.screenshot({ path: path.join(OUT, "cascade-click-fail.png") });
      await t.click({ force: true });
    });
    const opened = await page
      .locator('[role="listbox"] [role="option"]')
      .first()
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      await t.focus();
      await page.keyboard.press("Enter");
      await page.locator('[role="listbox"] [role="option"]').first().waitFor({ timeout: 8000 });
    }
    // Идём вниз, пока подсвечен плейсхолдер (или ничего не подсвечено).
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(80);
      const highlighted = page.locator('[role="option"][data-highlighted]').first();
      if (!(await highlighted.count())) continue;
      const label = (await highlighted.innerText()).trim();
      if (!/^Выберите/.test(label)) break;
    }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    await pickByKeyboard(trigger);
    const stillPlaceholder = (await trigger.innerText()).includes("Выберите должность");
    if (!stillPlaceholder) break;
    console.log("cascade: position not selected, retry", attempt + 1);
  }
  if (await dialog.getByText("Выберите сотрудника").count()) {
    await pickByKeyboard(dialog.locator('[role="combobox"]').nth(1));
  }
  const text = (await dialog.innerText()).replace(/\s+/g, " ");
  const m = new RegExp(employeeLabel + "\\s+(.+?)\\s+Создать документ").exec(text);
  if (!m) console.log("cascade: dialog text:", text.slice(0, 300));
  return m ? m[1].trim() : "";
}

const ROWS = "table:has(thead) tbody tr";

(async () => {
  const db = new Client({
    connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  });
  await db.connect();
  let u = (
    await db.query(
      `select id,email,"organizationId","passwordHash" from "User" where email=$1 and "isActive"=true limit 1`,
      ["admin@haccp.local"],
    )
  ).rows[0];
  if (!u) {
    // Не платформенная и не демо-организация, с самой большой командой —
    // чтобы каскад «должность → сотрудник» было из чего выбирать.
    u = (
      await db.query(
        `select u.id,u.email,u."organizationId",u."passwordHash"
           from "User" u join "Organization" o on o.id=u."organizationId"
          where u."isActive"=true and coalesce(u."isRoot",false)=false
            and u.role in ('manager','owner')
            and o.id<>'platform' and coalesce(o."isDemo",false)=false
            and u.email not like '%platform.local%'
          order by (select count(*) from "User" s where s."organizationId"=o.id and s."isActive"=true) desc, u."createdAt" asc
          limit 1`,
      )
    ).rows[0];
  }
  if (!u) throw new Error("no manager user in local db");
  const originalHash = u.passwordHash;
  await db.query(`update "User" set "passwordHash"=$1 where id=$2`, [
    await bcrypt.hash(PASSWORD, 10),
    u.id,
  ]);
  const staff = (
    await db.query(
      `select count(*)::int as n from "User" where "organizationId"=$1 and "isActive"=true and "archivedAt" is null`,
      [u.organizationId],
    )
  ).rows[0].n;
  console.log("user", u.email, "org", u.organizationId, "active staff", staff);
  const before = (
    await db.query(`select id from "PaperJournalDocument" where "organizationId"=$1`, [
      u.organizationId,
    ])
  ).rows.map((r) => r.id);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  const errors = [];
  page.on("console", (m) => {
    // Расхождение id у radix-крошек при гидратации — старое и не про журналы.
    if (m.type() === "error" && !/hydrat/i.test(m.text())) errors.push(m.text());
  });

  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(180000);
  try {
    await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 180000 }).catch(async (e) => {
      await page.screenshot({ path: path.join(OUT, "login-fail.png"), fullPage: true });
      console.log("login page url:", page.url(), "title:", await page.title());
      throw e;
    });
    await page.fill("#email", u.email);
    await page.fill("#password", PASSWORD);
    const authResponses = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/auth/")) authResponses.push(`${r.status()} ${r.url().replace(BASE, "")}`);
    });
    await page.click("button[type=submit]");
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 90000 });
    } catch (e) {
      await page.screenshot({ path: path.join(OUT, "login-after.png"), fullPage: true });
      const bodyText = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ").slice(0, 600);
      console.log("login stuck at", page.url(), "\nauth responses:", authResponses.join(" | "), "\npage text:", bodyText);
      throw e;
    }
    check("login", true, page.url());

    // Страница списка + черновик
    await page.goto(BASE + "/settings/journals/paper/ot_intro", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(ROWS + " input", { timeout: 180000 }).catch(async (e) => {
      await page.screenshot({ path: path.join(OUT, "draft-fail.png"), fullPage: true });
      console.log("draft page url:", page.url(), "text:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400));
      throw e;
    });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT, "ot-list-1440.png"), fullPage: true });
    const fillBtn = page.getByRole("button", { name: "Подставить сотрудников" });
    check("draft: кнопка «Подставить сотрудников»", (await fillBtn.count()) === 1);
    const inputs = page.locator("tbody tr input");
    const firstVals = await inputs.evaluateAll((els) => els.slice(0, 7).map((e) => e.value));
    check("draft: бланк пустой при заходе", firstVals.every((v) => v === ""), JSON.stringify(firstVals));
    await fillBtn.click();
    await page.waitForTimeout(300);
    const filled = await inputs.evaluateAll((els) => els.map((e) => e.value).filter(Boolean).length);
    check("draft: после подстановки строки заполнены", filled > 0, String(filled));
    const pdf = await page.request.post(BASE + "/api/settings/journals/paper/ot_intro/pdf", {
      data: { rows: [["01.09.2026", "Тест", "1990", "Повар", "Иванов", "", ""]] },
    });
    check(
      "draft: PDF 200 application/pdf",
      pdf.status() === 200 && (pdf.headers()["content-type"] || "").includes("application/pdf"),
      pdf.status() + " " + pdf.headers()["content-type"],
    );

    // Модалка
    await page.getByRole("button", { name: "Новый документ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const titleInput = dialog.locator("#paper-doc-title");
    const title0 = await titleInput.inputValue();
    check(
      "modal: автоназвание «журнал — месяц год»",
      /^Журнал вводного инструктажа по охране труда — [а-яё]+ 20\d\d$/.test(title0),
      title0,
    );
    const dateFrom = dialog.locator("#paper-doc-date-from");
    if (await dateFrom.count()) {
      await dateFrom.fill("15.09.2026");
      await dateFrom.press("Tab");
      await page.waitForTimeout(250);
      const t1 = await titleInput.inputValue();
      check("modal: название следует за датами", t1 !== title0 && t1.includes("сентября 2026"), t1);
      await dateFrom.fill("01.09.2026");
      await dateFrom.press("Tab");
      await page.waitForTimeout(250);
    } else {
      check("modal: поле даты найдено", false);
    }
    await page.screenshot({ path: path.join(OUT, "modal-1440.png") });
    const responsibleName = await pickCascade(dialog, page, "Кто проводит инструктаж");
    check("modal: ответственный выбран через каскад", responsibleName !== "", responsibleName);
    check("modal: у ot_intro нет «Кто проверяет»", (await dialog.getByText("Кто проверяет").count()) === 0);
    await dialog.getByRole("button", { name: "Создать документ" }).click();
    await page.waitForURL(/\/settings\/journals\/paper\/ot_intro\/documents\/[^/]+$/, { timeout: 30000 });
    const docUrl = page.url();
    check("create: редирект на страницу документа", true, docUrl);
    await page.waitForSelector(ROWS + " input", { timeout: 180000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, "doc-1440.png"), fullPage: true });

    const headers = await page.locator("thead th").allInnerTexts();
    const col = (name) => headers.findIndex((h) => h.includes(name)) - 1;
    const row0 = await page.locator(ROWS).first().locator("input").evaluateAll((els) => els.map((e) => e.value));
    check("doc: строки заполнены сотрудниками", row0.length > 0 && row0[col("ФИО инструктируемого")] !== "", JSON.stringify(row0));
    check("doc: инструктирующий = выбранный", row0[col("ФИО инструктирующего")] === responsibleName, `${row0[col("ФИО инструктирующего")]} vs ${responsibleName}`);
    check("doc: работник ≠ инструктирующий", row0[col("ФИО инструктируемого")] !== row0[col("ФИО инструктирующего")]);
    check("doc: дата = начало периода", row0[col("Дата")] === "01.09.2026", row0[col("Дата")]);
    check("doc: подписи пустые", row0[col("Подпись инструктирующего")] === "" && row0[col("Подпись инструктируемого")] === "");
    check("doc: шапка с периодом", (await page.getByText("Период:").count()) > 0);
    check("doc: «Начат 01.09.2026»", (await page.getByText("01.09.2026").count()) > 0);

    const birth = page.locator(ROWS).first().locator("input").nth(col("Год рождения"));
    await birth.fill("1990");
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(ROWS + " input", { timeout: 180000 });
    await page.waitForTimeout(500);
    const persisted = await page.locator(ROWS).first().locator("input").nth(col("Год рождения")).inputValue();
    check("doc: правка сохраняется после перезагрузки", persisted === "1990", persisted);

    // Список: период и ответственный
    await page.goto(BASE + "/settings/journals/paper/ot_intro", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("section ul li", { timeout: 180000 });
    const li = page.locator("section ul li").first();
    const listText = await li.innerText();
    check("list: период и ответственный в строке", listText.includes("сентябрь 2026") && listText.includes(responsibleName), listText.replace(/\n/g, " | "));
    await li.getByRole("button", { name: "Закрыть" }).click();
    const confirm = page.getByRole("dialog");
    await confirm.waitFor();
    await confirm.getByRole("button", { name: /^Закрыть$/ }).last().click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /Закрытые/ }).click();
    await page.waitForTimeout(300);
    check("list: документ ушёл в «Закрытые»", (await page.locator("section ul li").count()) >= 1);
    await page.goto(docUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(ROWS + " input", { timeout: 180000 });
    check("doc closed: бейдж «Закрыт»", (await page.getByText("Закрыт", { exact: true }).count()) > 0);
    check("doc closed: поля только для чтения", (await page.locator(ROWS + " input[readonly]").count()) > 0);

    // electrical_safety: проверяющий
    await page.goto(BASE + "/settings/journals/paper/electrical_safety", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(ROWS + " input", { timeout: 180000 });
    await page.getByRole("button", { name: "Новый документ" }).waitFor({ timeout: 60000 });
    await page.getByRole("button", { name: "Новый документ" }).click();
    const d2 = page.getByRole("dialog");
    await d2.waitFor();
    check("electrical: есть поле проверяющего", (await d2.getByText("Должность проверяющего").count()) > 0);
    check("electrical: нет поля ответственного", (await d2.getByText("Должность ответственного").count()) === 0);
    const verifierName = await pickCascade(d2, page, "Кто проверяет");
    await d2.getByRole("button", { name: "Создать документ" }).click();
    await page.waitForURL(/electrical_safety\/documents\/[^/]+$/, { timeout: 30000 });
    await page.waitForSelector(ROWS + " input", { timeout: 180000 });
    await page.waitForTimeout(1200);
    const h2 = await page.locator("thead th").allInnerTexts();
    const col2 = (n) => h2.findIndex((h) => h.includes(n)) - 1;
    const r2 = await page.locator(ROWS).first().locator("input").evaluateAll((els) => els.map((e) => e.value));
    check("electrical: работник и проверяющий — разные люди", r2[col2("ФИО работника")] !== "" && r2[col2("ФИО работника")] !== r2[col2("ФИО проверяющего")], JSON.stringify(r2));
    check("electrical: проверяющий = выбранный", r2[col2("ФИО проверяющего")] === verifierName, `${r2[col2("ФИО проверяющего")]} vs ${verifierName}`);
    const pdf2 = await page.request.post(BASE + "/api/settings/journals/paper/electrical_safety/pdf", {
      data: { rows: [r2], dateFrom: "2026-09-01", dateTo: "2026-09-30" },
    });
    check("electrical: PDF с периодом 200", pdf2.status() === 200, String(pdf2.status()));

    // 404
    const foreign = (
      await db.query(`select id,"journalId" from "PaperJournalDocument" where "organizationId"<>$1 limit 1`, [u.organizationId])
    ).rows[0];
    if (foreign) {
      const r = await page.request.get(BASE + `/settings/journals/paper/${foreign.journalId}/documents/${foreign.id}`);
      check("чужая организация → 404", r.status() === 404, String(r.status()));
    } else {
      console.log("skip: нет документов чужих организаций в локальной БД");
    }
    const r404 = await page.request.get(BASE + "/settings/journals/paper/ot_intro/documents/nonexistent");
    check("несуществующий документ → 404", r404.status() === 404, String(r404.status()));

    // 390px
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
    const mp = await mobile.newPage();
    await mp.goto(BASE + "/settings/journals/paper/ot_intro", { waitUntil: "domcontentloaded" });
    await mp.waitForSelector(ROWS + " input", { timeout: 180000 });
    await mp.getByRole("button", { name: "Новый документ" }).waitFor({ timeout: 60000 });
    await mp.screenshot({ path: path.join(OUT, "ot-list-390.png"), fullPage: true });
    await mp.getByRole("button", { name: "Новый документ" }).click();
    await mp.getByRole("dialog").waitFor();
    await mp.waitForTimeout(400);
    await mp.screenshot({ path: path.join(OUT, "modal-390.png") });
    const hscroll = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check("390: страница не скроллится горизонтально", !hscroll);
    await mobile.close();
    check("console: нет ошибок", errors.length === 0, errors.slice(0, 3).join(" || "));
  } finally {
    await browser.close();
    const created = (
      await db.query(`select id from "PaperJournalDocument" where "organizationId"=$1`, [u.organizationId])
    ).rows.map((r) => r.id).filter((id) => !before.includes(id));
    if (created.length) await db.query(`delete from "PaperJournalDocument" where id = any($1::text[])`, [created]);
    await db.query(`update "User" set "passwordHash"=$1 where id=$2`, [originalHash, u.id]);
    console.log("cleanup: removed", created.length, "docs, password restored");
    await db.end();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nRESULT: ${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("E2E ERROR", e);
  process.exit(2);
});
