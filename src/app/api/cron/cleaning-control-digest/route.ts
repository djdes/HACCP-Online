import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  normalizeCleaningDocumentConfig,
  type CleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { tasksflowClientFor } from "@/lib/tasksflow-client";
import { buildControlRowKey } from "@/lib/tasksflow-adapters/cleaning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/cleaning-control-digest?secret=…
 *
 * Раз в час дёргается внешним планировщиком. Активен только в окне
 * [shiftEndHour-1 … shiftEndHour+1] локального времени организации:
 * условно «конец рабочего дня». Для каждой org с rooms-mode cleaning
 * журналом и подключённой TasksFlow интеграцией:
 *   1. Считает сегодняшние JournalDocumentEntry с kind="cleaning_room".
 *   2. Если ≥ 1 entry — формирует одну сводную TF-задачу
 *      контролёру (controlUserId из config) с описанием:
 *      «Помещение1 ✓ Иванов, Помещение2 ✓ Петров…».
 *   3. rowKey задачи = `control::{documentId}::{dateKey}`. Сохраняем
 *      TasksFlowTaskLink, чтобы при complete webhook прокинул
 *      controllerCompletedAt всем entries (см. applyControlCompletion
 *      в cleaning адаптере).
 *
 * Idempotent: если control-task за этот дневой dateKey уже создан,
 * пропускаем.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  {
    const cronAuth = checkCronSecret(request);
    if (cronAuth) return cronAuth;
  }

  const integrations = await db.tasksFlowIntegration.findMany({
    where: { enabled: true },
    select: {
      id: true,
      organizationId: true,
      baseUrl: true,
      apiKeyEncrypted: true,
      organization: { select: { shiftEndHour: true, timezone: true } },
    },
  });

  let scanned = 0;
  let created = 0;
  let skippedWindow = 0;
  let skippedNoEntries = 0;
  const errors: Array<{ orgId: string; reason: string }> = [];

  for (const integration of integrations) {
    scanned += 1;

    // Активное окно = [shiftEndHour-1, shiftEndHour+1] по timezone org.
    const tz = integration.organization?.timezone || "Europe/Moscow";
    const shiftEnd = integration.organization?.shiftEndHour ?? 0;
    const localHour = new Date().toLocaleString("ru-RU", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    });
    const hour = parseInt(localHour, 10);
    const inWindow =
      Math.abs(hour - shiftEnd) <= 1 ||
      // на полночь shift_end=0 окно [-1,1] = [23,0,1]
      (shiftEnd === 0 && (hour === 23 || hour === 0 || hour === 1));
    if (!inWindow) {
      skippedWindow += 1;
      continue;
    }

    // Сегодняшний dateKey — UTC midnight (consistency с adapter applyRemoteCompletion).
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

    const docs = await db.journalDocument.findMany({
      where: {
        organizationId: integration.organizationId,
        status: "active",
        template: { code: CLEANING_DOCUMENT_TEMPLATE_CODE },
      },
      select: { id: true, title: true, config: true },
    });

    for (const doc of docs) {
      const config = normalizeCleaningDocumentConfig(
        doc.config
      ) as CleaningDocumentConfig;
      if (config.cleaningMode !== "rooms") continue;
      if (!config.controlUserId) continue;

      const rowKey = buildControlRowKey(doc.id, todayKey);

      // Idempotency — control-задача уже создана сегодня?
      const existing = await db.tasksFlowTaskLink.findFirst({
        where: {
          integrationId: integration.id,
          rowKey,
        },
        select: { id: true },
      });
      if (existing) continue;

      const entries = await db.journalDocumentEntry.findMany({
        where: {
          documentId: doc.id,
          date: todayDate,
          data: { path: ["kind"], equals: "cleaning_room" },
        },
        select: { data: true },
      });
      if (entries.length === 0) {
        skippedNoEntries += 1;
        continue;
      }

      // Подгружаем имена помещений и cleaner-ов для description.
      const roomIds = Array.from(
        new Set(
          entries
            .map((e) => (e.data as Record<string, unknown>)?.roomId)
            .filter((x): x is string => typeof x === "string")
        )
      );
      const cleanerIds = Array.from(
        new Set(
          entries
            .map((e) => (e.data as Record<string, unknown>)?.cleanerUserId)
            .filter((x): x is string => typeof x === "string")
        )
      );
      const [rooms, users] = await Promise.all([
        db.room.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, name: true },
        }),
        db.user.findMany({
          where: { id: { in: cleanerIds } },
          select: { id: true, name: true },
        }),
      ]);
      const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));
      const userNameById = new Map(users.map((u) => [u.id, u.name]));

      const lines = entries
        .map((e) => {
          const d = e.data as Record<string, unknown>;
          const roomName =
            roomNameById.get(d.roomId as string) ?? "(помещение)";
          const cleanerName =
            userNameById.get(d.cleanerUserId as string) ?? "(сотрудник)";
          return `• ${roomName} — ${cleanerName}`;
        })
        .join("\n");

      // Линк контролёра в TF (он должен быть синкан).
      const controllerLink = await db.tasksFlowUserLink.findFirst({
        where: {
          integrationId: integration.id,
          wesetupUserId: config.controlUserId,
        },
        select: { tasksflowUserId: true },
      });
      if (!controllerLink?.tasksflowUserId) {
        errors.push({
          orgId: integration.organizationId,
          reason: "controller not linked to TasksFlow",
        });
        continue;
      }

      try {
        const client = tasksflowClientFor(integration);
        const task = await client.createTask({
          title: `Контроль уборки · ${todayKey}`,
          workerId: controllerLink.tasksflowUserId,
          requiresPhoto: false,
          isRecurring: false,
          weekDays: [],
          category: "WeSetup · Уборка · Контроль",
          description: `Журнал: ${doc.title}\nПроверь выполненные сегодня уборки:\n${lines}`,
        });
        await db.tasksFlowTaskLink.create({
          data: {
            integrationId: integration.id,
            journalCode: CLEANING_DOCUMENT_TEMPLATE_CODE,
            journalDocumentId: doc.id,
            rowKey,
            tasksflowTaskId: task.id,
            remoteStatus: "active",
            lastDirection: "push",
          },
        });
        created += 1;
      } catch (err) {
        errors.push({
          orgId: integration.organizationId,
          reason: err instanceof Error ? err.message : "unknown",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scanned,
    created,
    skippedWindow,
    skippedNoEntries,
    errors,
  });
}
