import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";
import { listAdapters } from "@/lib/tasksflow-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generic catalog: every journal that has a registered adapter is
 * exposed here so the TasksFlow «Журнальный» mode picker can render
 * tabs / search across all of them. Adapter registry is the single
 * source of truth — adding a new journal in
 * `src/lib/tasksflow-adapters/index.ts` automatically appears here.
 *
 * Auth: same Bearer-key resolution as the legacy cleaning-catalog —
 * symmetric secret with the WeSetup integration row.
 *
 *   GET /api/integrations/tasksflow/journals-catalog
 *   Headers: Authorization: Bearer tfk_…
 *
 * Response:
 *   {
 *     "journals": [
 *       {
 *         "templateCode": "cleaning",
 *         "label": "Журнал уборки",
 *         "description": "...",
 *         "iconName": "spray-can",
 *         "documents": [
 *           {
 *             "documentId": "cmo7…",
 *             "documentTitle": "Журнал уборки",
 *             "period": { "from": "2026-04-16", "to": "2026-04-30" },
 *             "rows": [
 *               {
 *                 "rowKey": "cleaning-pair-…",
 *                 "label": "Громов Илья Павлович",
 *                 "sublabel": "Контроль: m,m,m",
 *                 "responsibleUserId": "cmnyodrhl0005…",
 *                 "existingTasksflowTaskId": 14
 *               }
 *             ]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(tfk_[A-Za-z0-9_-]+)$/.exec(auth);
  if (!match) {
    return NextResponse.json({ error: "Missing Bearer key" }, { status: 401 });
  }
  const presented = match[1];
  const prefix = presented.slice(0, 12);

  const candidates = await db.tasksFlowIntegration.findMany({
    where: { enabled: true, apiKeyPrefix: prefix },
    select: {
      id: true,
      organizationId: true,
      apiKeyEncrypted: true,
    },
  });
  let resolved: { id: string; organizationId: string } | null = null;
  for (const cand of candidates) {
    try {
      if (decryptSecret(cand.apiKeyEncrypted) === presented) {
        resolved = { id: cand.id, organizationId: cand.organizationId };
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (!resolved) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  // Pre-load every TaskLink for this integration so we can mark
  // already-bound rows in the picker — avoids the picker letting
  // an admin double-create a task for the same row.
  const taskLinks = await db.tasksFlowTaskLink.findMany({
    where: { integrationId: resolved.id },
    select: {
      journalCode: true,
      journalDocumentId: true,
      rowKey: true,
      tasksflowTaskId: true,
    },
  });
  const takenByJournal = new Map<string, Map<string, Map<string, number>>>();
  for (const tl of taskLinks) {
    let perJournal = takenByJournal.get(tl.journalCode);
    if (!perJournal) {
      perJournal = new Map();
      takenByJournal.set(tl.journalCode, perJournal);
    }
    let perDoc = perJournal.get(tl.journalDocumentId);
    if (!perDoc) {
      perDoc = new Map();
      perJournal.set(tl.journalDocumentId, perDoc);
    }
    perDoc.set(tl.rowKey, tl.tasksflowTaskId);
  }

  // Walk every registered adapter in parallel — at the time of writing
  // this is just one (`cleaning`), but the structure is ready to fan
  // out across N adapters without code changes.
  const adapters = listAdapters();
  const journalChunks = await Promise.all(
    adapters.map(async (adapter) => {
      const docs = await adapter.listDocumentsForOrg(resolved!.organizationId);
      const perJournal = takenByJournal.get(adapter.meta.templateCode);
      return {
        templateCode: adapter.meta.templateCode,
        label: adapter.meta.label,
        description: adapter.meta.description ?? null,
        iconName: adapter.meta.iconName ?? null,
        documents: docs.map((doc) => {
          const taken = perJournal?.get(doc.documentId) ?? new Map<string, number>();
          return {
            documentId: doc.documentId,
            documentTitle: doc.documentTitle,
            period: doc.period,
            rows: doc.rows.map((row) => ({
              ...row,
              existingTasksflowTaskId: taken.get(row.rowKey) ?? null,
            })),
          };
        }),
      };
    })
  );

  return NextResponse.json({ journals: journalChunks });
}
