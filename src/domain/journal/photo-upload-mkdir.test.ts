/**
 * Regression test: photo upload должен создавать `public/uploads` папку
 * если её нет, не падать с ENOENT.
 *
 * Backstory: после первого deploy на чистый сервер юзер пытался
 * загрузить фото в task-fill wizard и получал «Не удалось сохранить
 * файл». В pm2-логах: `ENOENT: no such file or directory, open
 * '.../public/uploads/task-X-step-Y-Z.jpg'`. Папки `public/uploads`
 * не было в build artifact'е (next build её не создаёт), на проде
 * никто mkdir не делал руками.
 *
 * Фикс: `mkdir(uploadDir, { recursive: true })` перед `writeFile`.
 * Этот тест проверяет логику mkdir-then-write на временной директории.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";
import crypto from "node:crypto";

test("mkdir-then-writeFile создаёт несуществующую папку идемпотентно", async () => {
  const tmpRoot = join(os.tmpdir(), `wesetup-test-${crypto.randomBytes(4).toString("hex")}`);
  const subdir = join(tmpRoot, "deep", "uploads");
  const filepath = join(subdir, "test.txt");
  try {
    // Папки нет — write бы упал с ENOENT.
    await assert.rejects(
      () => writeFile(filepath, "test"),
      (err: NodeJS.ErrnoException) => err.code === "ENOENT",
    );

    // Создаём recursive — успех.
    await mkdir(subdir, { recursive: true });
    await writeFile(filepath, "test data");

    const data = await readFile(filepath, "utf8");
    assert.equal(data, "test data");
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
});

test("mkdir recursive идемпотентен — второй вызов не падает", async () => {
  const tmpDir = join(
    os.tmpdir(),
    `wesetup-test-${crypto.randomBytes(4).toString("hex")}`,
  );
  try {
    await mkdir(tmpDir, { recursive: true });
    await mkdir(tmpDir, { recursive: true }); // второй раз — ok
    const s = await stat(tmpDir);
    assert.equal(s.isDirectory(), true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("photo endpoint code-path обязательно делает mkdir перед writeFile", async () => {
  // Проверяем сам исходник route.ts — оба вызова должны быть в
  // одном try-блоке + mkdir идёт первым.
  const fs = await import("node:fs/promises");
  const srcPath = join(
    process.cwd(),
    "src/app/api/task-fill/[taskId]/photo/route.ts",
  );
  const src = await fs.readFile(srcPath, "utf8");

  // mkdir должен быть до writeFile в коде
  const mkdirIdx = src.indexOf("mkdir(uploadDir");
  const writeIdx = src.indexOf("writeFile(filepath");
  assert.ok(mkdirIdx > 0, "mkdir(uploadDir...) должен быть в route.ts");
  assert.ok(writeIdx > 0, "writeFile(filepath...) должен быть в route.ts");
  assert.ok(
    mkdirIdx < writeIdx,
    "mkdir должен идти ДО writeFile — иначе ENOENT при первом use",
  );

  // recursive: true чтобы mkdir был идемпотентен
  assert.ok(
    src.includes("recursive: true"),
    "mkdir должен быть с recursive: true",
  );
});
