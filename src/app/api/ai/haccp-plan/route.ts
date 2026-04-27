import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsPDF } from "jspdf";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { aiHeavyRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * B7 — AI-генератор ХАССП-плана PDF под профиль организации.
 *
 * GET /api/ai/haccp-plan
 *
 * Собирает контекст org (тип, оборудование, штат, активные журналы)
 * → Claude Haiku → markdown → jsPDF → A4 PDF.
 *
 * При первой проверке РПН инспектор просит «дайте ваш ХАССП-план».
 * Менеджер обычно ищет в Google docs шаблон и адаптирует. Теперь —
 * 30 сек и готовый draft.
 *
 * Auth: management. Если ANTHROPIC_API_KEY не настроен → 503.
 */

const SYSTEM_PROMPT = `Ты — технолог-консультант с 20-летним опытом внедрения ХАССП в российских пищевых компаниях. Твоя задача — написать draft-ХАССП-плана под профиль конкретной организации.

Структура плана (раздел = #, подраздел = ##):

# ХАССП-план для организации [Название]

## 1. Описание организации и продукции
Тип, ассортимент, целевые потребители, объём.

## 2. Команда ХАССП
Кто отвечает (ФИО + роль). Минимум 3 человека: руководитель, технолог, представитель производства.

## 3. Технологическая карта производства
Этапы от приёмки сырья до подачи. Кратко.

## 4. Анализ опасностей
Биологические / химические / физические риски. По каждой группе — где возникает.

## 5. Критические контрольные точки (CCP)
3-5 точек. Для каждой:
- Шаг
- Опасность
- Критический предел (с цифрами)
- Метод мониторинга
- Корректирующее действие

## 6. Ведение записей
Какие журналы вести, кто, когда.

## 7. Верификация и пересмотр
Раз в год — пересмотр плана. Внутренний аудит.

Стиль: конкретный, с цифрами и ГОСТ/СанПиН-ссылками. Без воды. ~1500-2000 слов всего.

Возвращай чистый markdown без артефактов и без объяснений вокруг.`;

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI-помощник недоступен" },
      { status: 503 }
    );
  }
  if (!aiHeavyRateLimiter.consume(`ai-haccp:${auth.session.user.id}`)) {
    return NextResponse.json(
      { error: "Слишком много запросов" },
      { status: 429 }
    );
  }

  const orgId = getActiveOrgId(auth.session);
  const [org, userCount, equipmentCount, templates] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { name: true, type: true, address: true, inn: true },
    }),
    db.user.count({
      where: { organizationId: orgId, isActive: true, archivedAt: null },
    }),
    db.equipment.count({ where: { area: { organizationId: orgId } } }),
    db.journalDocument.findMany({
      where: { organizationId: orgId, status: "active" },
      select: { template: { select: { code: true, name: true } } },
      take: 50,
    }),
  ]);

  const userPrompt =
    `Профиль организации:\n` +
    `- Название: ${org?.name ?? "—"}\n` +
    `- Тип: ${org?.type ?? "—"}\n` +
    `- ИНН: ${org?.inn ?? "—"}\n` +
    `- Адрес: ${org?.address ?? "—"}\n` +
    `- Активных сотрудников: ${userCount}\n` +
    `- Единиц оборудования: ${equipmentCount}\n` +
    `- Активные журналы: ${templates
      .map((t) => t.template.name)
      .join(", ")}\n\n` +
    `Сгенерируй полный ХАССП-план в markdown.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let markdown = "";
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = response.content.find((b) => b.type === "text");
    markdown = block && block.type === "text" ? block.text.trim() : "";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI error" },
      { status: 500 }
    );
  }
  if (!markdown) {
    return NextResponse.json(
      { error: "AI вернул пустой ответ" },
      { status: 502 }
    );
  }

  // Render markdown → PDF (простой подход: каждую line печатаем).
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(10);
  let y = 20;
  const lineHeight = 5;
  const maxWidth = 170;
  const pageHeight = 280;

  const lines = markdown.split("\n");
  for (const line of lines) {
    if (y > pageHeight) {
      doc.addPage();
      y = 20;
    }
    if (line.startsWith("# ")) {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(line.slice(2), maxWidth);
      doc.text(wrapped as string[], 20, y);
      y += wrapped.length * 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      y += 2;
    } else if (line.startsWith("## ")) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(line.slice(3), maxWidth);
      doc.text(wrapped as string[], 20, y);
      y += wrapped.length * 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      y += 1;
    } else if (line.trim() === "") {
      y += lineHeight / 2;
    } else {
      const stripped = line.replace(/[*_`]/g, "");
      const wrapped = doc.splitTextToSize(stripped, maxWidth);
      doc.text(wrapped as string[], 20, y);
      y += wrapped.length * lineHeight;
    }
  }

  const buffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `haccp-plan-${orgId.slice(0, 8)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
