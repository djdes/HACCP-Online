import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { supportUploadRateLimiter } from "@/lib/rate-limit";
import { GUEST_ID_PATTERN, guestThreadKey, publicContactLimiter } from "@/lib/public-support";
import {
  saveSupportUpload,
  SUPPORT_ATTACHMENT_MAX_BYTES,
} from "@/lib/support-attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/support/attachments — загрузка вложения для чата с оператором
 * и формы обратной связи (Ctrl+V или кнопка «прикрепить»).
 *
 * multipart/form-data: file=<File>, guestId?=<uuid — для гостей с лендинга>
 * → 200 { attachment: { url, filename, mimeType, sizeBytes, sig } }
 *
 * Файл сохраняется сразу, а к сообщению/обращению привязывается вторым
 * запросом по подписанным метам (sig, TTL 1 час) — нельзя прицепить чужой
 * или выдуманный файл. Правила безопасности (50 МБ, без исполняемых,
 * без html/svg, случайное имя + расширение из MIME) — в
 * `src/lib/support-attachments.ts`.
 *
 * Доступен и без сессии: публичный виджет на лендинге тоже прикладывает
 * файлы. Гость обязан прислать свой guestId; лимиты — по отправителю и
 * дополнительно по IP.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions).catch(() => null);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Не удалось прочитать файл" },
      { status: 400 }
    );
  }

  let uploaderKey: string;
  if (session?.user?.id) {
    uploaderKey = session.user.id;
  } else {
    const guestId = String(form.get("guestId") ?? "");
    if (!GUEST_ID_PATTERN.test(guestId)) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    // Гость: дополнительный заслон по IP — гостевой id генерируется
    // клиентом и сам по себе лимитом не является.
    const ip = clientIp(request) ?? "unknown";
    if (!publicContactLimiter.consume(`upload:${ip}`)) {
      return NextResponse.json(
        { error: "Слишком часто. Попробуйте через несколько минут" },
        { status: 429 }
      );
    }
    uploaderKey = guestThreadKey(guestId);
  }

  if (!supportUploadRateLimiter.consume(`support-upload:${uploaderKey}`)) {
    return NextResponse.json(
      { error: "Слишком много файлов. Попробуйте позже" },
      { status: 429 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 50 МБ" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await saveSupportUpload({
    bytes,
    filename: file.name || "file",
    mimeType: file.type || "application/octet-stream",
    uploaderKey,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  return NextResponse.json({ attachment: saved.attachment });
}
