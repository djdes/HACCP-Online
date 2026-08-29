import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/print/agent/download — архив с программой «Онлайн принтер».
 *
 * Собираем на лету из `resources/print-agent`, а не отдаём готовый файл:
 * иначе архив пришлось бы вручную класть на каждый сервер и следить,
 * чтобы он не отстал от кода. Исходники весят 36 КБ и не тянут ни одной
 * npm-зависимости, так что и в репозитории, и в архиве это копейки.
 *
 * Доступ — как у настроек: ссылка ведёт на подключение принтера всей
 * организации, случайному человеку она ни к чему.
 */
const SOURCE_DIR = path.join(process.cwd(), "resources", "print-agent");

export async function GET() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  let names: string[];
  try {
    names = await fs.readdir(SOURCE_DIR);
  } catch {
    return NextResponse.json(
      { error: "Файлы программы не найдены на сервере" },
      { status: 500 },
    );
  }

  const zip = new JSZip();
  const folder = zip.folder("WesetupPrintAgent");
  if (!folder) {
    return NextResponse.json({ error: "Не удалось собрать архив" }, { status: 500 });
  }

  for (const name of names) {
    const full = path.join(SOURCE_DIR, name);
    const stat = await fs.stat(full);
    if (!stat.isFile()) continue;
    folder.file(name, await fs.readFile(full));
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const uint8 = new Uint8Array(buffer);

  return new Response(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="WesetupPrintAgent.zip"',
      "Content-Length": String(uint8.length),
    },
  });
}
