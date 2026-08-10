"use client";

import { JournalRouteError } from "@/components/journals/journal-route-error";

export default function JournalCodeError({
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
      title="Не удалось загрузить документы журнала"
      description="Список документов не пришёл с сервера. Сами документы и записи не пострадали — попробуйте ещё раз."
      backHref="/journals"
    />
  );
}
