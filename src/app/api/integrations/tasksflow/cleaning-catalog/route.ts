import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  type CleaningDocumentConfig,
  normalizeCleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { toDateKey } from "@/lib/hygiene-document";
import { decryptSecret } from "@/lib/integration-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catalog of cleaning-journal rows that TasksFlow can offer when an
 * admin creates a task in «Журнал»-mode. This endpoint is the WeSetup
 * side of the contract:
 *
 *   GET /api/integrations/tasksflow/cleaning-catalog
 *   Headers:
 *     Authorization: Bearer tfk_…   (TasksFlow's own API key)
 *   Optional headers:
 *     X-WeSetup-Integration-Id: <integrationId>
 *
 * Auth model: a TasksFlow company can read the catalog of any WeSetup
 * org that has connected to it — we look up the WeSetup
 * `TasksFlowIntegration` whose stored `apiKeyEncrypted` decrypts to the
 * presented Bearer key. This keeps secrets symmetric: the same key the
 * admin pasted into the WeSetup connect form is the one TasksFlow uses
 * to read back. No new credentials.
 *
 * If no integration matches → 401 (anti-enum). If integration found but
 * disabled → 401. Otherwise → list of `{documentId, title, period,
 * pairs:[{rowKey, label}]}` for every active cleaning document in that
 * org.
 *
 * Response shape is intentionally narrow — TasksFlow only needs row
 * identifiers and human labels. Cell history and matrix stay private.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(tfk_[A-Za-z0-9_-]+)$/.exec(auth);
  if (!match) {
    return NextResponse.json({ error: "Missing Bearer key" }, { status: 401 });
  }
  const presented = match[1];

  // We can't index by encrypted blob — fetch all integrations and
  // try each. There aren't going to be millions; this is fine.
  const candidates = await db.tasksFlowIntegration.findMany({
    where: { enabled: true },
    select: {
      id: true,
      organizationId: true,
      apiKeyEncrypted: true,
      apiKeyPrefix: true,
    },
  });
  // Cheap filter first by prefix to skip obvious mismatches.
  const prefix = presented.slice(0, 12);
  const filtered = candidates.filter((c) => c.apiKeyPrefix === prefix);

  let resolved: { id: string; organizationId: string } | null = null;
  for (const cand of filtered) {
    try {
      if (decryptSecret(cand.apiKeyEncrypted) === presented) {
        resolved = { id: cand.id, organizationId: cand.organizationId };
        break;
      }
    } catch {
      // bad ciphertext — skip
    }
  }
  if (!resolved) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const docs = await db.journalDocument.findMany({
    where: {
      organizationId: resolved.organizationId,
      status: "active",
      template: { code: CLEANING_DOCUMENT_TEMPLATE_CODE },
    },
    select: {
      id: true,
      title: true,
      dateFrom: true,
      dateTo: true,
      config: true,
    },
    orderBy: { dateFrom: "desc" },
  });

  // Pre-compute the set of pair ids that already have a TasksFlow task
  // attached, so the picker UI on the TasksFlow side can grey them out
  // (or hide them) instead of letting the admin re-create a duplicate.
  const taken = await db.tasksFlowTaskLink.findMany({
    where: {
      integrationId: resolved.id,
      journalCode: CLEANING_DOCUMENT_TEMPLATE_CODE,
    },
    select: { journalDocumentId: true, rowKey: true, tasksflowTaskId: true },
  });
  const takenByDoc = new Map<string, Map<string, number>>();
  for (const t of taken) {
    let inner = takenByDoc.get(t.journalDocumentId);
    if (!inner) {
      inner = new Map();
      takenByDoc.set(t.journalDocumentId, inner);
    }
    inner.set(t.rowKey, t.tasksflowTaskId);
  }

  const documents = docs.map((doc) => {
    const config = normalizeCleaningDocumentConfig(doc.config) as CleaningDocumentConfig;
    const inner = takenByDoc.get(doc.id) ?? new Map<string, number>();
    return {
      documentId: doc.id,
      title: doc.title,
      period: {
        from: toDateKey(doc.dateFrom),
        to: toDateKey(doc.dateTo),
      },
      pairs: (config.responsiblePairs ?? []).map((pair) => ({
        rowKey: pair.id,
        cleaningTitle: pair.cleaningTitle,
        cleaningUserId: pair.cleaningUserId,
        cleaningUserName: pair.cleaningUserName,
        controlTitle: pair.controlTitle,
        controlUserName: pair.controlUserName,
        existingTasksflowTaskId: inner.get(pair.id) ?? null,
      })),
    };
  });

  return NextResponse.json({
    journalCode: CLEANING_DOCUMENT_TEMPLATE_CODE,
    documents,
  });
}
