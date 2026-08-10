"use client";

import { JournalRouteError } from "@/components/journals/journal-route-error";

export default function JournalDocumentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <JournalRouteError
      error={error}
      reset={reset}
      title="Не удалось открыть документ"
      description="Документ не загрузился. Все ранее сохранённые отметки остались в базе — нажмите «Попробовать снова»."
      backHref="/journals"
    />
  );
}
