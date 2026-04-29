import JournalCodeHeader from "./journal-code-header";
import { JournalDocGuideOverlay } from "@/components/journals/journal-doc-guide";

/**
 * Shared layout for the `/journals/<code>` subtree. The JournalCodeHeader
 * client component decides whether to render a "Назад" back-link: it only
 * shows on the per-journal main list page (`/journals/<code>`), not on
 * `/journals/<code>/documents/<docId>` which has its own top bar.
 *
 * `JournalDocGuideOverlay` рендерит floating-кнопку «Как заполнять» —
 * сама компонента детектит по URL, что мы на странице документа, и
 * скрывается на других URL'ах. Контент гайда — из journal-doc-guides.ts.
 */
export default function JournalCodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <JournalCodeHeader />
      {children}
      <JournalDocGuideOverlay />
    </div>
  );
}
