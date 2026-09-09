import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeUserAgent, deviceKey, maskIp } from "@/lib/login-device";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const CHROME_WIN_NEXT = CHROME_WIN.replace("128.0.0.0", "129.0.0.0");
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const TG_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Telegram-Android/11.2";

describe("describeUserAgent", () => {
  it("браузер и ОС по-человечески", () => {
    assert.equal(describeUserAgent(CHROME_WIN), "Chrome · Windows");
    assert.equal(describeUserAgent(SAFARI_IPHONE), "Safari · iPhone");
    assert.equal(describeUserAgent(TG_ANDROID), "Telegram · Android");
    assert.equal(describeUserAgent(""), "Неизвестное устройство");
    assert.equal(describeUserAgent(null), "Неизвестное устройство");
  });
});

describe("deviceKey", () => {
  it("обновление версии браузера — то же устройство, другой браузер — другое", () => {
    assert.equal(deviceKey(CHROME_WIN), deviceKey(CHROME_WIN_NEXT));
    assert.notEqual(deviceKey(CHROME_WIN), deviceKey(SAFARI_IPHONE));
    assert.equal(deviceKey(CHROME_WIN).length, 32);
  });
});

describe("maskIp", () => {
  it("прячет хвост адреса", () => {
    assert.equal(maskIp("95.24.113.7"), "95.24.113.×");
    assert.equal(maskIp("2a00:1450:4010:c05::66"), "2a00:1450:4010:…");
    assert.equal(maskIp(null), "—");
  });
});
