"use client";

import { useEffect, useState } from "react";
import type { PaperJournal } from "@/lib/sphere-journal-rules";
import { PaperDocumentsClient } from "./paper-documents-client";
import { PaperJournalEditor } from "./paper-journal-editor";

/**
 * Рабочее место бумажного журнала: список документов сверху, бланк снизу.
 *
 * Связывает две части — какой документ открыт и что показывает редактор.
 * Разделено на компоненты, чтобы список не перерисовывался на каждую
 * набранную в бланке букву.
 */

type Organization = { name: string; inn: string | null; address: string | null };
type StaffMember = { name: string; title: string };

export function PaperJournalWorkspace({
  journal,
  organization,
  staff,
}: {
  journal: PaperJournal;
  organization: Organization;
  staff: StaffMember[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{
    id: string;
    rows: string[][];
    responsible: string;
    readOnly: boolean;
  } | null>(null);

  // Сброс делаем в самом обработчике выбора, а не в эффекте: setState
  // прямо в теле эффекта вызывает лишний каскад перерисовок.
  function open(id: string | null) {
    setOpenId(id);
    if (!id) setLoaded(null);
  }

  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    fetch(`/api/settings/journals/paper/${journal.id}/documents/${openId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.document) return;
        setLoaded({
          id: data.document.id,
          rows: Array.isArray(data.document.rows) ? data.document.rows : [],
          responsible: data.document.responsible ?? "",
          readOnly: data.document.status === "closed",
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [openId, journal.id]);

  return (
    <>
      <PaperDocumentsClient
        journalId={journal.id}
        activeDocumentId={openId}
        onOpen={open}
      />

      {/* key по документу: при переключении редактор должен начаться
          заново, а не донести в новый бланк строки прошлого. */}
      <PaperJournalEditor
        key={loaded?.id ?? "blank"}
        journal={journal}
        organization={organization}
        staff={staff}
        documentId={loaded?.id}
        initialRows={loaded?.rows}
        initialResponsible={loaded?.responsible}
        readOnly={loaded?.readOnly}
      />
    </>
  );
}
