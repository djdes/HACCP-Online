export type BulkAssignToastResult = {
  created: number;
  alreadyLinked: number;
  skipped: number;
  errors: number;
  documentsCreated?: number;
};

function formatBulkAssignParts(result: BulkAssignToastResult): string[] {
  const parts: string[] = [];
  if (result.created > 0) parts.push(`создано: ${result.created}`);
  if (result.alreadyLinked > 0) {
    parts.push(`уже назначено: ${result.alreadyLinked}`);
  }
  if (result.skipped > 0) parts.push(`пропущено: ${result.skipped}`);
  if (result.errors > 0) parts.push(`ошибок: ${result.errors}`);
  if (result.documentsCreated && result.documentsCreated > 0) {
    parts.push(`заведено документов: ${result.documentsCreated}`);
  }
  return parts;
}

export function formatBulkAssignToastMessage(
  result: BulkAssignToastResult
): string {
  const parts = formatBulkAssignParts(result);
  const suffix = parts.length > 0 ? ` · ${parts.join(" · ")}` : "";

  if (result.created > 0) {
    return `Задачи отправлены${suffix}`;
  }

  if (result.errors > 0 || result.skipped > 0) {
    return `Задачи не отправлены${suffix}`;
  }

  return `Новых задач нет${suffix}`;
}
