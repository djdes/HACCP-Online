"use client";

import { JournalRouteError } from "@/components/journals/journal-route-error";

export default function JournalsError({
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
      title="Не удалось загрузить список журналов"
      description="Сервер не отдал перечень журналов. Данные организации в безопасности — попробуйте загрузить страницу ещё раз."
      backHref="/dashboard"
      backLabel="На главную"
    />
  );
}
