import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { relativeRedirect, safeInternalPath } from "@/lib/relative-redirect";

describe("safeInternalPath", () => {
  it("пропускает обычный путь с параметрами", () => {
    assert.equal(
      safeInternalPath("/login?next=/settings/consultant"),
      "/login?next=/settings/consultant"
    );
  });

  it("режет протокол-относительный адрес — это уход на чужой домен", () => {
    assert.equal(safeInternalPath("//evil.com/phish"), "/");
    assert.equal(safeInternalPath("/\\evil.com"), "/");
  });

  it("режет абсолютные адреса и мусор", () => {
    for (const bad of ["https://evil.com", "http://evil.com", "evil.com", "", "   "]) {
      assert.equal(safeInternalPath(bad), "/");
    }
  });
});

describe("relativeRedirect", () => {
  it("отдаёт 307 и относительный Location", () => {
    const res = relativeRedirect("/register");
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), "/register");
  });

  it("умеет 308 для постоянного переезда", () => {
    assert.equal(relativeRedirect("/order", 308).status, 308);
  });

  it("не отдаёт абсолютный адрес даже если его попросили", () => {
    assert.equal(
      relativeRedirect("https://localhost:3002/register").headers.get("location"),
      "/"
    );
  });

  it("на ответе можно ставить cookie — партнёрская метка едет с редиректом", () => {
    const res = relativeRedirect("/register");
    res.cookies.set({ name: "wesetup.partner", value: "abc", path: "/" });
    assert.match(res.headers.get("set-cookie") ?? "", /wesetup\.partner=abc/);
  });
});
