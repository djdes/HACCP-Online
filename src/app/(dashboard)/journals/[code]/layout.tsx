import JournalCodeHeader from "./journal-code-header";

/**
 * Shared layout for the `/journals/<code>` subtree. The JournalCodeHeader
 * client component decides whether to render a "Назад" back-link: it only
 * shows on the per-journal main list page (`/journals/<code>`), not on
 * `/journals/<code>/documents/<docId>` which has its own top bar.
 */
export default function JournalCodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <JournalCodeHeader />
      {children}
    </div>
  );
}
