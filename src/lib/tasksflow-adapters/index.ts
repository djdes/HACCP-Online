/**
 * Registry of journals that integrate with TasksFlow. To add a new
 * journal:
 *   1. Create `src/lib/tasksflow-adapters/<code>.ts` exporting a
 *      `JournalAdapter`. Use `cleaning.ts` as the template.
 *   2. Import + push into `ADAPTERS` below.
 *   3. Run TS check + smoke test the catalog endpoint — the new
 *      journal will appear automatically in:
 *        • GET /api/integrations/tasksflow/journals-catalog
 *        • POST /api/integrations/tasksflow/bind-row
 *        • TasksFlow CreateTask «Журнальный» mode picker
 *
 * No other endpoints need to know about the new code.
 */
import { cleaningAdapter } from "./cleaning";
import { hygieneAdapter } from "./hygiene";
import type { JournalAdapter } from "./types";

const ADAPTERS: JournalAdapter[] = [cleaningAdapter, hygieneAdapter];

const ADAPTERS_BY_CODE = new Map<string, JournalAdapter>(
  ADAPTERS.map((a) => [a.meta.templateCode, a])
);

export function listAdapters(): JournalAdapter[] {
  return ADAPTERS.slice();
}

export function getAdapter(templateCode: string | null | undefined):
  | JournalAdapter
  | null {
  if (!templateCode) return null;
  return ADAPTERS_BY_CODE.get(templateCode) ?? null;
}

export function isJournalSupported(templateCode: string | null | undefined): boolean {
  return Boolean(templateCode && ADAPTERS_BY_CODE.has(templateCode));
}

export type { JournalAdapter, JournalSyncReport, AdapterDocument, AdapterRow } from "./types";
