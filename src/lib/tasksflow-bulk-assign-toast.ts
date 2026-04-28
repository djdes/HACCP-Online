export type BulkAssignToastResult = {
  created: number;
  alreadyLinked: number;
  skipped: number;
  errors: number;
  documentsCreated?: number;
};

function formatBulkAssignParts(
  result: BulkAssignToastResult,
  options: { includeCreated?: boolean; includeAlreadyLinked?: boolean } = {}
): string[] {
  const { includeCreated = true, includeAlreadyLinked = true } = options;
  const parts: string[] = [];
  if (includeCreated && result.created > 0) {
    parts.push(`создано: ${result.created}`);
  }
  if (includeAlreadyLinked && result.alreadyLinked > 0) {
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
  // 1) Создались новые задачи — показываем сколько новых + уже было.
  if (result.created > 0) {
    const parts = formatBulkAssignParts(result);
    return `Отправлено новых задач: ${result.created}${
      parts.length > 0 ? ` · ${parts.filter((p) => !p.startsWith("создано")).join(" · ")}` : ""
    }`.replace(/ · $/, "");
  }

  // 2) Ничего нового не создалось, но всё уже было назначено — это нормально,
  //    не пугаем «отправили». Главное число выводим в заголовке.
  if (
    result.errors === 0 &&
    result.skipped === 0 &&
    result.alreadyLinked > 0
  ) {
    const docs =
      result.documentsCreated && result.documentsCreated > 0
        ? ` · заведено документов: ${result.documentsCreated}`
        : "";
    return `Все задачи уже назначены ранее (${result.alreadyLinked})${docs}`;
  }

  // 3) Ошибки или пропуски — явно сообщаем что НЕ отправлено.
  if (result.errors > 0 || result.skipped > 0) {
    const parts = formatBulkAssignParts(result);
    return `Задачи не отправлены${
      parts.length > 0 ? ` · ${parts.join(" · ")}` : ""
    }`;
  }

  // 4) Совсем пусто — нечего было обрабатывать.
  return "Нечего отправлять — задач для назначения нет";
}
