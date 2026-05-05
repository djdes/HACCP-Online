/**
 * Unit-тесты для pure helpers из image-compress.ts. Сама
 * `compressImageIfWorthwhile` зависит от browser-only canvas/Image
 * и не testable в Node — её поведение проверяется визуально на
 * реальном устройстве. Здесь — только pure decision/calculation
 * functions, чтобы зафиксировать contract и ловить regression.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCompressedDimensions,
  shouldAttemptCompression,
} from "@/app/mini/_lib/image-compress";

test("shouldAttemptCompression: не сжимаем не-image", () => {
  assert.equal(
    shouldAttemptCompression({ type: "application/pdf", size: 5_000_000 }),
    false
  );
  assert.equal(
    shouldAttemptCompression({ type: "text/plain", size: 5_000_000 }),
    false
  );
  assert.equal(
    shouldAttemptCompression({ type: "video/mp4", size: 5_000_000 }),
    false
  );
});

test("shouldAttemptCompression: не сжимаем PNG (текст-скриншоты)", () => {
  assert.equal(
    shouldAttemptCompression({ type: "image/png", size: 5_000_000 }),
    false
  );
});

test("shouldAttemptCompression: не сжимаем WebP (уже эффективно сжаты)", () => {
  assert.equal(
    shouldAttemptCompression({ type: "image/webp", size: 5_000_000 }),
    false
  );
});

test("shouldAttemptCompression: не сжимаем файлы < 1MB", () => {
  assert.equal(
    shouldAttemptCompression({ type: "image/jpeg", size: 500_000 }),
    false
  );
  assert.equal(
    shouldAttemptCompression({ type: "image/jpeg", size: 1024 * 1024 - 1 }),
    false
  );
});

test("shouldAttemptCompression: сжимаем JPEG ≥ 1MB", () => {
  assert.equal(
    shouldAttemptCompression({ type: "image/jpeg", size: 1024 * 1024 }),
    true
  );
  assert.equal(
    shouldAttemptCompression({ type: "image/jpeg", size: 4_000_000 }),
    true
  );
});

test("computeCompressedDimensions: горизонтальное фото 4000×3000 → 1600×1200", () => {
  const { width, height } = computeCompressedDimensions(4000, 3000);
  assert.equal(width, 1600);
  assert.equal(height, 1200);
});

test("computeCompressedDimensions: вертикальное фото 3000×4000 → 1200×1600", () => {
  const { width, height } = computeCompressedDimensions(3000, 4000);
  assert.equal(width, 1200);
  assert.equal(height, 1600);
});

test("computeCompressedDimensions: квадрат 4000×4000 → 1600×1600", () => {
  const { width, height } = computeCompressedDimensions(4000, 4000);
  assert.equal(width, 1600);
  assert.equal(height, 1600);
});

test("computeCompressedDimensions: маленькое фото меньше MAX_SIDE — не апскейлим", () => {
  const { width, height } = computeCompressedDimensions(800, 600);
  assert.equal(width, 800);
  assert.equal(height, 600);
});

test("computeCompressedDimensions: invalid input → 0×0", () => {
  assert.deepEqual(computeCompressedDimensions(0, 1000), { width: 0, height: 0 });
  assert.deepEqual(computeCompressedDimensions(1000, 0), { width: 0, height: 0 });
  assert.deepEqual(computeCompressedDimensions(-100, 100), {
    width: 0,
    height: 0,
  });
});
