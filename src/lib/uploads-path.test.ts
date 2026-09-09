import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { describe, it } from "node:test";

import {
  resolveUploadPath,
  uploadContentType,
} from "@/lib/uploads-path";

const BASE = resolve("/srv/uploads");

describe("resolveUploadPath", () => {
  it("обычный файл в корне", () => {
    assert.equal(
      resolveUploadPath(["photo.jpg"], BASE),
      join(BASE, "photo.jpg"),
    );
  });

  it("файл во вложенной папке", () => {
    assert.equal(
      resolveUploadPath(["support", "a.jpg"], BASE),
      join(BASE, "support", "a.jpg"),
    );
  });

  describe("выход за пределы каталога запрещён", () => {
    it("две точки отдельным сегментом", () => {
      // Маршрут отдаёт файл по пути из запроса — это классическое место
      // для обхода каталога. `../../.env` увёл бы наружу секреты.
      assert.equal(resolveUploadPath(["..", "..", ".env"], BASE), null);
    });

    it("две точки среди нормальных сегментов", () => {
      assert.equal(resolveUploadPath(["support", "..", "..", "x"], BASE), null);
    });

    it("разделитель внутри сегмента", () => {
      // Так выглядит уже раскодированный %2F.
      assert.equal(resolveUploadPath(["../secret"], BASE), null);
      assert.equal(resolveUploadPath(["a/b"], BASE), null);
    });

    it("обратный слеш — тоже разделитель", () => {
      assert.equal(resolveUploadPath(["..\\secret"], BASE), null);
    });

    it("нулевой байт обрывает путь в системном вызове", () => {
      assert.equal(resolveUploadPath(["a\0.jpg"], BASE), null);
    });

    it("одиночная точка", () => {
      assert.equal(resolveUploadPath(["."], BASE), null);
    });

    it("пустой сегмент", () => {
      assert.equal(resolveUploadPath([""], BASE), null);
      assert.equal(resolveUploadPath([], BASE), null);
    });

    it("похожий по имени соседний каталог не считается своим", () => {
      // /srv/uploads-secret начинается с /srv/uploads, но лежит СНАРУЖИ.
      // Проверка по префиксу без разделителя пропустила бы его.
      const got = resolveUploadPath(["..", "uploads-secret", "x"], BASE);
      assert.equal(got, null);
    });
  });

  it("точка внутри имени файла — это нормальное имя", () => {
    assert.equal(
      resolveUploadPath(["a.b.jpg"], BASE),
      join(BASE, "a.b.jpg"),
    );
  });
});

describe("uploadContentType", () => {
  it("картинки", () => {
    assert.equal(uploadContentType("a.jpg"), "image/jpeg");
    assert.equal(uploadContentType("a.JPEG"), "image/jpeg");
    assert.equal(uploadContentType("a.png"), "image/png");
    assert.equal(uploadContentType("a.webp"), "image/webp");
  });

  it("видео и pdf", () => {
    assert.equal(uploadContentType("a.mp4"), "video/mp4");
    assert.equal(uploadContentType("a.pdf"), "application/pdf");
  });

  it("неизвестное НЕ угадываем", () => {
    // Угаданный text/html из чужого файла — это XSS на нашем домене.
    assert.equal(uploadContentType("a.html"), "application/octet-stream");
    assert.equal(uploadContentType("a.svg"), "application/octet-stream");
    assert.equal(uploadContentType("noext"), "application/octet-stream");
  });
});
