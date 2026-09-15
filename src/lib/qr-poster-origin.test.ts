import assert from "node:assert/strict";
import test from "node:test";

import { resolveQrPosterOrigin } from "@/lib/qr-poster-origin";

test("стенд: домен из ?origin= принимается", () => {
  assert.equal(
    resolveQrPosterOrigin({ requested: "http://localhost:3020/", configured: "https://wesetup.ru", production: false }),
    "http://localhost:3020"
  );
});

test("прод: чужой домен в ?origin= игнорируется, свой — принимается", () => {
  assert.equal(
    resolveQrPosterOrigin({ requested: "https://evil.example", configured: "https://wesetup.ru", production: true }),
    "https://wesetup.ru"
  );
  assert.equal(
    resolveQrPosterOrigin({ requested: "https://wesetup.ru", configured: "https://wesetup.ru/", production: true }),
    "https://wesetup.ru"
  );
});

test("мусор вместо домена — свой домен", () => {
  for (const requested of ["javascript:alert(1)", "https://a.b/path", "", null]) {
    assert.equal(resolveQrPosterOrigin({ requested, configured: null, production: false }), "https://wesetup.ru");
  }
});
