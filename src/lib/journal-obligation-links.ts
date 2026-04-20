type EntryTargetArgs = {
  journalCode: string;
  isDocument: false;
  activeDocumentId: null;
};

type DocumentTargetArgs = {
  journalCode: string;
  isDocument: true;
  activeDocumentId: string | null;
};

export type TargetArgs = EntryTargetArgs | DocumentTargetArgs;

export function resolveJournalObligationTargetPath(
  args: TargetArgs
): string {
  const { journalCode, isDocument, activeDocumentId } = args;
  if (!isDocument && activeDocumentId !== null) {
    throw new Error("Entry journal targets cannot include activeDocumentId");
  }

  const basePath = `/mini/journals/${journalCode}`;
  return isDocument ? basePath : `${basePath}/new`;
}

export function buildMiniObligationEntryUrl(
  miniAppBaseUrl: string,
  obligationId: string
): string {
  return `${miniAppBaseUrl.replace(/\/+$/, "")}/o/${obligationId}`;
}
