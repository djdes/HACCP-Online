/**
 * Yandex.OAuth helper for Yandex.Direct API.
 *
 * Two modes:
 *
 *   1. Print auth URL:
 *      npx tsx scripts/yandex-direct-auth.ts
 *
 *      Prints the URL you visit in a browser. After login + consent,
 *      Yandex redirects you to https://oauth.yandex.ru/verification_code
 *      with a 7-digit code. Copy the code.
 *
 *   2. Exchange code → access_token:
 *      npx tsx scripts/yandex-direct-auth.ts <code>
 *
 *      Exchanges the code for an access token and refresh token, prints
 *      the `.env` block you paste into the production .env.
 *
 * The OAuth app must have the "advertising:direct" scope granted. In the
 * OAuth dashboard this is under "Яндекс.Директ" → "Управление кампаниями".
 */

import "dotenv/config";

const CLIENT_ID =
  process.env.YANDEX_OAUTH_CLIENT_ID ||
  "b0c9945c40264a26ae16930c159b7aa5"; // default from the provided screenshot
const CLIENT_SECRET = process.env.YANDEX_OAUTH_CLIENT_SECRET;

function printAuthUrl() {
  const url = new URL("https://oauth.yandex.ru/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  // force_confirm forces the consent screen even if the user already
  // authorised this app earlier — gives a fresh code each time.
  url.searchParams.set("force_confirm", "yes");
  console.log(
    "\n1. Откройте ссылку в браузере под нужным Яндекс-аккаунтом:\n"
  );
  console.log("   " + url.toString() + "\n");
  console.log(
    "2. Нажмите «Разрешить» — откроется страница с 7-значным кодом\n"
  );
  console.log(
    "3. Вызовите:\n\n   npx tsx scripts/yandex-direct-auth.ts <код>\n"
  );
}

async function exchange(code: string) {
  if (!CLIENT_SECRET) {
    console.error(
      "YANDEX_OAUTH_CLIENT_SECRET не задан в .env — без него код обменять нельзя.\n" +
        "Добавьте в .env строку YANDEX_OAUTH_CLIENT_SECRET=<secret> и запустите снова."
    );
    process.exit(1);
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Yandex вернул ${res.status}:`);
    console.error(text);
    process.exit(1);
  }
  const json = JSON.parse(text) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  const expiresDays =
    typeof json.expires_in === "number"
      ? Math.round(json.expires_in / 86400)
      : null;
  console.log("\n=== Токен получен ===\n");
  console.log("Тип:        " + (json.token_type ?? "bearer"));
  console.log(
    "Срок жизни: " +
      (expiresDays != null ? `${expiresDays} дн` : "не указано")
  );
  console.log("\nДобавьте в .env на проде:\n");
  console.log(`YANDEX_DIRECT_OAUTH_TOKEN=${json.access_token}`);
  if (json.refresh_token) {
    console.log(`YANDEX_DIRECT_REFRESH_TOKEN=${json.refresh_token}`);
  }
  console.log("\nПосле этого перезапустите PM2:\n");
  console.log("  pm2 restart haccp-online --update-env\n");
}

const arg = process.argv[2];
if (!arg) {
  printAuthUrl();
} else {
  exchange(arg).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
