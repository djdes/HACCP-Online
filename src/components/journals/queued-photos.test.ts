import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MissingQueuedPhotoError,
  assertNoQueuedPhotoMarks,
  hasQueuedPhotos,
  uploadAndSubstitutePhotos,
} from "@/components/journals/queued-photos";

describe("assertNoQueuedPhotoMarks", () => {
  it("тело без меток проходит", () => {
    assertNoQueuedPhotoMarks({ data: { photos: "https://x/1.jpg" } });
  });

  it("метка в теле запроса — отказ", () => {
    assert.throws(
      () => assertNoQueuedPhotoMarks({ data: { photos: "queued-photo:abc" } }),
      MissingQueuedPhotoError
    );
  });

  it("находит метку в любой глубине", () => {
    // Поле фото называется по-разному в каждом из тридцати пяти журналов,
    // поэтому ищем по всему телу, а не по известному ключу.
    assert.throws(
      () => assertNoQueuedPhotoMarks({ a: { b: [{ c: "queued-photo:x" }] } }),
      MissingQueuedPhotoError
    );
  });
});

describe("uploadAndSubstitutePhotos", () => {
  it("метка без снимка блокирует отправку, а не уезжает строкой", async () => {
    // Самый дорогой исход: запись выглядит заполненной, а в поле фото
    // лежит «queued-photo:…» вместо доказательства. Пустое поле видно
    // сразу, битую ссылку замечают через полгода — на проверке.
    const payload = { data: { photo: "queued-photo:gone" } };
    await assert.rejects(
      () => uploadAndSubstitutePhotos(payload, {}),
      MissingQueuedPhotoError
    );
  });

  it("тело без меток и без снимков проходит как есть", async () => {
    const payload = { data: { note: "ок" } };
    assert.deepEqual(await uploadAndSubstitutePhotos(payload, {}), payload);
  });

  it("hasQueuedPhotos видит метку", () => {
    assert.equal(hasQueuedPhotos({ x: "queued-photo:1" }), true);
    assert.equal(hasQueuedPhotos({ x: "https://x/1.jpg" }), false);
  });
});
