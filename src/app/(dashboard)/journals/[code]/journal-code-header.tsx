"use client";

import { usePathname } from "next/navigation";
import { DocumentBackLink } from "@/components/journals/document-back-link";

/**
 * Only show "Назад" on the per-journal list page `/journals/<code>`. On
 * `/journals/<code>/documents/<docId>` the per-document client renders its
 * own back-link via StaffJournalToolbar / DocumentBackLink-with-print, so
 * adding a second one from the layout would stack two back buttons.
 */
export default function JournalCodeHeader() {
  const pathname = usePathname() || "";
  const isDocumentPage = /\/journals\/[^/]+\/(documents|new|[^/]+)\//.test(pathname + "/");
  if (isDocumentPage) return null;
  return <DocumentBackLink href="/journals" />;
}
