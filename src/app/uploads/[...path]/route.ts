import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { resolveUploadPath, uploadContentType } from "@/lib/uploads-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /uploads/** — отдача файлов, загруженных людьми.
 *
 * Раньше на это рассчитывали через `public/uploads`, и оно не работало
 * вовсе: Next составляет список файлов `public/` на СБОРКЕ, а всё
 * появившееся позже не отдаёт. Проверено на проде 2026-09-09 — файл,
 * положенный в `public` в рантайме, отвечал 404 даже напрямую у
 * приложения, мимо nginx, тогда как файл из сборки отвечал 200.
 *
 * То есть ни одно загруженное фото не открывалось после загрузки. Для
 * журналов дезинфекции, забраковки, поверки и аварий фото — обязательное
 * доказательство, и его отсутствие на проверке равносильно
 * незаполненному журналу.
 *
 * Здесь файл читается с диска на каждый запрос, поэтому новые загрузки
 * доступны сразу, без пересборки и перезапуска.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;

  // Разбор пути и защита от выхода за каталог — в `uploads-path.ts`
  // под тестом: маршрут отдаёт файл по пути из запроса, и ошибка здесь
  // означала бы чтение чужих файлов сервера.
  const filePath = resolveUploadPath(segments);
  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!info.isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const name = segments[segments.length - 1];
  const stream = Readable.toWeb(
    createReadStream(filePath),
  ) as unknown as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": uploadContentType(name),
      "Content-Length": String(info.size),
      // Имена файлов случайные и содержимое по ним не меняется, поэтому
      // держать можно долго. `private` — вложения обращений и фото
      // журналов не должны оседать в общих кешах по дороге.
      "Cache-Control": "private, max-age=31536000, immutable",
      // Отдаём чужой файл: браузер не должен пытаться угадать тип и
      // выполнить его как разметку на нашем домене.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
