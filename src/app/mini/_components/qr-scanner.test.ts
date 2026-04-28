import assert from "node:assert/strict";
import test from "node:test";

import { __resolveQrDestinationForTests as resolveQrDestination } from "./qr-scanner";

test("resolves https://wesetup.ru/qr/cold-3 to temperature journal with cold filter", () => {
  assert.equal(
    resolveQrDestination("https://wesetup.ru/qr/cold-3"),
    "/mini/journals/cold_equipment_control?cold=3"
  );
  assert.equal(
    resolveQrDestination("wesetup.ru/qr/cold-12"),
    "/mini/journals/cold_equipment_control?cold=12"
  );
});

test("resolves https://wesetup.ru/qr/eq-<uuid> to equipment search", () => {
  const out = resolveQrDestination(
    "https://wesetup.ru/qr/eq-c1d2e3f4-5678-1234-9abc-def012345678"
  );
  assert.equal(
    out,
    "/mini/equipment?q=c1d2e3f4-5678-1234-9abc-def012345678"
  );
});

test("resolves journal-<code> short link", () => {
  assert.equal(
    resolveQrDestination("https://wesetup.ru/qr/journal-hygiene"),
    "/mini/journals/hygiene"
  );
});

test("falls back to /mini/journals?qr=<slug> for unknown shapes", () => {
  assert.equal(
    resolveQrDestination("https://wesetup.ru/qr/unknown-thing"),
    "/mini/journals?qr=unknown-thing"
  );
});

test("recognises a direct Mini App URL", () => {
  assert.equal(
    resolveQrDestination("https://wesetup.ru/mini/journals/general_cleaning"),
    "/mini/journals/general_cleaning"
  );
  assert.equal(
    resolveQrDestination("/mini/equipment?q=cooler"),
    "/mini/equipment?q=cooler"
  );
});

test("recognises a journal code by itself", () => {
  assert.equal(resolveQrDestination("hygiene"), "/mini/journals/hygiene");
  assert.equal(
    resolveQrDestination("general_cleaning"),
    "/mini/journals/general_cleaning"
  );
});

test("recognises a UUID or numeric equipment ID", () => {
  assert.equal(
    resolveQrDestination("c1d2e3f4-5678-1234-9abc-def012345678"),
    "/mini/equipment?q=c1d2e3f4-5678-1234-9abc-def012345678"
  );
  assert.equal(
    resolveQrDestination("12345"),
    "/mini/equipment?q=12345"
  );
});

test("returns null for unrecognised text", () => {
  assert.equal(resolveQrDestination(""), null);
  assert.equal(resolveQrDestination("just some text"), null);
  assert.equal(
    resolveQrDestination("https://example.com/random"),
    null
  );
});
